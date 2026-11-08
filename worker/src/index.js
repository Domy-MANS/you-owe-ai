import { DurableObject } from "cloudflare:workers";
import { schema, totals, confess, withdraw, ipKey } from "./ledger.js";
import { chartSvg } from "./chart.js";

const ORIGINS = ["https://domy-mans.github.io"];

/** One global ledger, so every count is exact (no eventual consistency). */
export class Ledger extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.run = (q, ...b) => ctx.storage.sql.exec(q, ...b).toArray();
    schema(this.run);
  }
  stats() { return totals(this.run); }
  async confess(body, ip) { return confess(this.run, body, await ipKey(this.run, ip)); }
  withdraw(body) { return withdraw(this.run, body); }
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: cors });
    const ledger = env.LEDGER.get(env.LEDGER.idFromName("global"));
    const path = new URL(req.url).pathname;
    try {
      if (req.method === "GET" && path === "/stats") return json(await ledger.stats());
      if (req.method === "GET" && path === "/chart.svg") {
        // for the README; GitHub's image proxy re-fetches after max-age
        const lang = new URL(req.url).searchParams.get("lang") === "zh" ? "zh" : "en";
        return new Response(chartSvg(await ledger.stats(), lang), { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
      }
      if (req.method === "POST" && (path === "/confess" || path === "/withdraw")) {
        if (!ORIGINS.includes(origin)) return json({ error: "origin" }, 403);
        const body = JSON.parse((await req.text()).slice(0, 1000));
        if (path === "/withdraw") return json(await ledger.withdraw(body));
        // the IP goes only to the ledger, which keeps nothing but a hash under a secret salt that changes daily
        const r = await ledger.confess(body, req.headers.get("CF-Connecting-IP") || "");
        return json(r, r.error && r.error !== "slow down" ? 400 : r.error ? 429 : 200);
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: "bad request" }, 400);
    }
  },
};
