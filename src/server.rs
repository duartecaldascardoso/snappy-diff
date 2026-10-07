//! HTTP API plus the embedded UI.

use std::{path::PathBuf, sync::Arc};

use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};

use crate::git;

#[derive(RustEmbed)]
#[folder = "ui/dist"]
struct Assets;

const IMMUTABLE: &str = "max-age=31536000, immutable";

/// What the server was started with.
pub struct App {
    pub repo: Option<PathBuf>,
    /// Name and contents of a patch given on the command line.
    pub patch: Option<(String, String)>,
    pub base: String,
    /// Empty means the working tree.
    pub head: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Meta {
    mode: &'static str,
    refs: Vec<String>,
    base: String,
    head: String,
    patch_name: Option<String>,
}

#[derive(Deserialize)]
struct Range {
    base: Option<String>,
    /// Empty means the working tree.
    head: Option<String>,
    /// Ignore whitespace changes.
    w: Option<String>,
}

#[derive(Deserialize)]
struct FilePath {
    path: String,
}

pub fn router(app: App) -> Router {
    Router::new()
        .route("/api/meta", get(meta))
        .route("/api/diff", get(diff))
        .route("/api/blob/{oid}", get(blob))
        .route("/api/file", get(file))
        .fallback(asset)
        .with_state(Arc::new(app))
}

fn text(status: StatusCode, body: impl Into<axum::body::Body>) -> Response {
    (status, [(header::CONTENT_TYPE, "text/plain; charset=utf-8")], body.into()).into_response()
}

async fn meta(State(app): State<Arc<App>>) -> Json<Meta> {
    let mode = match (&app.patch, &app.repo) {
        (Some(_), _) => "patch",
        (None, Some(_)) => "git",
        (None, None) => "empty",
    };
    let refs = match &app.repo {
        Some(repo) => git::refs(repo).await,
        None => Vec::new(),
    };
    Json(Meta {
        mode,
        refs,
        base: app.base.clone(),
        head: app.head.clone(),
        patch_name: app.patch.as_ref().map(|(name, _)| name.clone()),
    })
}

/// With `?base=&head=`, diffs the two refs; without, returns the CLI's patch.
async fn diff(State(app): State<Arc<App>>, Query(range): Query<Range>) -> Response {
    let result = match (range, &app.repo, &app.patch) {
        (Range { base: Some(base), head: Some(head), w }, Some(repo), _) => {
            let head = (!head.is_empty()).then_some(head.as_str());
            git::diff(repo, &base, head, w.is_some()).await
        }
        (Range { base: None, head: None, .. }, _, Some((_, patch))) => Ok(patch.clone().into_bytes()),
        _ => Err("nothing to diff".into()),
    };
    match result {
        Ok(patch) => text(StatusCode::OK, patch),
        Err(e) => text(StatusCode::BAD_REQUEST, e),
    }
}

async fn blob(State(app): State<Arc<App>>, Path(oid): Path<String>) -> Response {
    let Some(repo) = &app.repo else {
        return text(StatusCode::NOT_FOUND, "not a git repository");
    };
    match git::blob(repo, &oid).await {
        // A blob never changes for a given id.
        Ok(contents) => ([(header::CACHE_CONTROL, IMMUTABLE)], text(StatusCode::OK, contents)).into_response(),
        Err(e) => text(StatusCode::NOT_FOUND, e),
    }
}

async fn file(State(app): State<Arc<App>>, Query(FilePath { path }): Query<FilePath>) -> Response {
    let Some(repo) = &app.repo else {
        return text(StatusCode::NOT_FOUND, "not a git repository");
    };
    match git::worktree_file(repo, &path).await {
        Ok(contents) => text(StatusCode::OK, contents),
        Err(e) => text(StatusCode::NOT_FOUND, e),
    }
}

async fn asset(uri: Uri) -> Response {
    let path = match uri.path().trim_start_matches('/') {
        "" => "index.html",
        path => path,
    };
    let Some(file) = Assets::get(path) else {
        return text(StatusCode::NOT_FOUND, "not found");
    };
    // Vite fingerprints everything under assets/.
    let cache = if path.starts_with("assets/") { IMMUTABLE } else { "no-cache" };
    let mime = mime_guess::from_path(path).first_or_octet_stream();
    ([(header::CONTENT_TYPE, mime.as_ref()), (header::CACHE_CONTROL, cache)], file.data).into_response()
}
