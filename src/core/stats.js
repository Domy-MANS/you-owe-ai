(function (root) {
"use strict";

const CATEGORIES = {
  shell: ["Bash", "exec", "shell", "local_shell", "exec_command", "write_stdin", "BashOutput", "KillShell", "Monitor"],
  edit: ["Edit", "Write", "MultiEdit", "NotebookEdit", "apply_patch"],
  read: ["Read", "Grep", "Glob", "LS", "view_image", "read_file", "list_dir", "grep_files"],
  web: ["WebSearch", "WebFetch", "web_search", "web_fetch"],
  agents: ["Agent", "Task", "spawn_agent", "SendMessage"],
};

// polling / bookkeeping calls that aren't real work
const IGNORED_TOOLS = new Set(["wait", "TodoWrite", "update_plan", "ToolSearch"]);

function categoryOf(tool) {
  for (const [cat, names] of Object.entries(CATEGORIES)) if (names.includes(tool)) return cat;
  if (/^mcp__/.test(tool)) return "mcp";
  return "other";
}

const pad = (n) => String(n).padStart(2, "0");
function localDay(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addTo(obj, key, n = 1) {
  obj[key] = (obj[key] || 0) + n;
}

function topN(obj, n) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

function longestStreak(daySet) {
  const days = [...daySet].sort();
  let best = 0, cur = 0, prev = null, bestEnd = null;
  for (const d of days) {
    const t = Date.parse(d + "T12:00:00");
    cur = prev !== null && Math.round((t - prev) / 86400000) === 1 ? cur + 1 : 1;
    if (cur > best) { best = cur; bestEnd = d; }
    prev = t;
  }
  return { days: best, end: bestEnd };
}

const PERSONAS = [
  { id: "night", test: (x) => x.nightShare >= 0.4 },
  { id: "dawn", test: (x) => x.dawnShare >= 0.3 },
  { id: "weekend", test: (x) => x.weekendShare >= 0.4 },
  { id: "dual", test: (x) => x.minToolShare >= 0.25 },
  { id: "terminal", test: (x) => x.cat.shell >= 0.5 },
  { id: "sculptor", test: (x) => x.cat.edit >= 0.35 },
  { id: "researcher", test: (x) => x.cat.web >= 0.15 },
  { id: "steady", test: () => true },
];

/**
 * Turn parsed sessions + prompts into the numbers the report shows.
 * Filters to `year` by local time.
 */
function computeStats({ sessions, prompts }, { year }) {
  const inYear = (ts) => new Date(ts).getFullYear() === year;
  sessions = sessions.filter((s) => inYear(s.start));
  prompts = prompts.filter((p) => !Number.isNaN(p.ts) && inYear(p.ts));

  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  // claude/codex always present; other sources (chatgpt, claudeai) appear when imported
  const byTool = {
    claude: { sessions: 0, prompts: 0, tokens: 0 },
    codex: { sessions: 0, prompts: 0, tokens: 0 },
  };
  const tools = {}, cats = {}, models = {}, projects = {};
  let workMs = 0;
  let biggest = null;

  for (const s of sessions) {
    for (const k of Object.keys(tokens)) tokens[k] += s.tokens[k];
    const t = byTool[s.tool] || (byTool[s.tool] = { sessions: 0, prompts: 0, tokens: 0 });
    t.sessions++;
    t.tokens += s.tokens.input + s.tokens.output + s.tokens.cacheRead + s.tokens.cacheWrite;
    workMs += s.workMs;
    for (const [name, n] of Object.entries(s.tools)) {
      if (IGNORED_TOOLS.has(name)) continue;
      addTo(tools, name, n);
      addTo(cats, categoryOf(name), n);
    }
    for (const [m, n] of Object.entries(s.models)) addTo(models, m, n);
    if (s.project) addTo(projects, s.project, Math.max(1, s.prompts));
    if (!biggest || s.prompts > biggest.prompts) biggest = s;
  }

  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  const days = {};
  for (const p of prompts) {
    const d = new Date(p.ts);
    hours[d.getHours()]++;
    weekdays[d.getDay()]++;
    addTo(days, localDay(p.ts));
    (byTool[p.tool] || (byTool[p.tool] = { sessions: 0, prompts: 0, tokens: 0 })).prompts++;
  }

  const totalPrompts = prompts.length;
  const share = (n) => (totalPrompts ? n / totalPrompts : 0);
  const nightShare = share([22, 23, 0, 1, 2, 3, 4].reduce((a, h) => a + hours[h], 0));
  const dawnShare = share([5, 6, 7, 8].reduce((a, h) => a + hours[h], 0));
  const weekendShare = share(weekdays[0] + weekdays[6]);
  const totalCalls = Object.values(cats).reduce((a, b) => a + b, 0);
  const cat = {};
  for (const k of [...Object.keys(CATEGORIES), "mcp", "other"]) cat[k] = totalCalls ? (cats[k] || 0) / totalCalls : 0;
  const minToolShare = Math.min(share(byTool.claude.prompts), share(byTool.codex.prompts));
  const persona = PERSONAS.find((p) => p.test({ nightShare, dawnShare, weekendShare, minToolShare, cat })).id;

  const busiest = topN(days, 1)[0] || null;
  const peakHour = hours.indexOf(Math.max(...hours));
  const streak = longestStreak(new Set(Object.keys(days)));

  return {
    year,
    empty: totalPrompts === 0 && sessions.length === 0,
    firstDay: Object.keys(days).sort()[0] || null,
    sessions: sessions.length,
    prompts: totalPrompts,
    workHours: workMs / 3600000,
    tokens,
    totalTokens: tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite,
    byTool,
    toolCalls: totalCalls,
    topTools: topN(tools, 5),
    categories: topN(cats, 6),
    topModels: topN(models, 4),
    topProjects: topN(projects, 5),
    hours,
    weekdays,
    days,
    activeDays: Object.keys(days).length,
    busiestDay: busiest ? { date: busiest.name, prompts: busiest.count } : null,
    peakHour: totalPrompts ? peakHour : null,
    streak,
    biggestSession: biggest ? { project: biggest.project, prompts: biggest.prompts, tool: biggest.tool } : null,
    shares: { night: nightShare, dawn: dawnShare, weekend: weekendShare },
    persona,
  };
}

/**
 * Which year to bill when none is given. Wrapped season runs into January,
 * so early in the year, bill last year if it has more activity.
 */
function defaultYear(prompts, now = new Date()) {
  const y = now.getFullYear();
  if (now.getMonth() > 1) return y;
  let cur = 0, prev = 0;
  for (const p of prompts) { const py = new Date(p.ts).getFullYear(); if (py === y) cur++; else if (py === y - 1) prev++; }
  return prev > cur ? y - 1 : y;
}

var api = { computeStats, categoryOf, longestStreak, localDay, defaultYear };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.VWStats = api;
})(typeof self !== "undefined" ? self : this);
