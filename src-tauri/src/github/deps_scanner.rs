use serde::{Deserialize, Serialize};
use crate::models::AppError;
use super::build_client;
use base64::{engine::general_purpose, Engine};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dependency {
    pub name: String,
    pub version: String,
    pub ecosystem: String,
    pub dev: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoDependencies {
    pub repo_full_name: String,
    pub dependencies: Vec<Dependency>,
    pub files_found: Vec<String>,
}

#[derive(Deserialize)]
struct ContentRaw {
    content: Option<String>,
    encoding: Option<String>,
}

async fn fetch_file(client: &reqwest::Client, owner: &str, repo: &str, path: &str) -> Option<String> {
    let url = format!("https://api.github.com/repos/{}/{}/contents/{}", owner, repo, path);
    let resp = client.get(&url).send().await.ok()?;
    if !resp.status().is_success() { return None; }
    let raw: ContentRaw = resp.json().await.ok()?;
    if raw.encoding.as_deref() != Some("base64") { return None; }
    let clean = raw.content?.replace('\n', "").replace('\r', "");
    let bytes = general_purpose::STANDARD.decode(&clean).ok()?;
    String::from_utf8(bytes).ok()
}

fn parse_package_json(content: &str) -> Vec<Dependency> {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(content) else { return vec![] };
    let mut deps = Vec::new();
    for (key, is_dev) in [("dependencies", false), ("devDependencies", true)] {
        if let Some(obj) = v.get(key).and_then(|d| d.as_object()) {
            for (name, ver) in obj {
                let v = ver.as_str().unwrap_or("*")
                    .trim_start_matches(['^', '~', '>', '<', '=', ' '])
                    .to_string();
                deps.push(Dependency { name: name.clone(), version: v, ecosystem: "npm".into(), dev: is_dev });
            }
        }
    }
    deps
}

fn parse_cargo_toml(content: &str) -> Vec<Dependency> {
    let Ok(value) = content.parse::<toml::Value>() else { return vec![] };
    let mut deps = Vec::new();
    for (table, is_dev) in [("dependencies", false), ("dev-dependencies", true), ("build-dependencies", false)] {
        if let Some(tbl) = value.get(table).and_then(|t| t.as_table()) {
            for (name, val) in tbl {
                let version = match val {
                    toml::Value::String(s) => s.trim_start_matches(['^', '~', '>', '<', '=', ' ']).to_string(),
                    toml::Value::Table(t) => t.get("version")
                        .and_then(|v| v.as_str())
                        .unwrap_or("*")
                        .trim_start_matches(['^', '~', '>', '<', '=', ' '])
                        .to_string(),
                    _ => "*".into(),
                };
                deps.push(Dependency { name: name.clone(), version, ecosystem: "cargo".into(), dev: is_dev });
            }
        }
    }
    deps
}

fn parse_requirements_txt(content: &str) -> Vec<Dependency> {
    content.lines().filter_map(|line| {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with('-') { return None; }
        let (name, version) = if let Some(pos) = line.find(['=', '>', '<', '!', '~']) {
            let ver = line[pos..].trim_start_matches(['=', '>', '<', '!', '~', ' ']).to_string();
            (line[..pos].trim().to_string(), ver)
        } else {
            (line.to_string(), "*".to_string())
        };
        if name.is_empty() { return None; }
        Some(Dependency { name, version, ecosystem: "pip".into(), dev: false })
    }).collect()
}

fn parse_go_mod(content: &str) -> Vec<Dependency> {
    let mut in_require = false;
    let mut deps = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "require (" { in_require = true; continue; }
        if trimmed == ")" { in_require = false; continue; }
        if in_require || trimmed.starts_with("require ") {
            let parts: Vec<&str> = trimmed.trim_start_matches("require ").split_whitespace().collect();
            if parts.len() >= 2 {
                let name = parts[0].to_string();
                let version = parts[1].trim_start_matches('v').to_string();
                if name.contains('/') || name.contains('.') {
                    deps.push(Dependency { name, version, ecosystem: "go".into(), dev: false });
                }
            }
        }
    }
    deps
}

fn extract_xml_tag(line: &str, tag: &str) -> Option<String> {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    let start = line.find(&open)? + open.len();
    let end = line.find(&close)?;
    if end > start { Some(line[start..end].to_string()) } else { None }
}

fn parse_pom_xml(content: &str) -> Vec<Dependency> {
    let mut deps = Vec::new();
    let mut in_dep = false;
    let mut group = String::new();
    let mut artifact = String::new();
    let mut version = String::new();
    let mut scope = String::new();
    for line in content.lines() {
        let t = line.trim();
        if t == "<dependency>" { in_dep = true; group.clear(); artifact.clear(); version.clear(); scope.clear(); continue; }
        if t == "</dependency>" && in_dep {
            if !artifact.is_empty() {
                let name = if group.is_empty() { artifact.clone() } else { format!("{}:{}", group, artifact) };
                deps.push(Dependency { name, version: if version.is_empty() { "*".into() } else { version.clone() }, ecosystem: "maven".into(), dev: scope == "test" });
            }
            in_dep = false;
            continue;
        }
        if in_dep {
            if let Some(v) = extract_xml_tag(t, "groupId") { group = v; }
            if let Some(v) = extract_xml_tag(t, "artifactId") { artifact = v; }
            if let Some(v) = extract_xml_tag(t, "version") { if !v.starts_with("${") { version = v; } }
            if let Some(v) = extract_xml_tag(t, "scope") { scope = v; }
        }
    }
    deps
}

type ParseFn = fn(&str) -> Vec<Dependency>;

const MANIFESTS: &[(&str, ParseFn)] = &[
    ("package.json", parse_package_json),
    ("Cargo.toml", parse_cargo_toml),
    ("requirements.txt", parse_requirements_txt),
    ("go.mod", parse_go_mod),
    ("pom.xml", parse_pom_xml),
];

pub async fn scan_repo(token: &str, owner: &str, repo: &str) -> Result<RepoDependencies, AppError> {
    let client = build_client(token)?;
    let mut all_deps = Vec::new();
    let mut files_found = Vec::new();


    let has_pnpm = fetch_file(&client, owner, repo, "pnpm-lock.yaml").await.is_some();
    let has_yarn = !has_pnpm && fetch_file(&client, owner, repo, "yarn.lock").await.is_some();
    let npm_ecosystem = if has_pnpm { "pnpm" } else if has_yarn { "yarn" } else { "npm" };

    for (file, parser) in MANIFESTS {
        if let Some(content) = fetch_file(&client, owner, repo, file).await {
            files_found.push(file.to_string());
            let mut parsed = parser(&content);

            if *file == "package.json" && npm_ecosystem != "npm" {
                for dep in &mut parsed {
                    dep.ecosystem = npm_ecosystem.to_string();
                }
            }
            all_deps.extend(parsed);
        }
    }
    Ok(RepoDependencies {
        repo_full_name: format!("{}/{}", owner, repo),
        dependencies: all_deps,
        files_found,
    })
}
