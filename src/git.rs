//! Thin wrappers around the `git` CLI. Shelling out is as fast as git itself
//! and keeps the binary free of a bundled git implementation.

use std::{
    path::{Component, Path, PathBuf},
    process::Stdio,
};

use serde::Serialize;
use tokio::process::Command;

/// Runs `git -C <repo> <args>`, returning stdout or git's error message.
pub async fn run(repo: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .await
        .map_err(|e| format!("failed to run git: {e}"))?;
    if out.status.success() {
        Ok(out.stdout)
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

/// Like [`run`], for commands that print a single value.
pub async fn line(repo: &Path, args: &[&str]) -> Option<String> {
    let out = run(repo, args).await.ok()?;
    let s = String::from_utf8_lossy(&out).trim().to_string();
    (!s.is_empty()).then_some(s)
}

pub async fn toplevel(dir: &Path) -> Option<String> {
    line(dir, &["rev-parse", "--show-toplevel"]).await
}

pub async fn current_branch(repo: &Path) -> String {
    line(repo, &["rev-parse", "--abbrev-ref", "HEAD"]).await.unwrap_or_else(|| "HEAD".into())
}

/// The branch a PR would most likely target.
pub async fn default_base(repo: &Path) -> String {
    if let Some(r) = line(repo, &["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]).await {
        return r;
    }
    for candidate in ["main", "master"] {
        if run(repo, &["rev-parse", "--verify", "--quiet", candidate]).await.is_ok() {
            return candidate.into();
        }
    }
    "HEAD".into()
}

/// Branches, remote branches and tags, most recently committed first.
pub async fn refs(repo: &Path) -> Vec<String> {
    let args = [
        "for-each-ref",
        "--sort=-committerdate",
        "--format=%(refname)",
        "refs/heads",
        "refs/remotes",
        "refs/tags",
    ];
    let Ok(out) = run(repo, &args).await else {
        return Vec::new();
    };
    String::from_utf8_lossy(&out)
        .lines()
        .filter(|r| !r.ends_with("/HEAD"))
        // refs/heads/main -> main, refs/remotes/origin/main -> origin/main
        .filter_map(|r| r.splitn(3, '/').nth(2))
        .map(str::to_owned)
        .collect()
}

/// What `head` changed since it forked from `base`, like a pull request.
/// Without a `head`, compares against the working tree (tracked files only).
/// `--full-index` gives the UI blob ids so it can lazily fetch whole files.
pub async fn diff(repo: &Path, base: &str, head: Option<&str>, ignore_whitespace: bool) -> Result<Vec<u8>, String> {
    if base.starts_with('-') || head.is_some_and(|h| h.starts_with('-')) {
        return Err("invalid ref".into());
    }
    let mut args = vec!["diff", "--no-color", "--no-ext-diff", "--full-index", "-M"];
    if ignore_whitespace {
        args.push("-w");
    }
    let range;
    match head {
        Some(head) => {
            range = format!("{base}...{head}");
            args.push(&range);
        }
        None => args.extend(["--merge-base", base]),
    }
    args.push("--");
    run(repo, &args).await
}

/// One commit, as listed in the commit picker.
#[derive(Serialize)]
pub struct Commit {
    sha: String,
    subject: String,
    author: String,
    date: String,
}

/// Commits in `base..head`, newest first.
pub async fn commits(repo: &Path, base: &str, head: &str) -> Vec<Commit> {
    if base.starts_with('-') || head.starts_with('-') {
        return Vec::new();
    }
    let range = format!("{base}..{head}");
    let format = "--format=%H%x1f%s%x1f%an%x1f%ar";
    let Ok(out) = run(repo, &["log", format, "--max-count=500", &range, "--"]).await else {
        return Vec::new();
    };
    String::from_utf8_lossy(&out)
        .lines()
        .filter_map(|line| {
            let mut f = line.split('\x1f').map(str::to_owned);
            Some(Commit { sha: f.next()?, subject: f.next()?, author: f.next()?, date: f.next()? })
        })
        .collect()
}

/// How many commits in `base..head` touched each file.
pub async fn churn(repo: &Path, base: &str, head: &str) -> std::collections::HashMap<String, u32> {
    let mut counts = std::collections::HashMap::new();
    if base.starts_with('-') || head.starts_with('-') {
        return counts;
    }
    let range = format!("{base}..{head}");
    if let Ok(out) = run(repo, &["log", "--format=", "--name-only", "--max-count=500", &range, "--"]).await {
        for path in String::from_utf8_lossy(&out).lines().filter(|l| !l.is_empty()) {
            *counts.entry(path.to_string()).or_insert(0) += 1;
        }
    }
    counts
}

/// What a single commit changed (against its first parent for merges).
pub async fn show(repo: &Path, sha: &str, ignore_whitespace: bool) -> Result<Vec<u8>, String> {
    if sha.starts_with('-') {
        return Err("invalid commit".into());
    }
    let mut args = vec!["show", "--format=", "--no-color", "--no-ext-diff", "--full-index", "-M"];
    args.push("--diff-merges=first-parent");
    if ignore_whitespace {
        args.push("-w");
    }
    args.extend([sha, "--"]);
    run(repo, &args).await
}

/// Files too big to be worth rendering are listed but not shown.
const MAX_UNTRACKED_BYTES: usize = 1 << 20;

/// Untracked files as a patch adding them, so new files show up next to
/// the edits. Written directly instead of spawning `git diff` per file.
pub async fn untracked_patch(repo: &Path) -> Vec<u8> {
    let Ok(list) = run(repo, &["ls-files", "--others", "--exclude-standard", "-z"]).await else {
        return Vec::new();
    };
    let mut patch = Vec::new();
    for path in String::from_utf8_lossy(&list).split('\0').filter(|p| !p.is_empty()) {
        let Ok(contents) = tokio::fs::read(repo.join(path)).await else {
            continue;
        };
        patch.extend(format!("diff --git a/{path} b/{path}\nnew file mode 100644\n").as_bytes());
        if contents.is_empty() {
            continue;
        }
        let binary = contents.len() > MAX_UNTRACKED_BYTES || contents[..contents.len().min(8000)].contains(&0);
        if binary {
            patch.extend(format!("Binary files /dev/null and b/{path} differ\n").as_bytes());
            continue;
        }
        let lines = contents.split_inclusive(|&b| b == b'\n').count();
        patch.extend(format!("--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,{lines} @@\n").as_bytes());
        for line in contents.split_inclusive(|&b| b == b'\n') {
            patch.push(b'+');
            patch.extend(line);
        }
        if contents.last() != Some(&b'\n') {
            patch.extend(b"\n\\ No newline at end of file\n");
        }
    }
    patch
}

/// `path` inside the repository, refusing anything that would step outside it.
pub fn repo_path(repo: &Path, path: &str) -> Option<PathBuf> {
    let relative = Path::new(path);
    relative.components().all(|c| matches!(c, Component::Normal(_))).then(|| repo.join(relative))
}

/// A file as it currently is on disk; uncommitted contents have no blob yet.
pub async fn worktree_file(repo: &Path, path: &str) -> Result<Vec<u8>, String> {
    let file = repo_path(repo, path).ok_or("invalid path")?;
    tokio::fs::read(file).await.map_err(|e| e.to_string())
}

pub async fn blob(repo: &Path, oid: &str) -> Result<Vec<u8>, String> {
    if !matches!(oid.len(), 40 | 64) || !oid.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("invalid object id".into());
    }
    run(repo, &["cat-file", "blob", oid]).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repo_paths_stay_inside() {
        let repo = Path::new("/repo");
        assert_eq!(repo_path(repo, "src/a.rs"), Some(PathBuf::from("/repo/src/a.rs")));
        assert_eq!(repo_path(repo, "../etc/passwd"), None);
        assert_eq!(repo_path(repo, "/etc/passwd"), None);
        assert_eq!(repo_path(repo, "src/../../x"), None);
    }
}
