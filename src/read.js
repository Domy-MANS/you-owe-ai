"use strict";
const fs = require("node:fs");
const path = require("node:path");

/** Recursively list files ending with `ext` under `dir` (missing dir → []). */
function listFiles(dir, ext = ".jsonl") {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p, ext));
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

/** Yield parsed JSON objects from a .jsonl file, skipping broken lines. */
function* readJsonl(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line);
    } catch {
      /* partial line from a live session */
    }
  }
}

module.exports = { listFiles, readJsonl };
