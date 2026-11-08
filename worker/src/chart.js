/**
 * The debt clock as a picture, for the README: three headline numbers and one bar split by plea.
 * Served as SVG from /chart.svg?lang=en|zh. It brings its own paper background, so it reads the
 * same on GitHub's light and dark themes. Colors validated (dataviz validate_palette.js) on #f1e2b8.
 */
import { CNY_PER_USD } from "./ledger.js";

const PAPER = "#f1e2b8", INK = "#2a1f12", DIM = "#7a6a52", LINE = "rgba(110,80,30,0.35)";
const GUILTY = "#1d4ed8", REFUSE = "#b91c1c", EMPTY = "rgba(110,80,30,0.18)";
const n0 = (x) => Math.round(x).toLocaleString("en-US");

const T = {
  en: {
    head: "AI DEBT CLOCK · LIVE", people: "people got their AI bill", owed: "owed to AI in total", refuse: "refuse to pay",
    guilty: "🙇 Guilty, I'll pay", not: "Not paying 😤", none: "No pleas yet", undecided: (n) => n0(n) + " in contempt of court", noneBig: "No bills yet. Be the first.",
    money: (usd) => "$" + n0(usd), foot: (d) => "Updated " + d + " UTC · domy-mans.github.io/you-owe-ai",
  },
  zh: {
    head: "AI 债务钟 · 实时", people: "人收到了 AI 的账单", owed: "全人类共欠 AI", refuse: "表示就是不还",
    guilty: "🙇 认罪，我还", not: "就是不还 😤", none: "还没有人表态", undecided: (n) => n0(n) + " 人拒不到庭", noneBig: "还没有人收到账单。来当第一个。",
    money: (usd) => "¥" + n0(usd * CNY_PER_USD), foot: (d) => "更新于 " + d + " UTC · domy-mans.github.io/you-owe-ai",
  },
};

export function chartSvg(t, lang = "en", now = new Date()) {
  const L = T[lang] || T.en, W = 760, H = 318, x0 = 32, bw = W - 64;
  const voted = (t.guilty || 0) + (t.refuse || 0), rp = voted ? Math.round((t.refuse / voted) * 100) : null;
  const when = now.toISOString().slice(0, 16).replace("T", " ");
  const text = (x, y, s, size, weight, fill, anchor = "start") =>
    `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${s}</text>`;
  // long amounts shrink so the three columns never touch
  const tile = (x, big, label) => text(x, 118, big, big.length > 12 ? 28 : big.length > 9 ? 33 : 40, 900, INK) + text(x, 144, label, 15, 600, DIM);

  let body;
  if (!t.n) body = text(x0, 128, L.noneBig, 26, 800, INK);
  else {
    body = tile(x0, n0(t.n), L.people) + tile(262, L.money(t.sum), L.owed) + tile(572, rp === null ? "—" : rp + "%", L.refuse);
    const y = 182, h = 26;
    if (!voted) body += `<rect x="${x0}" y="${y}" width="${bw}" height="${h}" rx="4" fill="${EMPTY}"/>` + text(x0, y + h + 26, L.none, 15, 600, DIM);
    else {
      // the whole bar is everyone: guilty | not chosen yet (neutral) | not paying, 2px gaps between
      const und = Math.max(0, t.n - voted), parts = [[t.guilty, GUILTY, L.guilty], [und, EMPTY, L.undecided(und)], [t.refuse, REFUSE, L.not]].filter((p) => p[0] > 0);
      const room = bw - 2 * (parts.length - 1), all = parts.reduce((a, p) => a + p[0], 0);
      let x = x0, mid = W / 2;
      parts.forEach((p, i) => {
        const w = i === parts.length - 1 ? x0 + bw - x : Math.max(4, Math.round(room * (p[0] / all)));
        if (p[1] === EMPTY) mid = x + w / 2;
        body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${p[1]}"><title>${p[1] === EMPTY ? p[2] : p[2] + ": " + n0(p[0])}</title></rect>`;
        x += w + 2;
      });
      // the middle label only if it clears both end labels (estimated generously: fonts differ by viewer)
      const est = (str, px) => [...str.replace(/<[^>]+>/g, "")].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? px * 1.05 : px * 0.62), 0);
      const leftEnd = x0 + est(`${L.guilty} · ${100 - rp}% · ${n0(t.guilty)}`, 15) + 16;
      const rightStart = W - 32 - est(`${n0(t.refuse)} · ${rp}% · ${L.not}`, 15) - 16;
      const uw = est(L.undecided(und), 13);
      if (und && mid - uw / 2 > leftEnd && mid + uw / 2 < rightStart) body += text(mid, y + h + 26, L.undecided(und), 13, 600, DIM, "middle");
      else if (und) body += text(W / 2, y + h + 50, L.undecided(und), 13, 600, DIM, "middle"); // no room: its own line
      const gp = 100 - rp;
      body += text(x0, y + h + 26, `${L.guilty} · <tspan font-weight="900">${gp}%</tspan> · ${n0(t.guilty)}`, 15, 600, INK);
      body += text(W - 32, y + h + 26, `${n0(t.refuse)} · <tspan font-weight="900">${rp}%</tspan> · ${L.not}`, 15, 600, INK, "end");
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', 'Segoe UI', sans-serif" role="img" aria-label="${L.head}: ${n0(t.n)} ${L.people}, ${L.money(t.sum)} ${L.owed}${rp === null ? "" : ", " + rp + "% " + L.refuse}">
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" fill="${PAPER}" stroke="${LINE}" stroke-width="2" stroke-dasharray="6 5"/>
${text(x0, 46, "🧾 " + L.head, 14, 800, DIM)}
<line x1="${x0}" y1="62" x2="${W - 32}" y2="62" stroke="${LINE}" stroke-width="1.5" stroke-dasharray="5 4"/>
${body}
${text(x0, H - 22, L.foot(when), 12, 500, DIM)}
</svg>`;
}
