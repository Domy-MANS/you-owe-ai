"use strict";
const path = require("node:path");
const os = require("node:os");
const { listFiles, readJsonl } = require("./read");
const P = require("./core/parse");

const DEFAULT_DIR = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "sessions");

/** Read Codex rollout logs from disk and parse them (see core/parse.js). Archived sessions count too, as on the web page. */
function parseCodex(dir = DEFAULT_DIR) {
  const archived = path.join(path.dirname(dir), "archived_sessions");
  const files = [...listFiles(dir), ...listFiles(archived)].map((f) => ({ path: f, records: [...readJsonl(f)] }));
  return P.parseCodex(files);
}

module.exports = { parseCodex, DEFAULT_DIR };
