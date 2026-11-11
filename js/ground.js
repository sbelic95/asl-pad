// Ground layout of an airport (OpenStreetMap via .github/workflows/ground-data.yml) and taxi routes on it.
// The taxiway network is a graph of the OSM nodes; a route is the shortest way along taxiways (runways only to cross,
// or as a last resort to taxi on). Holding positions on the route are the points to hold short.
import { getJSON, store, distKm, bearing } from "./util.js";

const URL = (icao) => `https://raw.githubusercontent.com/sbelic95/asl-pad/ground/ground/${icao}.json`;
export const GROUND_AIRPORTS = ["LYBE", "LYNI", "LYKV"];
const cache = {};

export async function loadGround(icao) {
  if (!GROUND_AIRPORTS.includes(icao)) return null;
  if (cache[icao]) return cache[icao];
  let g = null;
  try { g = await getJSON(URL(icao), 25000); if (g?.ways) store.set("asl.ground." + icao, g); } catch {}
  if (!g?.ways) g = store.get("asl.ground." + icao, null); // offline: the last copy
  if (!g?.ways) return null;
  cache[icao] = prepare(g);
  return cache[icao];
}
export const groundOf = (icao) => cache[icao] || null;

const m = (a, b) => distKm(a, b) * 1000;
const isTaxi = (k) => k === "taxiway" || k === "taxilane";

function prepare(g) {
  const pos = new Map(), adj = new Map(), refsAt = new Map();
  const link = (a, b, w, ref, kind) => {
    if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push({ to: b, w, ref, kind }); adj.get(b).push({ to: a, w, ref, kind });
  };
  for (const way of g.ways) {
    if (!isTaxi(way.k) && way.k !== "runway") continue;
    way.n.forEach((id, i) => {
      pos.set(id, way.g[i]);
      if (!refsAt.has(id)) refsAt.set(id, new Set());
      refsAt.get(id).add((way.k === "runway" ? "RWY " : "") + way.ref);
      if (i) {
        const d = m(way.g[i - 1], way.g[i]);
        // runways cost more: crossing is fine, taxiing along one only when there is no other way
        link(way.n[i - 1], id, way.k === "runway" ? d * 6 : d, way.ref, way.k);
      }
    });
  }
  const runways = g.ways.filter((w) => w.k === "runway" && w.ref);
  // In OSM some taxiways stop just short of a runway (at LYBE the exits R1–R4 and D5–D7 next to 12R/30L).
  // A loose taxiway end within 120 m of a runway it does not touch gets a link to the closest point on it.
  let v = 0; const extra = {}; // runway ref → the added link nodes on it
  for (const way of g.ways) {
    if (!isTaxi(way.k)) continue;
    for (const id of [way.n[0], way.n[way.n.length - 1]]) {
      if ((adj.get(id) || []).length !== 1) continue; // not a loose end
      const p = pos.get(id), on = refsAt.get(id);
      let best = null;
      for (const r of runways) {
        if (on.has("RWY " + r.ref)) continue;
        for (let i = 1; i < r.g.length; i++) {
          const q = closestOnSegment(p, r.g[i - 1], r.g[i]), d = m(p, q);
          if (d < 120 && (!best || d < best.d)) best = { d, q, r, i };
        }
      }
      if (!best) continue;
      const nid = "v" + v++, { r, i, q } = best;
      pos.set(nid, q); refsAt.set(nid, new Set(["RWY " + r.ref, way.ref])); (extra[r.ref] ||= []).push(nid);
      link(id, nid, best.d, way.ref, way.k);
      link(nid, r.n[i - 1], m(q, r.g[i - 1]) * 6, r.ref, "runway");
      link(nid, r.n[i], m(q, r.g[i]) * 6, r.ref, "runway");
    }
  }
  return { ...g, pos, adj, refsAt, runways, extra };
}
// the point on the segment a–b closest to p (flat approximation, fine for a few km)
function closestOnSegment(p, a, b) {
  const k = Math.cos((p[0] * Math.PI) / 180), ax = a[1] * k, bx = b[1] * k, px = p[1] * k;
  const dx = bx - ax, dy = b[0] - a[0], len = dx * dx + dy * dy;
  const u = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (p[0] - a[0]) * dy) / len)) : 0;
  return [a[0] + u * dy, (ax + u * dx) / k];
}

// nodes of the taxi network (not on a runway) near a point
export function nearestTaxiNode(G, p, refs) {
  let best = null, bd = Infinity;
  for (const [id, q] of G.pos) {
    const at = G.refsAt.get(id); if (!at || [...at].every((r) => r.startsWith("RWY "))) continue;
    if (refs && ![...at].some((r) => refs.includes(r))) continue;
    const d = m(p, q); if (d < bd) { bd = d; best = id; }
  }
  return best;
}

