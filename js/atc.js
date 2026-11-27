// Frequency guide (taken over from the VDGS slot board): which station is responsible now, which one comes next and when.
// Airport stations by callsign prefix (ICAO, US short form, IATA/LID from VATSpy, approach areas from the SimAware TRACON data);
// centers by the airspace boundaries of the VATSpy data project; VATSIM "top-down": an offline station is covered by the next
// higher one; nobody online → UNICOM 122.800. Distances are estimates along the planned route.
import { S } from "./data.js";
import { t } from "./i18n.js";
import { distKm, greatCircle, inRing, getJSON } from "./util.js";
import { cityOf } from "./tz.js";

const VATSPY = "https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/master/";
const TRACON_URL = "https://raw.githubusercontent.com/sbelic95/vdgs-slot-board/atc/tracons.json";
let FIR = null, TRACONS = null, firReq = null, trReq = null, CTAF = null, ctafReq = null;
// US airports: the CTAF of the airport (ctaf-us.json from OurAirports, tools/build-ctaf.py) – shown next to UNICOM when nobody is online
export const ctafOf = (icao) => { const c = CTAF?.[icao]; return c ? { mhz: c[0], twr: c[1] === 1 } : null; };

export function loadAtcData() {
  if (!firReq) firReq = Promise.all([getJSON(VATSPY + "Boundaries.geojson", 60000), fetch(VATSPY + "VATSpy.dat").then((r) => r.text())])
    .then(([geo, dat]) => {
      const feats = geo.features.map((f) => {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        const rings = polys.map((p) => p[0]), b = [180, 90, -180, -90];
        for (const r of rings) for (const [x, y] of r) { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }
        return { id: f.properties.id, bbox: b, rings };
      });
      const firs = [], uirs = new Map(), lids = new Map(); let sec = "";
      for (const line of dat.split(/\r?\n/)) {
        if (line.startsWith("[")) { sec = line.trim(); continue; }
        if (!line.trim() || line.startsWith(";")) continue;
        const c = line.split("|");
        if (sec === "[FIRs]") firs.push({ icao: c[0], name: c[1], prefix: c[2] || c[0], bnd: c[3] || c[0] });
        else if (sec === "[UIRs]") uirs.set(c[0], { name: c[1], firs: (c[2] || "").split(",") });
        else if (sec === "[Airports]" && c[4]) lids.set(c[0], c[4]);
      }
      FIR = { feats, firs, uirs, lids }; idxFor = null; seqKey = "";
    }).catch(() => { firReq = null; });
  if (!trReq) trReq = getJSON(TRACON_URL, 30000).then((d) => { if (Array.isArray(d)) TRACONS = d; }).catch(() => { trReq = null; });
  if (!ctafReq) ctafReq = getJSON("ctaf-us.json", 30000).then((d) => { CTAF = d || {}; seqKey = ""; }).catch(() => { ctafReq = null; });
  return Promise.all([firReq, trReq]);
}
export const atcReady = () => !!FIR;

