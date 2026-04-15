#!/usr/bin/env node
/**
 * strip-comments.mjs
 *
 * Smart comment removal for TypeScript/TSX, CSS, and Rust files.
 * Uses character-level state machines — never touches comment-like text
 * inside string literals, template expressions, or raw strings.
 *
 * Usage:
 *   node strip-comments.mjs [--dry-run] [paths...]
 *
 *   node strip-comments.mjs                          # default: src/ + src-tauri/src/
 *   node strip-comments.mjs src/components           # specific dir
 *   node strip-comments.mjs src/foo.ts               # single file
 *   node strip-comments.mjs --dry-run src/           # preview only, no writes
 *
 * Language rules:
 *   TS / TSX  removes  //  line comments
 *             removes  /* ... *\/  block comments
 *             SKIPS    '' "" ``  string + template literals (full expression depth)
 *
 *   CSS       removes  /* ... *\/  block comments  (no // in standard CSS)
 *             SKIPS    '' ""  string values
 *             SKIPS    url(...)  tokens to avoid breaking data URIs
 *
 *   Rust      removes  //  line comments
 *             removes  /* ... *\/  block comments  (supports Rust nested blocks)
 *             PRESERVES  ///  ///!  //!  outer/inner doc comments (rustdoc)
 *             PRESERVES  /** ... *\/  /*! ... *\/  block doc comments
 *             SKIPS    "..."  string literals
 *             SKIPS    r#"..."#  raw string literals (any hash depth)
 *
 * Post-processing (all languages):
 *   - Trailing whitespace stripped from every line
 *   - 3+ consecutive blank lines collapsed to 2
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname, relative, resolve } from "path";

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const inputPaths = args.filter((a) => !a.startsWith("--"));
const roots = inputPaths.length
  ? inputPaths.map((p) => resolve(p))
  : [resolve("src"), resolve("src-tauri/src")];

// ─── File walker ──────────────────────────────────────────────────────────────

const SUPPORTED = new Set([".ts", ".tsx", ".css", ".rs"]);

function walk(dir, files = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return files; }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "target" || entry === ".git") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (SUPPORTED.has(extname(full))) files.push(full);
  }
  return files;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Post-process: strip trailing whitespace, collapse blank lines. */
function tidy(src) {
  return src
    .replace(/[^\S\n]+$/gm, "")   // trailing spaces/tabs per line
    .replace(/\n{4,}/g, "\n\n\n"); // 3+ blank lines → 2
}

