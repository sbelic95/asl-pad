// vAMSYS (Air Serbia Virtual's airline system): the pilot signs in on vAMSYS itself (OAuth 2.0 authorization code + PKCE,
// no client secret – a public client). The pad keeps the tokens only on this device and reads the pilot's name, network IDs,
// rank and hours, and bookings. Settings in va/vamsys.json. Endpoints from the vAMSYS Pilot API (/api/v3/pilot).
import { S, settings, saveSettings, emit } from "./data.js";
import { store, getJSON } from "./util.js";

const KEY = "asl.vamsys", PKCE = "asl.vamsys.pkce", DATA = "asl.vamsys.data";
let CFG = null;
export const V = { data: store.get(DATA, null), err: "", busy: false };
export const signedIn = () => !!store.get(KEY, null)?.access;
async function cfg() { if (!CFG) CFG = await getJSON("va/vamsys.json", 15000); return CFG; }
// on GitHub Pages the registered address; elsewhere (tests on localhost) the page itself
const redirect = (c) => (location.hostname.endsWith("github.io") ? c.redirect : location.origin + location.pathname);
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const rand = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export async function signIn() {
  const c = await cfg(), verifier = rand(64), state = rand(24);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  store.set(PKCE, { verifier, state, at: Date.now() });
  const q = new URLSearchParams({ response_type: "code", client_id: c.clientId, redirect_uri: redirect(c), scope: c.scopes, state, code_challenge: challenge, code_challenge_method: "S256" });
  location.href = c.authorize + "?" + q;
}
async function tokenCall(body) {
  const c = await cfg();
  let r;
  try { r = await fetch(c.token, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.clientId, ...body }) }); }
  catch { throw new Error("browser"); } // usually: vAMSYS does not allow calls from a web page (CORS)
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.message || j.error || "token " + r.status);
  const t = { access: j.access_token, refresh: j.refresh_token || store.get(KEY, null)?.refresh || "", exp: Date.now() + (j.expires_in || 3600) * 1000, scope: j.scope || "" };
  store.set(KEY, t); return t;
}
// back from vAMSYS with ?code=…&state=…: exchange the code, clean the address
export async function handleRedirect() {
  const q = new URLSearchParams(location.search), code = q.get("code"), state = q.get("state"), error = q.get("error");
  if (!code && !error) return false;
  const p = store.get(PKCE, null); store.del(PKCE);
  history.replaceState(null, "", location.pathname + (q.get("app") ? "?app=" + q.get("app") : ""));
  if (error) { V.err = q.get("error_description") || error; return true; }
  if (!p || p.state !== state) { V.err = "state"; return true; }
  try { const c = await cfg(); await tokenCall({ grant_type: "authorization_code", redirect_uri: redirect(c), code, code_verifier: p.verifier }); V.err = ""; await loadVamsys(); }
  catch (e) { V.err = e.message; }
  emit(); return true;
}
async function access() {
  const t = store.get(KEY, null); if (!t?.access) return null;
  if (t.exp > Date.now() + 60e3) return t.access;
  if (!t.refresh) return null;
  try { return (await tokenCall({ grant_type: "refresh_token", refresh_token: t.refresh })).access; }
  catch (e) { if (e.message !== "browser") store.del(KEY); throw e; }
}
async function api(path) {
  const c = await cfg(), tok = await access(); if (!tok) throw new Error("signed out");
  let r; try { r = await fetch(c.api + path, { headers: { Accept: "application/json", Authorization: "Bearer " + tok } }); } catch { throw new Error("browser"); }
  if (r.status === 401) { store.del(KEY); throw new Error("signed out"); }
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
}
const one = (v) => (Array.isArray(v?.data) ? v.data[0] : v?.data && typeof v.data === "object" ? v.data : v) || {};
const list = (v) => (Array.isArray(v?.data) ? v.data : Array.isArray(v) ? v : []);
const pick = (o, ...keys) => { for (const k of keys) { const v = k.split(".").reduce((a, x) => a?.[x], o); if (v != null && v !== "") return v; } return null; };

// the pilot's data, mapped loosely (field names as the Pilot API sends them, with fall-backs)
export async function loadVamsys() {
  if (!signedIn()) return;
  V.busy = true;
  try {
    const [u, p] = await Promise.all([api("/user"), api("/profile")]);
    const user = one(u), prof = one(p);
    let bookings = [];
    try { bookings = list(await api("/bookings")).map((b) => ({
      id: pick(b, "id"), dep: pick(b, "departure_airport.icao", "departure_airport.identifier", "route.departure_airport.icao", "departure_icao", "departure"),
      arr: pick(b, "arrival_airport.icao", "arrival_airport.identifier", "route.arrival_airport.icao", "arrival_icao", "arrival"),
      callsign: pick(b, "callsign", "route.callsign"), number: pick(b, "flight_number", "route.flight_number"), at: Date.parse(pick(b, "departure_time", "scheduled_departure") || "") || null,
      type: pick(b, "aircraft.type", "aircraft.icao", "aircraft.code", "fleet.code"), reg: pick(b, "aircraft.registration", "aircraft.reg"),
    })).filter((b) => b.dep && b.arr); } catch {}
    V.data = {
      name: [pick(user, "first_name"), pick(user, "last_name")].filter(Boolean).join(" ") || pick(user, "name", "username") || "",
      first: pick(user, "first_name") || "", callsign: pick(prof, "callsign", "pilot_callsign") || "",
      rank: pick(prof, "rank.name", "rank_name") || "", hours: pick(prof, "statistics.hours", "stats.hours", "total_hours", "hours", "flight_time_hours"),
      flights: pick(prof, "statistics.flights", "stats.flights", "total_flights", "pireps_count"),
      vatsim: String(pick(prof, "vatsim_id", "vatsim.id", "networks.vatsim", "user.vatsim_id") || pick(user, "vatsim_id", "vatsim.id") || ""),
      bookings, at: Date.now(),
    };
    store.set(DATA, V.data); V.err = "";
    if (!settings.cid && /^\d{6,8}$/.test(V.data.vatsim)) saveSettings({ cid: V.data.vatsim }); // the VATSIM ID from vAMSYS
  } catch (e) { V.err = e.message; }
  V.busy = false; emit();
}
export function signOut() { store.del(KEY); store.del(DATA); V.data = null; V.err = ""; emit(); }
