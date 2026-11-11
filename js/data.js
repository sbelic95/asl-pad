// Data hub: settings, live data (SimBrief, VATSIM, METAR, vIFF CDM, stands), the flight state and the logbook.
import { getJSON, getText, store, distKm, greatCircle } from "./util.js";
import { fetchOfp, normOfp } from "./ofp.js";
import { decodeMetar, atisInfo, loadRunways, runwayFromWind } from "./wx.js";
import { loadFlight, saveFlight, updateFlight, project, phaseOf, estimates, fuelState, logEntry, flightKey } from "./flight.js";
import { standsCached, standsGithub, standsOverpass, predictStand } from "./stands.js";
import { demoSimbrief, demoPilot, demoMetars, demoAtis, demoControllers, demoLogbook, demoEvents, demoTraffic, demoSigmets } from "./demo.js";

export const API = {
  feed: "https://data.vatsim.net/v3/vatsim-data.json",
  metar: "https://metar.vatsim.net/",
  viff: "https://viff-system.network",
  ukcp: "https://raw.githubusercontent.com/sbelic95/vdgs-slot-board/data/ukcp.json",
  events: "https://raw.githubusercontent.com/sbelic95/asl-pad/data/events.json", // .github/workflows/vatsim-events.yml
  sigmets: "https://raw.githubusercontent.com/sbelic95/asl-pad/wx/sigmets.json", // .github/workflows/sigmets.yml
  notices: "va/notices.json", // written by the airline's staff on GitHub, like the two below
  downloads: "va/downloads.json",
  ranks: "va/ranks.json",
};

const DEF = { simbrief: "", cid: "", unit: "kg", theme: "dark", wall: "night", wallDim: 0.3, homeHide: [], lock: 10, demo: "" };
export let settings = { ...DEF, ...store.get("asl.settings", {}) };
// The demo flight is only for the automated test on the developer's own computer (localhost).
// On the real site it can never be switched on, and a demo saved earlier is switched off.
export const DEV = typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname);
export function saveSettings(patch) {
  settings = { ...settings, ...patch };
  store.set("asl.settings", { ...settings, demo: "" });
}
if (settings.demo) saveSettings({ demo: "" });
export function setTestDemo(v) { if (DEV) settings.demo = v; }

const HOME_POS = [44.8184, 20.3091]; // Belgrade, the home base
export const S = {
  ofp: null, ofpErr: "", ofpAt: 0, pilot: null, prefile: null, feedOk: null, feedAt: 0,
  atis: [], ctrl: [], near: { dep: [], arr: [] }, metar: {}, cdm: null, cdmOk: null, stands: {}, ukcp: null,
  st: null, pr: null, events: [],
  // the airline's notices and tips, and the coming VATSIM events (kept for offline use)
  notices: store.get("asl.notices", null), vatEvents: store.get("asl.vatevents", []),
  downloads: store.get("asl.downloads", null), ranks: store.get("asl.ranks", null), traffic: [], sigmets: null,
};
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
export const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

// ---------- logbook ----------
const LOGKEY = () => (settings.demo ? "asl.logbook.demo" : "asl.logbook");
export function logbook() { // newest first
  let l = store.get(LOGKEY(), null);
  if (l == null && settings.demo) { l = demoLogbook(); store.set(LOGKEY(), l); }
  return (l || []).slice().sort((a, b) => b.date - a.date);
}
export function saveLogbook(list) { store.set(LOGKEY(), list.sort((a, b) => b.date - a.date)); emit(); }
export function addToLogbook(e) { const l = logbook().filter((x) => x.id !== e.id); l.push(e); saveLogbook(l); }

