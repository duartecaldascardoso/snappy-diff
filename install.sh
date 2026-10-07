#!/bin/sh
# Installs the latest snappy-diff release for macOS or Linux.
#   curl -fsSL https://raw.githubusercontent.com/duartecaldascardoso/snappy-diff/main/install.sh | sh
set -eu

repo="duartecaldascardoso/snappy-diff"
dir="${SNAPPY_DIFF_DIR:-$HOME/.local/bin}"

case "$(uname -s)" in
  Darwin) os="apple-darwin" ;;
  Linux) os="unknown-linux-musl" ;;
  *) echo "snappy-diff: unsupported OS $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch="x86_64" ;;
  arm64 | aarch64) arch="aarch64" ;;
  *) echo "snappy-diff: unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac

mkdir -p "$dir"
curl -fsSL "https://github.com/$repo/releases/latest/download/snappy-diff-$arch-$os.tar.gz" | tar -xz -C "$dir"
echo "Installed snappy-diff to $dir"

case ":$PATH:" in
  *":$dir:"*) ;;
  *) echo "Add it to your PATH:  export PATH=\"$dir:\$PATH\"" ;;
esac
