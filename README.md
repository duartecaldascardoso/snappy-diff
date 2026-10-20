<div align="center">

# snappy diff

An insanely fast diff viewer for git branches and patch files.<br>
Review a branch like a pull request, comment, and hand it to your AI agent.

[Install](#install) · [Use](#use) · [Review](#review) · [Keys](#keys)

<br>

<img src="docs/demo.gif" alt="snappy diff reviewing its own code" width="100%">

</div>

## Install

```bash
# macOS and Linux
curl -fsSL https://raw.githubusercontent.com/duartecaldascardoso/snappy-diff/main/install.sh | sh
```

```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/duartecaldascardoso/snappy-diff/main/install.ps1 | iex
```

One ~4 MB download. No Node, no Rust, nothing else to install.

## Use

```bash
snappy-diff                 # default branch vs. current branch
snappy-diff main feature    # main...feature, like a pull request
snappy-diff -w              # uncommitted changes, refreshed live
snappy-diff 123             # a GitHub pull request (number or URL)
snappy-diff change.diff     # a .diff or .patch file
git diff | snappy-diff -    # from stdin
```

On a branch with an open pull request, it diffs against the PR's base automatically.
Or drop, paste or open a diff exported from GitHub or GitLab right in the page.

## Review

- **Mark files viewed** with `v`; viewed, generated and huge files stay out of the way
- **Comment** on a line, a range, or any code you select; comments follow the code as it changes
- **Copy for AI** turns your comments into a prompt with files, lines and code
- **Send to GitHub** posts them to the pull request as a review
- **Search the code** with `⌘F`, and open any file in your editor with `o`
- **Go anywhere** with `⌘K`: files, commits, comments and actions
- **Pick a commit** to review one change at a time

## Keys

| | |
| --- | --- |
| `⌘K` | Go to a file, commit, comment or action |
| `j` `k` | Next / previous file |
| `⌘F` | Search the code |
| `v` | Mark file as viewed |
| `c` | Comment on selected code |
| `o` | Open file in your editor |
| `/` | Filter the file tree |
| `⌘B` | Toggle the sidebar |
| `?` | Settings: layout, themes, fonts, icons |

## Build from source

```bash
npm --prefix ui ci && npm --prefix ui run build
cargo install --path .
```