// ---------- SimBrief ----------
export async function pollSimbrief(force) {
  if (settings.demo) { if (!S.ofp || force) setOfp(normOfp(demoSimbrief(settings.demo === "ground"))); return; }
  if (!settings.simbrief) { S.ofpErr = "setup"; emit(); return; }
  try { setOfp(await fetchOfp(settings.simbrief.trim(), getJSON)); S.ofpErr = ""; }
  catch (e) { S.ofpErr = e.message === "user" ? "user" : e.message === "noofp" ? "noofp" : "net"; }
  S.ofpAt = Date.now(); emit();
}
function setOfp(o) {
  const changed = !S.ofp || flightKey(S.ofp) !== flightKey(o);
  S.ofp = o;
  if (changed) {
    S.st = loadFlight(o); S.pr = null; S.cdm = null;
    if (settings.demo) seedDemoState(o);
    loadStandsFor(o.dep); loadStandsFor(o.dest);
    pollMetars();
  }
  emit();
}
function seedDemoState(o) {
  if (S.st.offBlock || settings.demo === "ground") return;
  const T = o.times;
  Object.assign(S.st, { offBlock: T.out + 4 * 60e3, takeoff: T.off + 3 * 60e3 });
  // two fuel checks along the way so far
  const nl = o.navlog, k1 = Math.min(5, nl.length - 2), k2 = Math.min(11, nl.length - 2);
  if (Date.now() - T.off > nl[k2].t * 1000) S.st.checks = [
    { t: T.off + nl[k1].t * 1000, fob: nl[k1].fob - 200, plan: nl[k1].fob, dev: -200, along: nl[k1].cumNm, fix: nl[k1 + 1].ident },
    { t: T.off + nl[k2].t * 1000, fob: nl[k2].fob - 300, plan: nl[k2].fob, dev: -300, along: nl[k2].cumNm, fix: nl[k2 + 1].ident },
  ];
  // the way flown so far, with the times the fixes were passed
  const tAir = (Date.now() - S.st.takeoff) / 1000;
  for (let k = 1; k < nl.length && nl[k].t < tAir; k++) { S.st.fixTimes[k + ":" + nl[k].ident] = S.st.takeoff + nl[k].t * 1000; S.st.seenI = k; }
  for (let s = 0; s < tAir; s += 240) {
    let i = 0; while (i < nl.length - 2 && nl[i + 1].t < s) i++;
    const a = nl[i], b = nl[i + 1], f = Math.min(1, Math.max(0, (s - a.t) / ((b.t - a.t) || 1)));
    const p = greatCircle(a.pos, b.pos, 20)[Math.round(f * 20)];
    S.st.track.push([+p[0].toFixed(4), +p[1].toFixed(4), Math.round((a.alt ?? 0) + ((b.alt ?? 0) - (a.alt ?? 0)) * f), S.st.takeoff + s * 1000]);
  }
  saveFlight(o, S.st);
}

// ---------- VATSIM ----------
export async function pollFeed() {
  const o = S.ofp;
  if (settings.demo) {
    S.feedOk = true; S.feedAt = Date.now();
    S.pilot = o ? demoPilot(o, settings.demo === "ground") : null;
    S.atis = demoAtis(); S.ctrl = demoControllers();
    S.near = { dep: [], arr: [] }; S.traffic = demoTraffic();
    afterPosition(); return;
  }
  try {
    const d = await getJSON(API.feed, 25000);
    S.feedOk = true; S.feedAt = Date.now();
    const cid = Number(settings.cid) || null;
    const cs = o?.callsign;
    S.pilot = d.pilots.find((p) => (cid && p.cid === cid) || (!cid && cs && p.callsign === cs)) || null;
    S.prefile = S.pilot ? null : d.prefiles.find((p) => (cid && p.cid === cid) || (cs && p.callsign === cs)) || null;
    const apts = [o?.dep?.icao, o?.dest?.icao].filter(Boolean);
    S.atis = d.atis.filter((a) => apts.some((x) => a.callsign.startsWith(x + "_")));
    S.ctrl = d.controllers.filter((c) => c.facility > 0 && c.frequency !== "199.998");
    // aircraft on the ground near both airports: those stands count as taken
    const near = (pos) => (pos ? d.pilots.filter((p) => p.groundspeed < 5 && distKm([p.latitude, p.longitude], pos) < 6).map((p) => ({ callsign: p.callsign, latitude: p.latitude, longitude: p.longitude, groundspeed: p.groundspeed })) : []);
    S.near = { dep: near(o?.dep?.pos), arr: near(o?.dest?.pos) };
    // traffic on and near the ground at both airports and at Belgrade (airport map, stand taken?)
    const centres = [o?.dep?.pos, o?.dest?.pos, HOME_POS].filter(Boolean);
    S.traffic = d.pilots.filter((p) => p.groundspeed < 60 && centres.some((c) => distKm([p.latitude, p.longitude], c) < 10))
      .map((p) => ({ callsign: p.callsign, lat: p.latitude, lon: p.longitude, gs: p.groundspeed, hdg: p.heading, type: p.flight_plan?.aircraft_short || "" }));
  } catch (e) { S.feedOk = false; }
  afterPosition();
}
function afterPosition() {
  const o = S.ofp;
  if (o && S.st) {
    const ev = updateFlight(S.st, o, S.pilot);
    S.pr = S.pilot ? project(o.navlog, [S.pilot.latitude, S.pilot.longitude], S.st.hint) : null;
    if (ev.includes("onBlock") && !S.st.logged) { addToLogbook(logEntry(S.st, o, fuelState(S.st, o, S.pr))); S.st.logged = true; }
    if (ev.length) S.events.push(...ev.map((e) => ({ e, t: Date.now() })));
    saveFlight(o, S.st);
  }
  emit();
}