// ─── TypeScript / TSX ─────────────────────────────────────────────────────────
//
// State machine processes the char stream, emitting to `out`.
// Recursive for template expression depth (${...} inside backticks).
//
function stripTs(src) {
  const out = [];
  let i = 0;
  const n = src.length;

  const cur = () => src[i];
  const peek = (d = 1) => (i + d < n ? src[i + d] : "");

  // Returns true and advances i if the two-char sequence matches
  function eat2(a, b) {
    if (cur() === a && peek() === b) { i += 2; return true; }
    return false;
  }

  // Process code until end or until the given stop condition returns true.
  // `stopAt` is called with current char and returns boolean.
  // Used for template expressions so we can stop at the matching '}'.
  function process(stopAt = null, braceDepth = 0) {
    while (i < n) {
      if (stopAt) {
        if (cur() === "{") { braceDepth++; }
        if (cur() === "}") {
          if (braceDepth === 0) return; // caller handles }
          braceDepth--;
        }
      }

      // ── Single-quoted string ──────────────────────────────────────────
      if (cur() === "'") {
        out.push("'"); i++;
        while (i < n) {
          if (cur() === "\\") { out.push(cur()); i++; if (i < n) { out.push(cur()); i++; } continue; }
          if (cur() === "'") { out.push(cur()); i++; break; }
          out.push(cur()); i++;
        }
        continue;
      }

      // ── Double-quoted string ──────────────────────────────────────────
      if (cur() === '"') {
        out.push('"'); i++;
        while (i < n) {
          if (cur() === "\\") { out.push(cur()); i++; if (i < n) { out.push(cur()); i++; } continue; }
          if (cur() === '"') { out.push(cur()); i++; break; }
          out.push(cur()); i++;
        }
        continue;
      }

      // ── Template literal ─────────────────────────────────────────────
      if (cur() === "`") {
        out.push("`"); i++;
        while (i < n) {
          if (cur() === "\\") { out.push(cur()); i++; if (i < n) { out.push(cur()); i++; } continue; }
          if (cur() === "`") { out.push(cur()); i++; break; }
          // Template expression ${ ... }
          if (cur() === "$" && peek() === "{") {
            out.push("$"); out.push("{"); i += 2;
            process(true, 0); // recursive: stop at matching }
            if (i < n && cur() === "}") { out.push("}"); i++; }
            continue;
          }
          out.push(cur()); i++;
        }
        continue;
      }

      // ── Triple-slash directive  ///  — PRESERVE (TS reference comments) ──
      if (cur() === "/" && peek(1) === "/" && peek(2) === "/") {
        while (i < n && cur() !== "\n") { out.push(cur()); i++; }
        continue;
      }

      // ── Line comment  //  ─────────────────────────────────────────────
      if (cur() === "/" && peek() === "/") {
        // Consume everything up to (but not including) the newline
        while (i < n && cur() !== "\n") i++;
        // The \n itself is left in place (loop will emit it next iteration)
        continue;
      }

      // ── Block comment  /* ... */  ─────────────────────────────────────
      // Special case: {/* comment */} is a JSX comment — remove the braces too.
      if (cur() === "/" && peek() === "*") {
        const isJsxComment = out.length > 0 && out[out.length - 1] === "{";
        i += 2; // skip /*
        while (i < n) {
          if (cur() === "*" && peek() === "/") { i += 2; break; }
          i++;
        }
        // If the next non-space char closes the JSX expression, drop both braces.
        if (isJsxComment) {
          let j = i;
          while (j < n && (src[j] === " " || src[j] === "\t")) j++;
          if (j < n && src[j] === "}") {
            out.pop(); // remove the opening {
            i = j + 1; // skip closing }
          }
        }
        continue;
      }

      out.push(cur()); i++;
    }
  }

  process();
  return tidy(out.join(""));
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
//
// Standard CSS has only /* */ comments. Skips string values and url() tokens.
//
function stripCss(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  const cur = () => src[i];
  const peek = (d = 1) => (i + d < n ? src[i + d] : "");

  while (i < n) {
    // ── Quoted string  " or ' ──────────────────────────────────────────
    if (cur() === '"' || cur() === "'") {
      const q = cur();
      out.push(cur()); i++;
      while (i < n) {
        if (cur() === "\\") { out.push(cur()); i++; if (i < n) { out.push(cur()); i++; } continue; }
        if (cur() === q) { out.push(cur()); i++; break; }
        out.push(cur()); i++;
      }
      continue;
    }

    // ── url() token — pass through raw until closing ) ────────────────
    // Handles url(https://...) data URIs without misreading slashes.
    if (
      cur() === "u" && peek(1) === "r" && peek(2) === "l" && peek(3) === "("
    ) {
      out.push("u"); out.push("r"); out.push("l"); out.push("("); i += 4;
      // url() may or may not be quoted; pass through until )
      while (i < n && cur() !== ")") { out.push(cur()); i++; }
      if (i < n) { out.push(cur()); i++; } // closing )
      continue;
    }

    // ── Block comment  /* ... */ ──────────────────────────────────────
    if (cur() === "/" && peek() === "*") {
      i += 2;
      while (i < n) {
        if (cur() === "*" && peek() === "/") { i += 2; break; }
        i++;
      }
      continue;
    }

    out.push(cur()); i++;
  }

  return tidy(out.join(""));
}

// ─── Rust ─────────────────────────────────────────────────────────────────────
//
// Rust has nested block comments and three doc-comment forms to preserve:
//   ///  outer line doc
//   //!  inner line doc
//   /** outer block doc
//   /*! inner block doc
//
// Also handles raw strings:  r"..."  r#"..."#  r##"..."##  etc.
//
function stripRust(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  const cur = () => src[i];
  const peek = (d = 1) => (i + d < n ? src[i + d] : "");
  const slice = (len) => src.slice(i, i + len);

  while (i < n) {
    // ── Double-quoted string ──────────────────────────────────────────
    if (cur() === '"') {
      out.push('"'); i++;
      while (i < n) {
        if (cur() === "\\") { out.push(cur()); i++; if (i < n) { out.push(cur()); i++; } continue; }
        if (cur() === '"') { out.push(cur()); i++; break; }
        out.push(cur()); i++;
      }
      continue;
    }

    // ── Raw string  r"..."  r#"..."#  r##"..."## ──────────────────────
    if (cur() === "r" && (peek() === '"' || peek() === "#")) {
      // Count leading hashes
      let h = 0;
      let j = i + 1;
      while (j < n && src[j] === "#") { h++; j++; }
      if (j < n && src[j] === '"') {
        // It's a raw string — copy verbatim until the matching closing "###...
        const close = '"' + "#".repeat(h);
        const startLen = 1 + h + 1; // r + hashes + opening "
        for (let k = 0; k < startLen; k++) { out.push(src[i]); i++; }
        while (i < n) {
          if (slice(close.length) === close) {
            for (let k = 0; k < close.length; k++) { out.push(src[i]); i++; }
            break;
          }
          out.push(cur()); i++;
        }
        continue;
      }
    }

    // ── Doc line comment  ///  or  //!  — PRESERVE ───────────────────
    if (cur() === "/" && peek(1) === "/" && (peek(2) === "/" || peek(2) === "!")) {
      while (i < n && cur() !== "\n") { out.push(cur()); i++; }
      continue;
    }

    // ── Regular line comment  //  — REMOVE ───────────────────────────
    if (cur() === "/" && peek() === "/") {
      while (i < n && cur() !== "\n") i++;
      continue;
    }

    // ── Doc block comment  /**  or  /*!  — PRESERVE ──────────────────
    if (cur() === "/" && peek() === "*" && (peek(2) === "*" || peek(2) === "!")) {
      // Copy including nested /* */ pairs (Rust allows nesting)
      let depth = 1;
      out.push(cur()); i++; // /
      out.push(cur()); i++; // *
      while (i < n && depth > 0) {
        if (cur() === "/" && peek() === "*") {
          depth++;
          out.push(cur()); i++;
          out.push(cur()); i++;
          continue;
        }
        if (cur() === "*" && peek() === "/") {
          depth--;
          out.push(cur()); i++;
          out.push(cur()); i++;
          continue;
        }
        out.push(cur()); i++;
      }
      continue;
    }

    // ── Block comment  /* ... */  — REMOVE (supports nesting) ─────────
    if (cur() === "/" && peek() === "*") {
      i += 2; // skip /*
      let depth = 1;
      while (i < n && depth > 0) {
        if (cur() === "/" && peek() === "*") { depth++; i += 2; continue; }
        if (cur() === "*" && peek() === "/") { depth--; i += 2; continue; }
        i++;
      }
      continue;
    }

    out.push(cur()); i++;
  }

  return tidy(out.join(""));
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

function stripFile(src, ext) {
  switch (ext) {
    case ".ts":
    case ".tsx":  return stripTs(src);
    case ".css":  return stripCss(src);
    case ".rs":   return stripRust(src);
    default:      return src;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let files = [];
for (const root of roots) {
  try {
    const stat = statSync(root);
    if (stat.isDirectory()) walk(root, files);
    else if (SUPPORTED.has(extname(root))) files.push(root);
  } catch (e) {
    console.error(`  ✗  cannot access ${root}: ${e.message}`);
  }
}

if (files.length === 0) {
  console.log("No supported files found.");
  process.exit(0);
}

let changed = 0;
let skipped = 0;
let errored = 0;

const cwd = process.cwd();

for (const file of files) {
  try {
    const original = readFileSync(file, "utf8");
    const stripped = stripFile(original, extname(file));
    const rel = relative(cwd, file);

    if (stripped === original) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  ~  ${rel}  (would change)`);
    } else {
      writeFileSync(file, stripped, "utf8");
      console.log(`  ✓  ${rel}`);
    }
    changed++;
  } catch (e) {
    console.error(`  ✗  ${relative(cwd, file)}: ${e.message}`);
    errored++;
  }
}

console.log(
  `\n${dryRun ? "[dry-run] " : ""}${changed} file(s) ${dryRun ? "would change" : "changed"}, ` +
  `${skipped} unchanged, ${errored} error(s).`
);
