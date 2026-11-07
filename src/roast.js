"use strict";
// Node side of the roast: read the history files from disk, then hand off to core.
const path = require("node:path");
const os = require("node:os");
const { listFiles, readJsonl } = require("./read");
const P = require("./core/parse");
const { computeRoast, isCatchphrase, YOU, AI } = require("./core/roast");

const CLAUDE_HOME = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const load = (files) => files.map((f) => ({ path: f, records: [...readJsonl(f)] }));

function collectPrompts(claudeHome = CLAUDE_HOME, codexHome = CODEX_HOME) {
  return P.promptTexts([...readJsonl(path.join(claudeHome, "history.jsonl"))], [...readJsonl(path.join(codexHome, "history.jsonl"))]);
}

function collectReplies(claudeHome = CLAUDE_HOME, codexHome = CODEX_HOME) {
  return P.replyTexts(load(listFiles(path.join(claudeHome, "projects"))), load(listFiles(path.join(codexHome, "sessions"))));
}

module.exports = { collectPrompts, collectReplies, computeRoast, isCatchphrase, YOU, AI };
