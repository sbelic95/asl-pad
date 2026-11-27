// ASL Pad server (Cloudflare Worker + KV): keeps the pilot's pad data in step across devices.
// Who is who comes from the Air Serbia Virtual dashboard: the pad sends its account token (CID + PIN sign-in), the worker
// asks the dashboard for the pilot and stores the data under the pilot's VATSIM CID. No passwords, no secrets of the pad; the worker itself needs none either.
//   GET  /sync   → { at, data }   the stored copy of this pilot
//   PUT  /sync   ← { at, data }   replaces it (the pad merges before it writes)
//   GET  /health → "ok"
// Bindings (wrangler.toml): KV namespace PAD. Variable ORIGINS = allowed origins, comma separated.
const DASH_ME = "https://airserbia-virtual.pages.dev/api/me";
const MAX = 512 * 1024; // 512 KB per pilot is plenty for logbook, calendar and settings

export default {
  async fetch(req, env) {
    const origin = req.headers.get("origin") || "", allowed = (env.ORIGINS || "https://sbelic95.github.io").split(",").map((s) => s.trim());
    const cors = { "access-control-allow-origin": allowed.includes(origin) ? origin : allowed[0], "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, PUT, OPTIONS", "access-control-max-age": "86400", vary: "origin" };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    if (url.pathname === "/health") return new Response("ok", { headers: cors });
    if (url.pathname !== "/sync") return json({ error: "not found" }, 404);
    const pilot = await whoIs(req, env);
    if (!pilot) return json({ error: "unauthorized" }, 401);
    const key = "pilot:" + pilot;
    if (req.method === "GET") return json((await env.PAD.get(key, "json")) || { at: 0, data: null });
    if (req.method === "PUT") {
      const text = await req.text();
      if (text.length > MAX) return json({ error: "too large" }, 413);
      let body; try { body = JSON.parse(text); } catch { return json({ error: "bad json" }, 400); }
      if (typeof body?.at !== "number" || typeof body?.data !== "object") return json({ error: "bad body" }, 400);
      await env.PAD.put(key, JSON.stringify({ at: body.at, data: body.data }));
      return json({ ok: true, at: body.at });
    }
    return json({ error: "method" }, 405);
  },
};

// the account token → VATSIM CID, cached for 30 minutes
async function whoIs(req, env) {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(\S{20,})$/); if (!m) return null;
  const tok = m[1], hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tok)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const hit = await env.PAD.get("tok:" + hash); if (hit) return hit;
  const r = await fetch(env.DASH_ME || DASH_ME, { headers: { authorization: "Bearer " + tok, accept: "application/json" } });
  if (!r.ok) return null;
  const d = await r.json().catch(() => null);
  const id = String(d?.id ?? ""); if (!/^\d{6,8}$/.test(id)) return null;
  await env.PAD.put("tok:" + hash, id, { expirationTtl: 1800 });
  return id;
}
