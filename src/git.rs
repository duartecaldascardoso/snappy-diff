//! Thin wrappers around the `git` CLI. Shelling out is as fast as git itself
//! and keeps the binary free of a bundled git implementation.

use std::{
    path::{Component, Path},
    process::Stdio,
};

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

/// A file as it currently is on disk; uncommitted contents have no blob yet.
pub async fn worktree_file(repo: &Path, path: &str) -> Result<Vec<u8>, String> {
    let relative = Path::new(path);
    if !relative.components().all(|c| matches!(c, Component::Normal(_))) {
        return Err("invalid path".into());
    }
    tokio::fs::read(repo.join(relative)).await.map_err(|e| e.to_string())
}

pub async fn blob(repo: &Path, oid: &str) -> Result<Vec<u8>, String> {
    if !matches!(oid.len(), 40 | 64) || !oid.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("invalid object id".into());
    }
    run(repo, &["cat-file", "blob", oid]).await
}
