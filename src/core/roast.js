/** Turn prompt text into counts and short repeated phrases. Runs in Node and the browser. */
(function (root) {
"use strict";
var localDay = typeof module !== "undefined" && module.exports ? require("./stats").localDay : root.VWStats.localDay;

// The counts go on a bill people show to friends, so each pattern has to mean what the bill says it means.
// An ordinary question ("怎么部署", "how to deploy") isn't being lost; "no problem", "对不对", "没用过", "我去看看" aren't a no or a swear.
const YOU = {
  deny: /(^|[^对])不对(?![称应齐等])|不是这样|不是这个|不是我要的|(^|[^行])不行|错了|搞错|弄错|没用(?![过上到完])|^no\b(?![ -]?(problem|worries|need|rush|idea|matter))|\bnope\b|\bwrong\b|\bincorrect\b|\bnot (right|correct|what i (asked|meant|wanted))\b|that'?s not (it|right|what)|not working|(doesn'?t|didn'?t|does not|did not) work/i,
  again: /还是(不行|不对|有问题|报错|一样|没用|错)|又(报错|错了|挂了|崩了|不行|出错)|\bstill (not|doesn|isn|broken|wrong|fail|the same|getting|no)|\bnot again\b|\bagain[?!]|\bsame (error|issue|problem|bug)\b/i,
  why: /为什么|为啥|\bwhy\b|\?\?|？？/i,
  thanks: /谢谢|感谢|多谢|辛苦了|\bthanks\b|thank (you|u)\b|\bthx\b|\btysm\b|\bty\b/i,
  please: /\bplease\b|\bpls\b|麻烦/i,
  swear: /卧槽|我操|我靠|我去([，,！!。.…]|$)|妈的|他妈|\btmd\b|离谱|\bwtf\b|\bffs\b|\bshit\b|\bbullshit\b|\bfuck|\bdamn\b|\bcrap\b/i,
  lost: /我不知道|不知道(怎么|该|如何|为什么|为啥)|我不会|看不懂|没看懂|没懂|不懂|不明白|啥意思|什么意思|怎么办|怎么回事|\b(i'?m|i am) (lost|confused|stuck)\b|\bconfused\b|\b(i )?(don'?t|do not) (understand|get it|know (how|what|why))\b|\bno idea\b|\bwhat does (this|that|it) mean\b/i,
  whatNext: /^(然后呢|下一步|接下来呢?|then\??|what'?s next\??|next\??)[。.!！?？]*$/i,
  lazyYes: /^(继续|好|好的|可以|ok|okay|行|嗯|go|yes|y|对|是|continue|lgtm|sure)[。.!！]*$/i,
};
const AI = {
  sorry: /\bsorry\b|抱歉|对不起|apolog|my mistake|my bad|i was wrong|这怪我|是我的问题|我的错|我的失误/i,
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