// ---------- weather ----------
export function airportsOfFlight(o = S.ofp) {
  if (!o) return [];
  return [o.dep, o.dest, ...o.altns, ...(o.edto?.airports || [])].filter(Boolean);
}
export async function pollMetars() {
  const apts = airportsOfFlight();
  if (settings.demo) { const m = demoMetars(); for (const a of apts) if (m[a.icao]) S.metar[a.icao] = { raw: m[a.icao], at: Date.now(), src: "VATSIM" }; emit(); return; }
  await Promise.all(apts.map(async (a) => {
    try { const r = await getText(API.metar + a.icao); if (r) S.metar[a.icao] = { raw: r.split("\n")[0], at: Date.now(), src: "VATSIM" }; }
    catch { if (!S.metar[a.icao] && a.metar) S.metar[a.icao] = { raw: a.metar, at: S.ofp?.generated, src: "SimBrief" }; }
  }));
  emit();
}
export function wxOf(icao) {
  const m = S.metar[icao] || (() => { const a = airportsOfFlight().find((x) => x.icao === icao); return a?.metar ? { raw: a.metar, src: "SimBrief" } : null; })();
  return m ? { ...decodeMetar(m.raw), src: m.src, at: m.at } : null;
}
export function atisOf(icao) {
  const list = S.atis.filter((a) => a.callsign.startsWith(icao + "_"));
  if (!list.length) return null;
  const info = atisInfo(list.flatMap((a) => a.text_atis || []));
  const arr = list.find((a) => /_A_ATIS|ARR/.test(a.callsign)) || list[0], dep = list.find((a) => /_D_ATIS|DEP/.test(a.callsign)) || list[0];
  return { ...info, letter: arr.atis_code || info.letter, depLetter: dep.atis_code || info.letter, freq: arr.frequency, list };
}
// runway in use: ATIS, else from the wind, else SimBrief's plan
export function runwayOf(icao, side) {
  const a = atisOf(icao), w = wxOf(icao), o = S.ofp;
  const fromAtis = a ? (side === "dep" ? a.depRwy : a.arrRwy) : "";
  if (fromAtis) return { rwy: fromAtis, src: "ATIS" };
  const fromWind = runwayFromWind(icao, w);
  if (fromWind) return { rwy: fromWind, src: "wind" };
  const plan = side === "dep" ? o?.dep?.rwy : o?.dest?.rwy;
  return plan ? { rwy: plan, src: "plan" } : null;
}