// the runway way and its threshold for a runway end like "12L"
export function runwayEnd(G, id) {
  // a runway can be split into several ways in OSM: take all pieces, the ends are the two points farthest apart
  const ways = G.runways.filter((w) => w.ref.split("/").map((s) => s.trim()).includes(id));
  if (!ways.length) return null;
  const way = ways[0], pts = ways.flatMap((w) => w.g), ids = ways.flatMap((w) => w.n);
  let a = pts[0], b = pts[1] || pts[0], best = -1;
  for (const p of pts) for (const q of pts) { const d = m(p, q); if (d > best) { best = d; a = p; b = q; } }
  const num = parseInt(id, 10) * 10;
  const diff = (x, y) => Math.abs(((x - y + 540) % 360) - 180);
  const aFirst = diff(bearing(a, b), num) < diff(bearing(b, a), num); // taking off from a towards b
  return { way, thr: aFirst ? a : b, end: aFirst ? b : a, ids: [...new Set([...ids, ...(G.extra[way.ref] || [])])] };
}

// where a taxiway meets the runway: entry for take-off ("head" = closest to the threshold) or the exit after landing.
// All candidates, best first (a piece of taxiway in OSM may not be connected to the rest).
export function runwayJoins(G, rwyId, twy) {
  const R = runwayEnd(G, rwyId); if (!R) return [];
  let cands = R.ids.filter((id) => [...(G.refsAt.get(id) || [])].some((r) => !r.startsWith("RWY ")));
  if (twy !== "head") cands = cands.filter((id) => G.refsAt.get(id).has(twy));
  return cands.sort((a, b) => m(G.pos.get(a), R.thr) - m(G.pos.get(b), R.thr));
}
export const runwayJoin = (G, rwyId, twy) => runwayJoins(G, rwyId, twy)[0] ?? null;

// route to the runway (dep) or from it to a stand (arr), trying the joins in order until one is reachable
export function routeVia(G, rwyId, twy, other, dep) {
  const avoid = [runwayRef(G, rwyId)];
  for (const j of runwayJoins(G, rwyId, twy).slice(0, 8)) {
    const R = dep ? taxiRoute(G, other, j, avoid) : taxiRoute(G, j, other, avoid);
    if (R) return R;
  }
  return null;
}

// shortest route (Dijkstra); returns the points, the length in m and the taxiways in order.
// avoid: runway refs that must not be taxied along (the landing runway after the exit, the runway of departure)
export function taxiRoute(G, from, to, avoid = []) {
  if (from == null || to == null || !G.adj.has(from) || !G.adj.has(to)) return null;
  const dist = new Map([[from, 0]]), prev = new Map(), done = new Set();
  const open = [[0, from]];
  while (open.length) {
    let k = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[k][0]) k = i;
    const [d, u] = open.splice(k, 1)[0];
    if (done.has(u)) continue; done.add(u);
    if (u === to) break;
    for (const e of G.adj.get(u) || []) {
      if (e.kind === "runway" && avoid.includes(e.ref)) continue;
      const nd = d + e.w;
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { u, e }); open.push([nd, e.to]); }
    }
  }
  if (!prev.has(to) && from !== to) return null;
  const ids = [to], steps = [];
  for (let x = to; x !== from;) { const p = prev.get(x); steps.unshift(p.e); x = p.u; ids.unshift(x); }
  const pts = ids.map((id) => G.pos.get(id));
  let len = 0; for (let i = 1; i < pts.length; i++) len += m(pts[i - 1], pts[i]);
  const names = [];
  for (const s of steps) { const n = s.kind === "runway" ? "RWY " + s.ref : s.ref; if (n && names[names.length - 1] !== n) names.push(n); }
  return { ids, pts, len, names };
}

// holding positions on the route (within 12 m of one of its points), in the order you pass them
export function holdsOn(G, route) {
  if (!route) return [];
  const out = [];
  route.pts.forEach((q, i) => {
    for (const p of G.points || []) if ((p.k === "holding_position" || p.k === "stopbar") && !out.some((o) => o.p === p) && m([p.lat, p.lon], q) < 12) out.push({ p, i });
  });
  return out.sort((a, b) => a.i - b.i).map((o) => o.p);
}
// the runway way ref of a runway end ("12L" → "12L/30R")
export const runwayRef = (G, id) => runwayEnd(G, id)?.way.ref || "";

// where two named taxiways meet (for hot spots), else the closest pair of their nodes
export function meetPoint(G, a, b) {
  let best = null, bd = Infinity;
  for (const [id, refs] of G.refsAt) if (refs.has(a) && refs.has(b)) return G.pos.get(id);
  const A = [...G.refsAt].filter(([, r]) => r.has(a)).map(([id]) => G.pos.get(id));
  const B = [...G.refsAt].filter(([, r]) => r.has(b)).map(([id]) => G.pos.get(id));
  for (const p of A) for (const q of B) { const d = m(p, q); if (d < bd) { bd = d; best = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; } }
  return bd < 400 ? best : null;
}
