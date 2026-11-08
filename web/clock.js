/* The AI debt clock: how many people confessed, and how much humanity owes AI.
   Sends only a bill's total (plus currency and how it was made) under a random per-browser id.
   Never chat text, catchphrases or anything else. Off unless the page is the published site. */
window.VWClock = (function () {
  "use strict";
  var BASE = window.VW_COUNTER || "", fake = window.__clockFake; // __clockFake: browser tests only
  var live = !!fake || (!!BASE && location.origin === "https://domy-mans.github.io");
  function isOff() { try { return localStorage.getItem("vw-clock-off") === "1"; } catch (e) { return false; } }
  function myId(year) {
    try {
      var o = JSON.parse(localStorage.getItem("vw-clock-id") || "null");
      if (o && o.y === year) return o.id;
      var b = crypto.getRandomValues(new Uint8Array(18)), id = btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, "-").replace(/\//g, "_");
      localStorage.setItem("vw-clock-id", JSON.stringify({ id: id, y: year }));
      return id;
    } catch (e) { return null; }
  }
  function req(path, body) {
    if (fake) return Promise.resolve(fake(path, body));
    var ctl = new AbortController(); setTimeout(function () { ctl.abort(); }, 5000);
    // text/plain keeps it a "simple" request: no preflight
    return fetch(BASE + path, body ? { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "text/plain" }, signal: ctl.signal } : { signal: ctl.signal })
      .then(function (r) { return r.json(); });
  }
  function stats() { return live ? req("/stats") : Promise.reject(new Error("off")); }
  function report(o) {
    if (!live || isOff()) return Promise.reject(new Error("off"));
    var id = myId(o.year);
    if (!id) return Promise.reject(new Error("no storage"));
    return req("/confess", { id: id, amount: Math.round(o.amount * 100) / 100, cur: o.cur, via: o.via, plea: o.plea || undefined });
  }
  function withdraw() {
    try { localStorage.setItem("vw-clock-off", "1"); } catch (e) {}
    var id = null; try { id = (JSON.parse(localStorage.getItem("vw-clock-id") || "null") || {}).id; } catch (e) {}
    return id && live ? req("/withdraw", { id: id }) : Promise.resolve(null);
  }
  /** Bill dollars to the reader's currency: the Chinese bill runs at ¥4 per $1 (see worker/src/ledger.js). */
  function money(usd, lang) { return lang === "zh" ? "¥" + Math.round(usd * 4).toLocaleString("en-US") : "$" + Math.round(usd).toLocaleString("en-US"); }
  return { live: live, stats: stats, report: report, withdraw: withdraw, isOff: isOff, money: money };
})();
