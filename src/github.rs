//! GitHub pull requests, through the `gh` CLI and plain `git`.

use std::{path::Path, process::Stdio};

use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::{io::AsyncWriteExt, process::Command};

use crate::git;

/// A pull request, as `gh pr view` describes it.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pr {
    pub number: u64,
    pub title: String,
    pub url: String,
    pub base_ref_name: String,
    pub head_ref_oid: String,
}

/// One comment of a review, in the shape GitHub's reviews API takes.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewComment {
    path: String,
    line: u32,
    /// `additions` or `deletions`, as the diff view says it.
    side: String,
    start_line: Option<u32>,
    body: String,
}

/// Runs `gh` in the repository, feeding it `input` on stdin.
async fn gh(repo: &Path, args: &[&str], input: Option<&[u8]>) -> Result<Vec<u8>, String> {
    let mut child = Command::new("gh")
        .current_dir(repo)
        .args(args)
        .stdin(if input.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "the GitHub CLI (gh) is not installed".to_string())?;
    if let (Some(input), Some(mut stdin)) = (input, child.stdin.take()) {
        stdin.write_all(input).await.map_err(|e| e.to_string())?;
    }
    let out = child.wait_with_output().await.map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(out.stdout)
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

/// `123`, `#123` or a pull request URL, as a PR number.
pub fn parse_pr_arg(arg: &str) -> Option<u64> {
    let number = match arg.find("/pull/") {
        Some(at) => arg[at + 6..].split(['/', '#', '?']).next()?,
        None => arg.strip_prefix('#').unwrap_or(arg),
    };
    number.parse().ok().filter(|_| !number.is_empty())
}

/// The pull request for `selector` (a number), or for the current branch.
pub async fn pr(repo: &Path, selector: Option<u64>) -> Option<Pr> {
    let number = selector.map(|n| n.to_string());
    let mut args = vec!["pr", "view"];
    args.extend(number.as_deref());
    args.extend(["--json", "number,title,url,baseRefName,headRefOid"]);
    let out = gh(repo, &args, None).await.ok()?;
    serde_json::from_slice(&out).ok()
}

/// Fetches a PR's commits and its base, returning `(base, head)` refs to diff.
/// Plain `git`, so public repositories work without `gh`.
pub async fn fetch(repo: &Path, number: u64, base_branch: &str) -> Result<(String, String), String> {
    let head = format!("origin/pr/{number}");
    let pull = format!("+pull/{number}/head:refs/remotes/{head}");
    let base = format!("+{base_branch}:refs/remotes/origin/{base_branch}");
    git::run(repo, &["fetch", "--quiet", "origin", &pull, &base]).await?;
    Ok((format!("origin/{base_branch}"), head))
}

/// Posts comments to the PR as a submitted comment review; returns its URL.
pub async fn post_review(repo: &Path, pr: &Pr, comments: &[ReviewComment]) -> Result<String, String> {
    let payload = review_payload(pr, comments);
    let path = format!("repos/{{owner}}/{{repo}}/pulls/{}/reviews", pr.number);
    let out = gh(repo, &["api", &path, "--method", "POST", "--input", "-"], Some(payload.to_string().as_bytes())).await?;
    let review: serde_json::Value = serde_json::from_slice(&out).map_err(|e| e.to_string())?;
    Ok(review["html_url"].as_str().unwrap_or(&pr.url).to_string())
}

fn review_payload(pr: &Pr, comments: &[ReviewComment]) -> serde_json::Value {
    let side = |s: &str| if s == "deletions" { "LEFT" } else { "RIGHT" };
    let comments: Vec<_> = comments
        .iter()
        .map(|c| {
            let mut comment = json!({ "path": c.path, "line": c.line, "side": side(&c.side), "body": c.body });
            if let Some(start) = c.start_line.filter(|&s| s < c.line) {
                comment["start_line"] = json!(start);
                comment["start_side"] = json!(side(&c.side));
            }
            comment
        })
        .collect();
    json!({ "commit_id": pr.head_ref_oid, "event": "COMMENT", "body": "", "comments": comments })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pr_arguments() {
        assert_eq!(parse_pr_arg("123"), Some(123));
        assert_eq!(parse_pr_arg("#45"), Some(45));
        assert_eq!(parse_pr_arg("https://github.com/org/repo/pull/678"), Some(678));
        assert_eq!(parse_pr_arg("https://github.com/org/repo/pull/678/files#diff-1"), Some(678));
        assert_eq!(parse_pr_arg("main"), None);
        assert_eq!(parse_pr_arg("feature/x"), None);
    }

    #[test]
    fn review_shape() {
        let pr = Pr { number: 1, title: "t".into(), url: "u".into(), base_ref_name: "main".into(), head_ref_oid: "abc".into() };
        let comments = vec![
            ReviewComment { path: "a.rs".into(), line: 10, side: "additions".into(), start_line: None, body: "x".into() },
            ReviewComment { path: "b.rs".into(), line: 7, side: "deletions".into(), start_line: Some(5), body: "y".into() },
        ];
        let p = review_payload(&pr, &comments);
        assert_eq!(p["event"], "COMMENT");
        assert_eq!(p["commit_id"], "abc");
        assert_eq!(p["comments"][0]["side"], "RIGHT");
        assert!(p["comments"][0].get("start_line").is_none());
        assert_eq!(p["comments"][1]["side"], "LEFT");
        assert_eq!(p["comments"][1]["start_line"], 5);
        assert_eq!(p["comments"][1]["start_side"], "LEFT");
    }
}
