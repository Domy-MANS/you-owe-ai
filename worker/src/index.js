import { DurableObject } from "cloudflare:workers";
import { schema, totals, confess, withdraw } from "./ledger.js";

const ORIGINS = ["https://domy-mans.github.io"];

/** One global ledger, so every count is exact (no eventual consistency). */
export class Ledger extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.run = (q, ...b) => ctx.storage.sql.exec(q, ...b).toArray();
    schema(this.run);
  }
  stats() { return totals(this.run); }
  confess(body, ipKey) { return confess(this.run, body, ipKey); }
  withdraw(body) { return withdraw(this.run, body); }
}

async function hash(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
      if (req.method === "POST" && (path === "/confess" || path === "/withdraw")) {
        if (!ORIGINS.includes(origin)) return json({ error: "origin" }, 403);
        const body = JSON.parse((await req.text()).slice(0, 1000));
        if (path === "/withdraw") return json(await ledger.withdraw(body));
        // only a salted hash of the IP, kept for a day, to slow down spam
        const ipKey = await hash((env.SALT || "you-owe-ai") + (req.headers.get("CF-Connecting-IP") || ""));
        const r = await ledger.confess(body, ipKey);
        return json(r, r.error && r.error !== "slow down" ? 400 : r.error ? 429 : 200);
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: "bad request" }, 400);
    }
  },
};