const onAir = (c) => c.frequency && c.frequency !== "199.998";
function firsAt(pt) {
  const out = [];
  for (const f of FIR.feats) {
    const b = f.bbox;
    if (pt[1] < b[0] || pt[1] > b[2] || pt[0] < b[1] || pt[0] > b[3]) continue;
    if (f.rings.some((r) => inRing(pt, r))) out.push(f.id);
  }
  return out;
}
// boundary id → online center / radio stations covering it (the own FIR before a UIR above it)
let idx = null, idxFor = null;
function ctrIndex() {
  if (idxFor === S.feedAt && idx) return idx;
  idx = new Map();
  const add = (bnd, c, lvl, name) => { if (!idx.has(bnd)) idx.set(bnd, []); idx.get(bnd).push({ c, lvl, name }); };
  for (const c of S.ctrl || []) {
    if ((c.facility !== 6 && c.facility !== 1) || !onAir(c)) continue;
    const parts = c.callsign.split("_"); parts.pop();
    for (let n = parts.length; n > 0; n--) {
      const pre = parts.slice(0, n).join("_");
      let hits = FIR.firs.filter((f) => f.prefix === pre);
      if (!hits.length) hits = FIR.firs.filter((f) => f.icao === pre);
      if (hits.length) { new Set(hits.map((f) => f.bnd)).forEach((b) => add(b, c, 0, hits[0].name)); break; }
      const u = FIR.uirs.get(pre);
      if (u) { new Set(FIR.firs.filter((f) => u.firs.includes(f.icao)).map((f) => f.bnd)).forEach((b) => add(b, c, 1, u.name)); break; }
    }
  }
  for (const l of idx.values()) l.sort((a, b) => a.lvl - b.lvl || a.c.callsign.localeCompare(b.c.callsign));
  idxFor = S.feedAt;
  return idx;
}
function ctrAt(pt) {
  if (!FIR || !pt) return null;
  const ix = ctrIndex(); let best = null; const all = [];
  for (const id of firsAt(pt)) for (const x of ix.get(id) || []) { all.push(x); if (!best || x.lvl < best.lvl) best = x; }
  return best && { ...best, alts: all.filter((x) => x.lvl === best.lvl && x.c.callsign !== best.c.callsign).filter((x, i, a) => a.findIndex((y) => y.c.callsign === x.c.callsign) === i) };
}
// all stations of an airport by kind (main one first, the others as alternatives)
export function aptStations(icao, pos) {
  const out = { all: { del: [], gnd: [], twr: [], app: [], dep: [] } };
  if (!icao) return out;
  const pres = new Set([icao]);
  if (/^K[A-Z]{3}$/.test(icao)) pres.add(icao.slice(1));
  const lid = FIR?.lids?.get(icao); if (lid) pres.add(lid);
  const kindOf = (c) => ({ 2: "del", 3: "gnd", 4: "twr", 5: c.callsign.endsWith("_DEP") ? "dep" : "app" })[c.facility];
  const tracons = pos && TRACONS ? TRACONS.filter((x) => pos[1] >= x.b[0] && pos[1] <= x.b[2] && pos[0] >= x.b[1] && pos[0] <= x.b[3] && x.r.some((r) => inRing(pos, r))) : [];
  for (const c of S.ctrl || []) {
    const k = kindOf(c); if (!k || !onAir(c)) continue;
    const pre = c.callsign.split("_")[0];
    const byTracon = !pres.has(pre) && (c.facility === 5 || c.facility === 4) && tracons.some((x) => x.p.includes(pre) && (x.s ? c.callsign.endsWith("_" + x.s) : c.facility === 5));
    if (pres.has(pre) || byTracon) out.all[k].push(c);
  }
  for (const k in out.all) {
    out.all[k].sort((a, b) => a.callsign.split("_").length - b.callsign.split("_").length || a.callsign.localeCompare(b.callsign));
    const [first, ...rest] = out.all[k];
    out[k] = first ? { ...first, _alts: rest } : null;
  }
  out.atis = (S.atis || []).filter((a) => pres.has(a.callsign.split("_")[0])).sort((a, b) => (/_A_ATIS$/.test(b.callsign) ? 1 : 0) - (/_A_ATIS$/.test(a.callsign) ? 1 : 0))[0] || null;
  return out;
}
const td = (...l) => l.find(Boolean) || null;
const FAC = { 1: "Radio", 2: "Delivery", 3: "Ground", 4: "Tower", 5: "Approach", 6: "Radar" };
// a station at an airport: with nobody online, a US airport also gets its CTAF
function stnA(icao, c, place) { const s = stn(c, place); if (s.unicom) { const f = ctafOf(icao); if (f) return { ...s, ctaf: f.mhz, ctafTwr: f.twr, apt: icao }; } return s; }
function stn(c, place) {
  if (!c) return { cs: "UNICOM", mhz: "122.800", name: t("No controller online"), unicom: true, alt: [] };
  if (c.c) return { ...stn(c.c, c.name), alt: (c.alts || []).map((x) => ({ cs: x.c.callsign, mhz: x.c.frequency })) };
  let kind = c.callsign.endsWith("_DEP") ? "Departure" : FAC[c.facility] || "";
  if (place && /radar|control|cent(er|re)|radio|information|oceanic/i.test(place)) kind = "";
  return { cs: c.callsign, mhz: c.frequency, name: [place, kind].filter(Boolean).join(" "), alt: (c._alts || []).map((x) => ({ cs: x.callsign, mhz: x.frequency })) };
}

// centers along the rest of the route: [{x: station or null, km: distance ahead}]
let seq = [], seqKey = "";
function ctrSequence(from, arrPos, nav) {
  const key = S.feedAt + "|" + from.map((v) => v.toFixed(2)) + "|" + (arrPos || "");
  if (seqKey === key) return seq;
  let pts = [from];
  if (arrPos) {
    let i = -1, bd = Infinity;
    nav.forEach((p, k) => { const d = distKm(from, p); if (d < bd) { bd = d; i = k; } });
    if (i >= 0 && distKm(nav[i], arrPos) > distKm(from, arrPos)) i++;
    pts = [from, ...(i >= 0 ? nav.slice(i) : []), arrPos];
  }
  const out = []; let km = 0, last;
  if (pts.length === 1) out.push({ x: ctrAt(from), km: 0 });
  for (let s = 0; s < pts.length - 1; s++) {
    const d = distKm(pts[s], pts[s + 1]), n = Math.max(1, Math.min(200, Math.ceil(d / 15)));
    const g = n > 1 ? greatCircle(pts[s], pts[s + 1], n) : [pts[s], pts[s + 1]];
    for (let k = s === 0 ? 0 : 1; k < g.length; k++) {
      if (k > 0) km += distKm(g[k - 1], g[k]);
      const x = ctrAt(g[k]), cs = x?.c.callsign || "";
      if (cs !== last) { out.push({ x, km }); last = cs; }
    }
  }
  seq = out; seqKey = key;
  return out;
}

