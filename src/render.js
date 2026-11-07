"use strict";
const fs = require("node:fs");
const path = require("node:path");

const PAGE = path.join(__dirname, "page");

// The report may never talk to the network: no fetch, no images from URLs, no forms.
// Enforced by the browser, so it holds even if the page's code were tampered with.
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

/** Build one self-contained HTML file (no network, no external files). */
function renderHtml(stats) {
  const css = fs.readFileSync(path.join(PAGE, "style.css"), "utf8");
  const js = fs.readFileSync(path.join(PAGE, "app.js"), "utf8");
  // JSON inside <script>: escape "<" so a project name can't close the tag
  const data = JSON.stringify(stats).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>You Owe AI ${stats.year}</title>
<style>${css}</style>
</head>
<body>
<div class="bars" id="bars"></div>
<div class="top"><button class="chip" id="snd" aria-label="Sound"></button><button class="chip" id="lang"></button></div>
<main id="stage"></main>
<div class="hint" id="hint"></div>
<script>var DATA = ${data};</script>
<script>${js}</script>
</body>
</html>
`;
}

module.exports = { renderHtml, CSP };
