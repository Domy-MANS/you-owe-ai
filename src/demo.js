"use strict";
const { newSession } = require("./core/parse");

/** Deterministic fake year of activity, for `--demo` and screenshots. It runs up to the start of this month,
    so the published demo (docs/index.html) only changes once a month, not on every build. */
function monthStart(year) { // in January there is no finished month yet: up to today then
  const now = new Date(), m = new Date(now.getFullYear(), now.getMonth(), 1);
  return m.getFullYear() === year && m.getMonth() === 0 ? now : m;
}
function demoData(year, until = monthStart(year)) {
  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const projects = ["portfolio-site", "robot-arm-firmware", "discord-bot", "ml-homework", "dotfiles", "startup-mvp"];
  const claudeTools = ["Bash", "Bash", "Bash", "Edit", "Edit", "Read", "Read", "Write", "Grep", "WebSearch", "Agent"];
  const codexTools = ["exec", "exec", "exec", "apply_patch", "apply_patch", "web_search"];
  const sessions = [], prompts = [];

  for (let day = 0; day < 365; day++) {
    const date = new Date(year, 0, 1 + day);
    if (date.getFullYear() !== year || date >= until) break;
    const busy = (day > 200 ? 0.8 : 0.45) + (date.getDay() === 0 || date.getDay() === 6 ? 0.1 : 0);
    if (rand() > busy) continue;
    const n = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const tool = rand() < 0.62 ? "claude" : "codex";
      const s = newSession(tool, `demo-${day}-${k}`);
      s.project = pick(projects);
      const hour = pick([10, 14, 15, 16, 20, 21, 22, 23, 23, 0, 1, 2]);
      const start = new Date(year, 0, 1 + day, hour, Math.floor(rand() * 60)).getTime();
      const np = 3 + Math.floor(rand() * 25);
      for (let i = 0; i < np; i++) prompts.push({ ts: start + i * 4 * 60000, tool });
      s.start = start;
      s.end = start + np * 4 * 60000;
      s.prompts = np;
      s.workMs = np * (40000 + rand() * 120000);
      for (let i = 0; i < np * 3; i++) {
        const name = pick(tool === "claude" ? claudeTools : codexTools);
        s.tools[name] = (s.tools[name] || 0) + 1;
      }
      s.models[tool === "claude" ? pick(["claude-opus-5-5", "claude-opus-5-5", "claude-sonnet-5-5"]) : "gpt-6-astra"] = np;
      s.tokens = { input: np * 3000, output: np * 1800, cacheRead: np * 90000, cacheWrite: np * 8000 };
      sessions.push(s);
    }
  }
  return { sessions, prompts };
}

function demoRoast() {
  return {
    prompts: 5219,
    you: { deny: 412, again: 97, why: 230, thanks: 61, please: 18, swear: 23, lost: 388, whatNext: 74, lazyYes: 301 },
    ai: { sorry: 156, flatter: 89, done: 1204 },
    catchphrases: [
      { text: "continue", count: 188 },
      { text: "still broken", count: 41 },
      { text: "what next", count: 37 },
      { text: "why is it erroring again", count: 12 },
      { text: "can you hurry up", count: 9 },
    ],
    catchphrases_zh: [
      { text: "继续", count: 188 },
      { text: "还是不行", count: 41 },
      { text: "然后呢", count: 37 },
      { text: "为什么又报错了", count: 12 },
      { text: "能不能快点", count: 9 },
    ],
    angriestDay: { date: "2026-10-07", count: 34 },
    latest: { time: "4:54", day: "2026-08-11" },
    tinyShare: 0.31,
    medianLength: 22,
  };
}

module.exports = { demoData, demoRoast };
