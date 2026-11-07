#!/usr/bin/env node
"use strict";
// Builds docs/index.html: one self-contained page for GitHub Pages.
// Same parsing/stats/report code as the CLI, plus a folder picker.
const fs = require("node:fs");
const path = require("node:path");
const { computeStats } = require("../src/core/stats");
const { demoData, demoRoast } = require("../src/demo");
const { CSP } = require("../src/render");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const year = new Date().getFullYear();
const demo = computeStats(demoData(year), { year });
demo.roast = demoRoast();
demo.demo = true;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>Vibe Wrapped: your year of AI coding</title>
<meta name="description" content="Spotify-Wrapped for Claude Code and Codex. Runs entirely in your browser.">
<style>${read("src/page/style.css")}
${read("web/landing.css")}</style>
</head>
<body>
<div class="bars" id="bars"></div>
<div class="top"><button class="chip" id="lang"></button></div>
<main id="stage"></main>
<div class="hint" id="hint"></div>
<div id="landing"></div>
<script>var VW_DEMO = ${JSON.stringify(demo).replace(/</g, "\\u003c")};</script>
<script>${read("src/core/parse.js")}</script>
<script>${read("src/core/stats.js")}</script>
<script>${read("src/core/roast.js")}</script>
<script>${read("src/page/app.js")}</script>
<script>${read("web/picker.js")}</script>
</body>
</html>
`;

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs", "index.html"), html);
console.log(`docs/index.html (${(html.length / 1024).toFixed(0)} KB)`);
