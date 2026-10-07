mod git;
mod server;

use std::{
    io::Read,
    net::{Ipv4Addr, SocketAddr},
    path::{Path, PathBuf},
    process::Stdio,
};

use clap::Parser;
use tokio::net::TcpListener;

/// An insanely fast side-by-side diff viewer.
///
///   snappy-diff                 diff the default branch against HEAD
///   snappy-diff main            diff main...HEAD
///   snappy-diff main feature    diff main...feature
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

fn open_browser(url: &str) {
    let (cmd, args): (&str, &[&str]) = if cfg!(target_os = "macos") {
        ("open", &[])
    } else if cfg!(target_os = "windows") {
        ("cmd", &["/C", "start", ""])
    } else {
        ("xdg-open", &[])
    };
    let _ = std::process::Command::new(cmd)
        .args(args)
        .arg(url)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    let patch = read_patch(&cli.args)?;
    let repo = git::toplevel(&cli.repo).await.map(PathBuf::from);

    let (mut base, mut head) = (String::new(), String::new());
    if let (None, Some(repo)) = (&patch, &repo) {
        base = match cli.args.first() {
            Some(base) => base.clone(),
            None => git::default_base(repo).await,
        };
        head = match cli.args.get(1) {
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
        open_browser(&url);
    }

    axum::serve(listener, server::router(server::App { repo, patch, base, head })).await?;
    Ok(())
}
