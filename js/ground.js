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
  return { ...g, pos, adj, refsAt, runways };
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
  const way = G.runways.find((w) => w.ref.split("/").map((s) => s.trim()).includes(id));
  if (!way) return null;
  const a = way.g[0], b = way.g[way.g.length - 1], num = parseInt(id, 10) * 10;
  const diff = (x, y) => Math.abs(((x - y + 540) % 360) - 180);
  const aFirst = diff(bearing(a, b), num) < diff(bearing(b, a), num); // taking off from a towards b
  return { way, thr: aFirst ? a : b, end: aFirst ? b : a, ids: aFirst ? way.n : [...way.n].reverse() };
}

// where a taxiway meets the runway: entry for take-off ("head" = closest to the threshold) or the exit after landing
export function runwayJoin(G, rwyId, twy) {
  const R = runwayEnd(G, rwyId); if (!R) return null;
  const cands = R.ids.filter((id) => [...(G.refsAt.get(id) || [])].some((r) => !r.startsWith("RWY ")));
  if (!cands.length) return null;
  if (twy === "head") return cands.reduce((a, b) => (m(G.pos.get(a), R.thr) < m(G.pos.get(b), R.thr) ? a : b));
  const named = cands.filter((id) => G.refsAt.get(id).has(twy));
  if (!named.length) return null;
  return named.reduce((a, b) => (m(G.pos.get(a), R.thr) < m(G.pos.get(b), R.thr) ? a : b));
}

// shortest route (Dijkstra); returns the points, the length in m and the taxiways in order
export function taxiRoute(G, from, to) {
  if (from == null || to == null || !G.adj.has(from) || !G.adj.has(to)) return null;
  const dist = new Map([[from, 0]]), prev = new Map(), done = new Set();
  const open = [[0, from]];
  while (open.length) {
    let k = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[k][0]) k = i;
    const [d, u] = open.splice(k, 1)[0];
    if (done.has(u)) continue; done.add(u);
    if (u === to) break;
    for (const e of G.adj.get(u) || []) {
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

// holding positions within 25 m of the route
export function holdsOn(G, route) {
  if (!route) return [];
  return (G.points || []).filter((p) => (p.k === "holding_position" || p.k === "stopbar") &&
    route.pts.some((q) => m([p.lat, p.lon], q) < 25));
}

// where two named taxiways meet (for hot spots), else the closest pair of their nodes
export function meetPoint(G, a, b) {
  let best = null, bd = Infinity;
  for (const [id, refs] of G.refsAt) if (refs.has(a) && refs.has(b)) return G.pos.get(id);
  const A = [...G.refsAt].filter(([, r]) => r.has(a)).map(([id]) => G.pos.get(id));
  const B = [...G.refsAt].filter(([, r]) => r.has(b)).map(([id]) => G.pos.get(id));
  for (const p of A) for (const q of B) { const d = m(p, q); if (d < bd) { bd = d; best = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; } }
  return bd < 400 ? best : null;
}
