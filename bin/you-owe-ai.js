#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { parseClaude } = require("../src/claude");
const { parseCodex } = require("../src/codex");
const { computeStats } = require("../src/core/stats");
const { renderHtml } = require("../src/render");
const { demoData, demoRoast } = require("../src/demo");
const { collectPrompts, collectReplies, computeRoast } = require("../src/roast");

const HELP = `you-owe-ai — your year of AI coding, Spotify-Wrapped style.
Reads Claude Code (~/.claude/projects) and Codex (~/.codex/sessions) logs locally.
Everything stays on your machine. The report can't make network requests.

Usage: npx github:Domy-MANS/you-owe-ai [options]

  --year <yyyy>     Year to summarize (default: this year)
  --out <file>      Where to write the HTML (default: ./you-owe-ai-<year>.html)
  --demo            Use made-up data (to preview without any logs)
  --hide-projects   Leave project names out of the report
  --no-text         Don't scan prompt text (skips catchphrases and the roast)
  --json            Print the stats as JSON instead of writing HTML
  --no-open         Don't open the report in the browser
  -h, --help        Show this help
`;

function parseArgs(argv) {
  const o = { year: new Date().getFullYear(), open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") o.help = true;
    else if (a === "--year") o.year = parseInt(argv[++i], 10);
    else if (a === "--out") o.out = argv[++i];
    else if (a === "--demo") o.demo = true;
    else if (a === "--hide-projects") o.hideProjects = true;
    else if (a === "--no-text") o.noText = true;
    else if (a === "--json") o.json = true;
    else if (a === "--no-open") o.open = false;
    else throw new Error(`Unknown option: ${a} (see --help)`);
  }
  if (!Number.isInteger(o.year)) throw new Error("--year needs a 4-digit year");
  return o;
}

function openFile(file) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", file] : [file];
  execFile(cmd, args, () => {});
}

function main() {
  let o;
  try {
    o = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  if (o.help) return console.log(HELP);

  let data;
  if (o.demo) data = demoData(o.year);
  else {
    const c = parseClaude(), x = parseCodex();
    data = { sessions: [...c.sessions, ...x.sessions], prompts: [...c.prompts, ...x.prompts] };
  }
  const stats = computeStats(data, { year: o.year });
  stats.demo = !!o.demo;
  if (o.hideProjects) stats.topProjects = [];
  stats.roast = o.noText ? null : o.demo ? demoRoast() : computeRoast(collectPrompts(), collectReplies(), { year: o.year });

  if (o.json) return console.log(JSON.stringify(stats, null, 2));

  const out = path.resolve(o.out || `you-owe-ai-${o.year}.html`);
  fs.writeFileSync(out, renderHtml(stats));
  const tilde = out.replace(os.homedir(), "~");
  console.log(
    stats.empty
      ? `No Claude Code or Codex activity found for ${o.year}. Try --demo to preview.\n→ ${tilde}`
      : `✨ ${stats.prompts} prompts · ${stats.sessions} sessions · ${stats.activeDays} active days\n→ ${tilde}`
  );
  if (o.open) openFile(out);
}

main();
