mod git;
mod github;
mod open;
mod server;

use std::{
    io::Read,
    net::{Ipv4Addr, SocketAddr},
    path::{Path, PathBuf},
};

use clap::Parser;
use tokio::net::TcpListener;

/// An insanely fast side-by-side diff viewer.
///
///   snappy-diff                 diff the default branch against HEAD
///   snappy-diff main            diff main...HEAD
///   snappy-diff main feature    diff main...feature
///   snappy-diff -w              diff the default branch against uncommitted changes
///   snappy-diff 123             review pull request #123 (or paste its URL)
///   snappy-diff change.diff     view a .diff/.patch file
///   git diff | snappy-diff -    view a diff from stdin
#[derive(Parser)]
#[command(version, verbatim_doc_comment)]
struct Cli {
    /// `[base] [head]`, a patch file, or `-` for stdin
    args: Vec<String>,
    /// Repository to diff
    #[arg(short = 'C', long, default_value = ".")]
    repo: PathBuf,
    /// Port to listen on (falls back to a free one if taken)
    #[arg(short, long, default_value_t = 4747)]
    port: u16,
    /// Compare against the working tree (uncommitted changes) instead of a head ref
    #[arg(short, long)]
    worktree: bool,
    /// Don't open the browser
    #[arg(long)]
    no_open: bool,
}

/// A single argument naming a file (or `-`) is a patch rather than a ref.
fn read_patch(args: &[String]) -> std::io::Result<Option<(String, String)>> {
    let [arg] = args else { return Ok(None) };
    if arg == "-" {
        let mut patch = String::new();
        std::io::stdin().read_to_string(&mut patch)?;
        Ok(Some(("stdin".into(), patch)))
    } else if Path::new(arg).is_file() {
        let patch = String::from_utf8_lossy(&std::fs::read(arg)?).into_owned();
        let name = Path::new(arg).file_name().unwrap_or_default().to_string_lossy();
        Ok(Some((name.into_owned(), patch)))
    } else {
        Ok(None)
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    let patch = read_patch(&cli.args)?;
    let repo = git::toplevel(&cli.repo).await.map(PathBuf::from);

    let (mut base, mut head) = (String::new(), String::new());
    let mut pr = None;
    let pr_arg = match (cli.args.as_slice(), &patch, &repo) {
        // A branch that happens to be named like a number wins over a PR.
        ([one], None, Some(repo)) if git::run(repo, &["rev-parse", "--verify", "--quiet", one]).await.is_err() => {
            github::parse_pr_arg(one)
        }
        _ => None,
    };
    if let (Some(number), Some(repo)) = (pr_arg, &repo) {
        println!("Fetching pull request #{number}…");
        let info = github::pr(repo, Some(number)).await;
        let base_branch = match &info {
            Some(info) => info.base_ref_name.clone(),
            None => git::default_base(repo).await.trim_start_matches("origin/").to_string(),
        };
        (base, head) = github::fetch(repo, number, &base_branch).await.map_err(|e| format!("couldn't fetch #{number}: {e}"))?;
        pr = Some(info);
    } else if let (None, Some(repo)) = (&patch, &repo) {
        base = match cli.args.first() {
            Some(base) => base.clone(),
            None => git::default_base(repo).await,
        };
        head = match cli.args.get(1) {
            _ if cli.worktree => String::new(),
            Some(head) => head.clone(),
            None => git::current_branch(repo).await,
        };
    }

    // Loopback only: this serves repository contents.
    let addr = |port| SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    let listener = match TcpListener::bind(addr(cli.port)).await {
        Ok(listener) => listener,
        Err(_) => TcpListener::bind(addr(0)).await?,
    };
    let url = format!("http://localhost:{}", listener.local_addr()?.port());
    println!("snappy-diff → {url}");
    if !cli.no_open {
        open::open(&url);
    }

    // With no arguments, the current branch's PR (if any) is looked up lazily.
    let detect_pr = cli.args.is_empty() && !cli.worktree;
    let pr = pr.map_or_else(tokio::sync::OnceCell::new, |pr| tokio::sync::OnceCell::new_with(Some(pr)));
    let app = server::App { repo, patch, base, head, pr, detect_pr };
    axum::serve(listener, server::router(app)).await?;
    Ok(())
}