// ---------- ATC online at an airport ----------
const FAC = { 2: "DEL", 3: "GND", 4: "TWR", 5: "APP" };
export function atcAt(icao) {
  const out = [];
  for (const c of S.ctrl) {
    const cs = c.callsign.toUpperCase();
    const type = cs.endsWith("_DEL") ? "DEL" : cs.endsWith("_GND") ? "GND" : cs.endsWith("_TWR") ? "TWR" : /_(APP|DEP)$/.test(cs) ? cs.slice(-3) : FAC[c.facility];
    if (!type || !["DEL", "GND", "TWR", "APP", "DEP"].includes(type)) continue;
    const pre = cs.split("_")[0];
    // airport stations start with the ICAO code; approach often with a shorter prefix (NY_APP, EDDF_APP)
    if (pre === icao || (type === "APP" || type === "DEP") && (icao.startsWith("K") ? pre === icao.slice(1) || icao === "KJFK" && pre === "NY" : false)) out.push({ ...c, type });
  }
  const order = { DEL: 1, GND: 2, TWR: 3, DEP: 4, APP: 5 };
  return out.sort((a, b) => order[a.type] - order[b.type]);
}

// ---------- vIFF CDM (departure slot) ----------
function hhmmToMs(s) {
  const d = String(s || "").replace(/\D/g, ""); if (d.length < 4) return null;
  const h = +d.slice(0, 2), m = +d.slice(2, 4); if (h > 23 || m > 59) return null;
  const now = new Date(); let best = null;
  for (const off of [-1, 0, 1]) { const x = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + off, h, m); if (best == null || Math.abs(x - now) < Math.abs(best - now)) best = x; }
  return best;
}
export async function pollCdm() {
  const o = S.ofp;
  if (!o || S.st?.takeoff) return;
  if (settings.demo) {
    const T = o.times;
    S.cdm = { eobt: T.out, tobt: T.out + 5 * 60e3, tsat: T.out + 9 * 60e3, ttot: T.out + 24 * 60e3, ctot: null, rwy: "30L", sid: "OSTOV1D", reason: "" };
    S.cdmOk = true; emit(); return;
  }
  try {
    const r = await getJSON(API.viff + "/ifps/callsign?callsign=" + encodeURIComponent(o.callsign));
    if (r && r.callsign) {
      const c = r.cdmData || {}, [rwy, sid] = String(c.depInfo || "").split("/");
      S.cdm = { eobt: hhmmToMs(r.eobt), tobt: hhmmToMs(c.tobt || r.tobt), tsat: hhmmToMs(c.tsat), ttot: hhmmToMs(c.ttot), ctot: hhmmToMs(c.ctot || r.ctot),
        aobt: hhmmToMs(r.aobt), atot: hhmmToMs(r.atot), rwy: rwy || "", sid: sid || "", reason: c.reason || r.atfcmData?.mostPenalisingRegulation || "" };
    } else S.cdm = null;
    S.cdmOk = true;
  } catch { S.cdmOk = false; }
  emit();
}

// ---------- stands ----------
export async function loadStandsFor(a) {
  if (!a?.icao || S.stands[a.icao]) return;
  let list = standsCached(a.icao) || await standsGithub(a.icao);
  if (!list && a.pos) { try { list = await standsOverpass(a.icao, a.pos); } catch {} }
  if (list) { S.stands[a.icao] = list; emit(); }
}
// notices and tips of the airline (va/notices.json) and the coming VATSIM events
export async function pollNotices() {
  await Promise.all(["notices", "downloads", "ranks"].map(async (k) => {
    try { const n = await getJSON(API[k]); if (n) { S[k] = n; store.set("asl." + k, n); } } catch {}
  }));
  emit();
}
export async function pollSigmets() {
  if (settings.demo) { S.sigmets = demoSigmets(); emit(); return; }
  try { const d = await getJSON(API.sigmets); if (d?.sigmets) { S.sigmets = d.sigmets; emit(); } } catch {}
}
export async function pollEvents() {
  if (settings.demo) { S.vatEvents = demoEvents(); emit(); return; }
  try { const e = await getJSON(API.events); if (e?.events) { S.vatEvents = e.events; store.set("asl.vatevents", e.events); emit(); } } catch {}
}
export async function pollUkcp() {
  if (!S.ofp?.dest?.icao?.startsWith("EG") || settings.demo) return;
  try { S.ukcp = await getJSON(API.ukcp); } catch {}
}
// stand where the aircraft is parked (within 80 m), or null
export function standAt(icao, pl) {
  const list = S.stands[icao]; if (!list || !pl || pl.groundspeed > 3) return null;
  let best = null, bd = 0.08;
  for (const s of list) { const d = distKm([pl.latitude, pl.longitude], [s.lat, s.lon]); if (d < bd) { bd = d; best = s; } }
  return best;
}
// arrival stand: real VATSIM UK assignment, the actual stand once parked, else a forecast that stays fixed per flight
let fixedArr = null;
export function arrivalStand() {
  const o = S.ofp; if (!o?.dest) return null;
  const icao = o.dest.icao;
  if (S.st?.landing) { const s = standAt(icao, S.pilot); if (s) return { ...s, state: "parked" }; }
  const uk = S.ukcp?.assignments?.[o.callsign];
  if (uk && uk.apt === icao) return { ref: uk.stand, gate: false, state: "assigned", src: "VATSIM UK" };
  if (!S.stands[icao]) return { state: S.stands[icao] === undefined ? "loading" : "none" };
  const key = o.callsign + icao;
  if (!fixedArr || fixedArr.key !== key) {
    const p = predictStand(S.stands[icao], icao, o.dep?.icao, o.callsign, o.type, S.near.arr);
    fixedArr = p ? { key, ...p, state: "forecast" } : null;
  }
  return fixedArr || { state: "none" };
}
export function departureStand() {
  const o = S.ofp; if (!o?.dep) return null;
  const s = !S.st?.offBlock ? standAt(o.dep.icao, S.pilot) : null;
  if (s) return { ...s, state: "parked" };
  return { state: S.stands[o.dep.icao] ? "unknown" : "loading" };
}

