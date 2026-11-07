// Small helpers shared by all apps.
export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const KT_KMH = 1.852, NM_KM = 1.852, FT_M = 0.3048;
const R_KM = 6371;
export const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;

export function distKm(a, b) {
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
export const distNm = (a, b) => distKm(a, b) / NM_KM;
export function bearing(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
// points on the great circle from a to b (for drawing)
export function greatCircle(a, b, n = 48) {
  const [la1, lo1, la2, lo2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2));
  if (!d) return [a, b];
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(la1) * Math.cos(lo1) + B * Math.cos(la2) * Math.cos(lo2);
    const y = A * Math.cos(la1) * Math.sin(lo1) + B * Math.cos(la2) * Math.sin(lo2);
    const z = A * Math.sin(la1) + B * Math.sin(la2);
    out.push([deg(Math.atan2(z, Math.hypot(x, y))), deg(Math.atan2(y, x))]);
  }
  return out;
}
export function inRing(pt, ring) { // pt = [lat, lon], ring = [[lon, lat], ...]
  const x = pt[1], y = pt[0]; let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// network: no-store plus a cache-buster (iOS Safari sometimes serves cached answers anyway)
async function fetchWithTimeout(url, ms, opt = {}) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { cache: "no-store", ...opt, signal: ac.signal }); } finally { clearTimeout(t); }
}
const bust = (url) => url + (url.includes("?") ? "&" : "?") + "_=" + Date.now();
export async function getJSON(url, ms = 15000) {
  const r = await fetchWithTimeout(bust(url), ms);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const txt = await r.text();
  return txt.trim() ? JSON.parse(txt) : null;
}
export async function getText(url, ms = 15000) {
  const r = await fetchWithTimeout(bust(url), ms);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return (await r.text()).trim();
}

// storage that never throws (private mode, blocked storage)
export const store = {
  get(k, def = null) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
  keys(prefix) { try { return Object.keys(localStorage).filter((k) => k.startsWith(prefix)); } catch { return []; } },
};

// time formatting
export const p2 = (n) => String(n).padStart(2, "0");
export function hhmm(t) { if (t == null || isNaN(t)) return "--:--"; const d = new Date(t); return p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes()); }
export const hhmmz = (t) => (t == null || isNaN(t) ? "--:--" : hhmm(t) + "z");
export function localHM(t, tz) {
  if (t == null || isNaN(t)) return "--:--";
  try { return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz || undefined }).format(t); } catch { return hhmm(t); }
}
export function dur(ms, sign = false) { // 1:05 ; with sign: +0:05 / -0:12
  if (ms == null || isNaN(ms)) return "--:--";
  const neg = ms < 0, m = Math.round(Math.abs(ms) / 60e3);
  return (neg ? "-" : sign ? "+" : "") + Math.floor(m / 60) + ":" + p2(m % 60);
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
// "1730000000" (unix seconds, SimBrief) or an ISO string
export function toMs(v) {
  if (v == null || v === "") return null;
  if (/^\d{9,11}$/.test(String(v))) return Number(v) * 1000;
  const t = Date.parse(v); return isNaN(t) ? null : t;
}
export const arr = (x) => (Array.isArray(x) ? x : x == null || x === "" ? [] : [x]);
