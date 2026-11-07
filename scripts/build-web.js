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
<title>How much do you owe AI?</title>
<meta name="description" content="Your AI just sent you an invoice: emotional damages, noise pollution, night shifts. A roast of your year with Claude Code, Codex and ChatGPT. Runs entirely in your browser.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="You Owe AI">
<meta property="og:title" content="How much do you owe AI? 你欠 AI 多少钱？">
<meta property="og:description" content="Your AI just sent you an invoice. Emotional damages, noise pollution, night shifts, and a politeness discount for every thanks.">
<meta property="og:url" content="https://domy-mans.github.io/you-owe-ai/">
<meta property="og:image" content="https://domy-mans.github.io/you-owe-ai/img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="How much do you owe AI?">
<meta name="twitter:description" content="Your AI just sent you an invoice. A roast of your year with Claude Code, Codex and ChatGPT.">
<meta name="twitter:image" content="https://domy-mans.github.io/you-owe-ai/img/og.jpg">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%A7%BE%3C/text%3E%3C/svg%3E">
<style>${read("src/page/style.css")}
${read("web/landing.css")}</style>
</head>
<body>
<div class="bars" id="bars"></div>
<div class="top"><button class="chip" id="snd" aria-label="Sound"></button><button class="chip" id="lang"></button></div>
<main id="stage"></main>
<div class="hint" id="hint"></div>
<div id="landing"></div>
<script>var VW_DEMO = ${JSON.stringify(demo).replace(/</g, "\\u003c")};</script>
<script>${read("src/core/parse.js")}</script>
<script>${read("src/core/stats.js")}</script>
<script>${read("src/core/roast.js")}</script>
<script>${read("src/core/webchat.js")}</script>
<script>${read("src/page/app.js")}</script>
<script>${read("web/call.js")}</script>
<script>${read("web/picker.js")}</script>
</body>
</html>
`;

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs", "index.html"), html);
console.log(`docs/index.html (${(html.length / 1024).toFixed(0)} KB)`);