// ---------- derived values for the apps ----------
export function derived(now = Date.now()) {
  const o = S.ofp; if (!o || !S.st) return null;
  const phase = phaseOf(S.st, o, S.pilot, S.pr);
  const est = estimates(S.st, o, S.pr, now);
  const fs = fuelState(S.st, o, S.pr);
  const total = o.navlog.at(-1)?.cumNm || o.dist || 0;
  const along = S.st.onBlock || S.st.landing ? total : S.st.takeoff && S.pr ? S.pr.along : 0;
  const next = S.st.takeoff && !S.st.landing && S.pr ? o.navlog[S.pr.i + 1] : null;
  const nextIn = next && S.pr ? next.cumNm - S.pr.along : null;
  const nextEta = next && S.pr ? now + Math.max(0, (next.t - (S.pr ? (o.navlog[S.pr.i].t + ((next.t - o.navlog[S.pr.i].t) * S.pr.f)) : 0)) * 1000) : null;
  return { phase, est, fs, total, along, toGo: Math.max(0, total - along), pct: total ? Math.min(1, along / total) : 0, next, nextIn, nextEta };
}

// ---------- polling ----------
const JOBS = { simbrief: [pollSimbrief, 300e3], feed: [pollFeed, 20e3], metar: [pollMetars, 300e3], cdm: [pollCdm, 30e3], ukcp: [pollUkcp, 120e3],
  notices: [pollNotices, 900e3], events: [pollEvents, 1800e3], sigmets: [pollSigmets, 900e3] };
const busy = {}, next = {};
export function runJob(name, force) {
  if (busy[name]) return Promise.resolve();
  busy[name] = true; next[name] = Date.now() + JOBS[name][1];
  return Promise.resolve(JOBS[name][0](force)).catch(() => {}).finally(() => { busy[name] = false; });
}
export async function refreshAll() {
  await runJob("simbrief", true);
  await runJob("feed");
  runJob("metar"); runJob("cdm"); runJob("ukcp"); runJob("notices"); runJob("events"); runJob("sigmets");
}
export function startPolling() {
  loadRunways().then(emit);
  refreshAll();
  setInterval(() => { const n = Date.now(); for (const k in JOBS) if (n >= (next[k] || 0)) runJob(k); }, 1000);
  // an iPad waking up: load everything again
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshAll(); });
}
export function restart() { // after a settings change
  S.ofp = null; S.st = null; S.pr = null; S.pilot = null; S.cdm = null; S.metar = {}; fixedArr = null; S.ofpErr = "";
  refreshAll();
}
