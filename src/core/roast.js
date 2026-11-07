/** Turn prompt text into counts and short repeated phrases. Runs in Node and the browser. */
(function (root) {
"use strict";
var localDay = typeof module !== "undefined" && module.exports ? require("./stats").localDay : root.VWStats.localDay;

const YOU = {
  deny: /不对|不是这样|不是这个|不行|错了|没用|\bno\b|\bwrong\b|not working|doesn'?t work|didn'?t work/i,
  again: /还是不行|还是不对|还是有问题|又报错|又错|\bstill\b|\bagain\b/i,
  why: /为什么|为啥|\bwhy\b|\?\?|？？/i,
  thanks: /谢谢|感谢|\bthanks\b|thank you|\bthx\b|\bty\b/i,
  please: /\bplease\b|\bpls\b|麻烦/i,
  swear: /卧槽|我去|我靠|妈的|离谱|\bwtf\b|\bshit\b|\bfuck|\bdamn\b/i,
  lost: /不知道|不会|怎么|在哪|看不懂|没懂|啥意思|\bhow (do|to|can)\b|\bconfused\b/i,
  whatNext: /^(然后呢|下一步|接下来呢?|then\??|what'?s next\??|next\??)[。.!！?？]*$/i,
  lazyYes: /^(继续|好|好的|可以|ok|okay|行|嗯|go|yes|y|对|是|continue|lgtm|sure)[。.!！]*$/i,
};
const AI = {
  sorry: /\bsorry\b|抱歉|apolog|my mistake|my bad|这怪我|是我的问题/i,
  flatter: /you'?re (absolutely |totally )?right|你说得对|你说的对|good catch|great question|好问题|你考虑得对/i,
  done: /\bdone\b|完成了|搞定|做好了|✅/i,
};

function isCatchphrase(t) {
  if (t.length < 2 || t.length > 14) return false;
  if (/^\[(image|pasted)/i.test(t)) return false; // attachment placeholders
  if (/^[\d\s.,]+$/.test(t)) return false; // menu picks like "1"
  if (/^(https?:|\/|~)/.test(t)) return false; // links and paths
  return true;
}

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Counts + a few short phrases for the report. Filters to `year` by local time. */
function computeRoast(prompts, replies, { year }) {
  const inYear = (ts) => !Number.isNaN(ts) && new Date(ts).getFullYear() === year;
  prompts = prompts.filter((p) => inYear(p.ts));
  replies = replies.filter((r) => inYear(r.ts));
  if (!prompts.length) return null;

  const you = {}, ai = {};
  for (const k of Object.keys(YOU)) you[k] = 0;
  for (const k of Object.keys(AI)) ai[k] = 0;
  const phrases = {}, angryDays = {};
  let latest = null, tiny = 0;

  for (const p of prompts) {
    const t = p.text.trim();
    for (const [k, rx] of Object.entries(YOU)) if (rx.test(t)) you[k]++;
    if (YOU.deny.test(t) || YOU.again.test(t)) angryDays[localDay(p.ts)] = (angryDays[localDay(p.ts)] || 0) + 1;
    if ([...t].length <= 4) tiny++;
    const norm = t.toLowerCase().replace(/\s+/g, " ").replace(/[。.!！]+$/, "");
    if (isCatchphrase(norm)) phrases[norm] = (phrases[norm] || 0) + 1;
    const d = new Date(p.ts);
    const mins = d.getHours() < 5 ? d.getHours() * 60 + d.getMinutes() : -1; // "late" = after midnight, before 5am
    if (mins >= 0 && (!latest || mins > latest.mins)) latest = { mins, time: `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`, day: localDay(p.ts) };
  }
  for (const r of replies) for (const [k, rx] of Object.entries(AI)) if (rx.test(r.text)) ai[k]++;

  const angriest = Object.entries(angryDays).sort((a, b) => b[1] - a[1])[0];
  return {
    prompts: prompts.length,
    you,
    ai,
    catchphrases: Object.entries(phrases)
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, count })),
    angriestDay: angriest ? { date: angriest[0], count: angriest[1] } : null,
    latest: latest ? { time: latest.time, day: latest.day } : null,
    tinyShare: tiny / prompts.length,
    medianLength: median(prompts.map((p) => [...p.text].length)),
  };
}

var api = { computeRoast, isCatchphrase, YOU, AI };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.VWRoast = api;
})(typeof self !== "undefined" ? self : this);
