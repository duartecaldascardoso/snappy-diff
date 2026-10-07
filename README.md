# snappy diff

An insanely fast side-by-side diff viewer for git branches and patch files.

![snappy diff](docs/screenshot.png)

## Install

Requires Rust and Node.

```bash
npm --prefix ui ci && npm --prefix ui run build
cargo install --path .
```

## Usage

```bash
snappy-diff                 # default branch vs. current branch
snappy-diff main feature    # main...feature
snappy-diff change.diff     # a .diff / .patch file
git diff | snappy-diff -    # a diff from stdin
```

You can also drop or paste a diff into the page.

`/` searches files, `⌘B` toggles the sidebar.
