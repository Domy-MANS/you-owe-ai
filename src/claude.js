"use strict";
const path = require("node:path");
const os = require("node:os");
const { listFiles, readJsonl } = require("./read");
const P = require("./core/parse");

const DEFAULT_DIR = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "projects");

/** Read Claude Code logs from disk and parse them (see core/parse.js). */
function parseClaude(dir = DEFAULT_DIR) {
  const files = listFiles(dir).map((f) => ({ path: f, records: [...readJsonl(f)] }));
  const history = [...readJsonl(path.join(path.dirname(dir), "history.jsonl"))];
  return P.parseClaude(files, history);
}

module.exports = { parseClaude, isRealPrompt: P.isRealPrompt, DEFAULT_DIR };
