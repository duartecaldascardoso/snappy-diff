//! Hands URLs to the operating system: the browser at startup, editors later.

use std::{path::Path, process::Stdio};

/// Opens a URL with the system's default handler.
pub fn open(url: &str) {
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

/// Percent-encodes a path for a URL, keeping its separators readable.
fn encode(path: &str) -> String {
    let mut out = String::with_capacity(path.len());
    for b in path.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' | b':' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// The link that opens `file` at `line` in an editor, which the OS routes to
/// the app without the browser asking first.
pub fn editor_url(editor: &str, file: &Path, line: u32) -> Option<String> {
    // Windows paths become /C:/… like URLs expect.
    let mut path = file.to_string_lossy().replace('\\', "/");
    if !path.starts_with('/') {
        path.insert(0, '/');
    }
    let path = encode(&path);
    Some(match editor {
        "vscode" | "cursor" | "windsurf" | "zed" => format!("{editor}://file{path}:{line}"),
        "idea" => format!("idea://open?file={path}&line={line}"),
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn editor_links() {
        let file = Path::new("/Users/me/my repo/src/a b.rs");
        assert_eq!(editor_url("vscode", file, 12).unwrap(), "vscode://file/Users/me/my%20repo/src/a%20b.rs:12");
        assert_eq!(editor_url("zed", file, 3).unwrap(), "zed://file/Users/me/my%20repo/src/a%20b.rs:3");
        assert_eq!(editor_url("idea", file, 7).unwrap(), "idea://open?file=/Users/me/my%20repo/src/a%20b.rs&line=7");
        assert_eq!(editor_url("vscode", Path::new(r"C:\code\x.rs"), 1).unwrap(), "vscode://file/C:/code/x.rs:1");
        assert!(editor_url("notepad", file, 1).is_none());
    }
}
