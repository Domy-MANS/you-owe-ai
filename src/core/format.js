/** How numbers read on the bill, in both languages. Runs in Node (tests) and the browser (the report). */
(function (root) {
  "use strict";

  /** Counts: 9,999 · 1.2万 / 12K · 3.4亿 / 3.4B. A number that rounds up into the next unit uses it: 99,999 is 10万 (not 10.0万), 999,999 is 1.0M (not 1000K). */
  function fmt(n, lang) {
    n = Number(n) || 0;
    // [from, divide by, suffix], biggest first
    var U = lang === "zh" ? [[1e8, 1e8, "亿"], [1e4, 1e4, "万"]] : [[1e9, 1e9, "B"], [1e6, 1e6, "M"], [1e4, 1e3, "K"]];
    var dec = function (v, sfx) { return sfx === "K" ? 0 : sfx === "M" || sfx === "B" ? 1 : Number(v.toFixed(1)) >= 10 ? 0 : 1; };
    for (var i = 0; i < U.length; i++) {
      if (n < U[i][0]) continue;
      var s = (n / U[i][1]).toFixed(dec(n / U[i][1], U[i][2]));
      if (i > 0 && Number(s) * U[i][1] >= U[i - 1][0]) { i--; s = (n / U[i][1]).toFixed(dec(n / U[i][1], U[i][2])); }
      return s + U[i][2];
    }
    return Math.round(n).toLocaleString("en-US"); // the same separators in every browser locale
  }

  /** Bill amounts: ¥6, ¥0.4, ¥8,459 · $8,459.00 */
  function money(v, lang) {
    var neg = v < 0, a = Math.abs(v), s;
    if (lang === "zh") s = "¥" + (a < 10 ? String(+a.toFixed(1)) : Math.round(a).toLocaleString("en-US"));
    else s = "$" + a.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (neg && s.replace(/[^1-9]/g, "") ? "-" : "") + s; // -0.001 rounds to $0.00, not -$0.00
  }

  /** 2 → "2nd", 11 → "11th", 22 → "22nd" */
  function ord(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

  /** "late" times are after midnight, before 5am: "0:12" → "12:12 am" */
  function am(time) { return String(time).replace(/^0:/, "12:") + " am"; }

  var api = { fmt: fmt, money: money, ord: ord, am: am };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.VWFormat = api;
})(typeof self !== "undefined" ? self : this);