// the whole chain from here: {cur, next, later, atisArr, airborne}
export function freqPlan() {
  const o = S.ofp; if (!o) return null;
  const pl = S.pilot, depI = o.dep?.icao, arrI = o.dest?.icao;
  const D = aptStations(depI, o.dep?.pos), A = aptStations(arrI, o.dest?.pos);
  const dc = cityOf(o.dep) || depI, ac = cityOf(o.dest) || arrI;
  const pos = pl ? [pl.latitude, pl.longitude] : null;
  const gs = pl?.groundspeed || 0, alt = pl?.altitude || 0, airborne = gs > 60 || (!!S.st?.takeoff && !S.st?.landing && !pl);
  const distDep = pos && o.dep?.pos ? distKm(pos, o.dep.pos) : null, remain = pos && o.dest?.pos ? distKm(pos, o.dest.pos) : null;
  const atDest = !!S.st?.landing || (!airborne && remain != null && remain < 15 && (distDep == null || distDep > 15));
  const here = pos ? ctrAt(pos) : o.dep?.pos ? ctrAt(o.dep.pos) : null, arrCtr = o.dest?.pos ? ctrAt(o.dest.pos) : null;
  const kmh = (gs > 100 ? gs : 440) * 1.852, mins = (km) => (airborne ? Math.round((km / kmh) * 60) : null);
  const APP_KM = 100, TWR_KM = 20;
  const steps = [], push = (role, st, when, km = null) => steps.push({ role, st, when, km });
  const depApp = td(D.dep, D.app);
  const depZone = airborne && distDep != null && distDep < 50 && alt < 12000 && (remain == null || remain > APP_KM);
  if (!airborne && !atDest) {
    if (gs < 3) push(t("Clearance"), stnA(depI, td(D.del, D.gnd, D.twr, depApp, here), dc), t("now"));
    push(t("Push-back and taxi"), stnA(depI, td(D.gnd, D.twr, depApp, here), dc), gs < 3 ? t("after the clearance") : t("now"));
    push(t("Take-off"), stnA(depI, td(D.twr, depApp, here), dc), t("at the holding point"));
    push(t("Departure"), stn(td(depApp, here), dc), t("after take-off, when Tower says"));
  } else if (depZone) {
    if (distDep < 10 && alt < 3000) push(t("Take-off"), stnA(depI, td(D.twr, depApp, here), dc), t("now"));
    push(t("Departure"), stn(td(depApp, here), dc), distDep < 10 && alt < 3000 ? t("after take-off, when Tower says") : t("now"));
  }
  if (!atDest) {
    const from = airborne && pos ? pos : o.dep?.pos, total = from && o.dest?.pos ? distKm(from, o.dest.pos) : null;
    if (airborne && !FIR) push(t("En route"), { cs: "", mhz: "…", name: t("loading the airspaces…"), alt: [] }, t("now"), 0);
    if (from && FIR) {
      for (const s of ctrSequence(from, o.dest?.pos, o.navlog.map((x) => x.pos))) {
        if (total != null && s.km > Math.max(0, total - APP_KM)) break;
        if (depZone && s.km < 1) continue;
        if (!airborne && s.km < 1 && steps.at(-1)?.st.cs === stn(s.x).cs) continue;
        push(t("En route"), stn(s.x), s.km < 1 ? t("now") : t("at the airspace boundary"), s.km);
      }
    }
    const r = remain ?? total;
    if (arrI) {
      push(t("Approach") + " " + arrI, stnA(arrI, td(A.app, arrCtr), ac), t("about {n} km before the destination", { n: APP_KM }), r != null ? Math.max(0, r - APP_KM) : null);
      push(t("Landing"), stnA(arrI, td(A.twr, A.app, arrCtr), ac), t("on final"), r != null ? Math.max(0, r - TWR_KM) : null);
      push(t("Taxi to the stand"), stnA(arrI, td(A.gnd, A.twr, A.app, arrCtr), ac), t("after vacating the runway"), r);
    }
  } else push(t("Taxi to the stand"), stnA(arrI, td(A.gnd, A.twr, A.app, arrCtr), ac), t("now"));
  const merged = [];
  for (const s of steps) {
    const prev = merged.at(-1);
    if (prev && prev.st.cs === s.st.cs && (prev.st.ctaf || "") === (s.st.ctaf || "")) { if (!prev.role.includes(s.role)) prev.role += " · " + s.role; continue; }
    merged.push({ ...s });
  }
  let cur = 0;
  if (airborne && remain != null && !depZone) {
    merged.forEach((s, i) => { if (s.km != null && s.km <= 0.5) cur = i; });
    if (remain < APP_KM) cur = Math.max(cur, merged.findIndex((s) => s.role.startsWith(t("Approach"))));
    if (remain < TWR_KM && alt < 5000) cur = Math.max(cur, merged.findIndex((s) => s.role.includes(t("Landing"))));
    cur = Math.max(0, cur);
  }
  const out = merged.slice(cur).map((s) => ({ ...s, min: s.km != null ? mins(s.km) : null }));
  const atisArr = A.atis && airborne && remain != null && remain < 300 && remain > 15 ? A.atis : null;
  const soon = !!out[1] && airborne && ((out[1].min != null && out[1].min <= 3) || (out[1].km != null && out[1].km <= 25));
  return { cur: out[0], next: out[1], later: out.slice(2), atisArr, airborne, soon, dep: D, arr: A };
}
