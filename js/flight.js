// Where the aircraft is on its route, what phase it is in, the times it reached, fuel checks and the logbook entry.
import { distKm, rad, store, clamp } from "./util.js";

const R_NM = 3440.065;
function bearingRad(a, b) {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return Math.atan2(y, x);
}
const angNm = (a, b) => distKm(a, b) / 1.852 / R_NM; // angular distance in radians

// Project position p onto the route. Returns the segment index i (from fix i to i+1), the fraction along it,
// the distance flown along the route (nm, SimBrief leg distances) and the cross-track distance.
export function project(fixes, p, hint = 0) {
  if (!fixes?.length || !p) return null;
  if (fixes.length === 1) return { i: 0, f: 0, along: 0, cross: distKm(fixes[0].pos, p) / 1.852 };
  let best = null;
  for (let i = 0; i < fixes.length - 1; i++) {
    const A = fixes[i].pos, B = fixes[i + 1].pos;
    const d13 = angNm(A, p), d12 = angNm(A, B);
    let f, cross;
    if (d12 < 1e-9) { f = 0; cross = d13 * R_NM; }
    else {
      const dxt = Math.asin(clamp(Math.sin(d13) * Math.sin(bearingRad(A, p) - bearingRad(A, B)), -1, 1));
      let dat = Math.acos(clamp(Math.cos(d13) / Math.cos(dxt), -1, 1));
      if (Math.cos(bearingRad(A, p) - bearingRad(A, B)) < 0) dat = -dat;
      f = dat / d12;
      if (f < 0) { f = 0; cross = d13 * R_NM; } else if (f > 1) { f = 1; cross = angNm(B, p) * R_NM; } else cross = Math.abs(dxt) * R_NM;
    }
    // prefer segments near the last one (routes can come back close to themselves)
    const score = cross + (i < hint - 1 ? 30 + (hint - i) : 0);
    if (!best || score < best.score) best = { i, f, cross, score };
  }
  const A = fixes[best.i], B = fixes[best.i + 1];
  return { i: best.i, f: best.f, cross: best.cross, along: A.cumNm + (B.cumNm - A.cumNm) * best.f };
}

// planned values at the projected position
export function planAt(fixes, pr, key) {
  if (!pr) return null;
  const a = fixes[pr.i]?.[key], b = fixes[pr.i + 1]?.[key];
  if (a == null) return b ?? null;
  if (b == null) return a;
  return a + (b - a) * pr.f;
}

export const flightKey = (ofp) => {
  const day = ofp.times.out ? new Date(ofp.times.out).toISOString().slice(0, 10) : "";
  return `asl.flight.${ofp.callsign}.${ofp.dep?.icao}.${ofp.dest?.icao}.${day}`;
};
export function loadFlight(ofp) {
  return { offBlock: null, takeoff: null, landing: null, onBlock: null, lastSeen: null, lastAlt: null, lastAltT: null, vs: 0,
    hint: 0, seenI: null, fixTimes: {}, checks: [], track: [], logged: false, still: 0, ...store.get(flightKey(ofp), {}) };
}
export const saveFlight = (ofp, st) => store.set(flightKey(ofp), st);

// Advance the flight state from a live position (VATSIM pilot or simulator). Returns events for notifications.
export function updateFlight(st, ofp, pl, now = Date.now()) {
  const ev = [];
  const dep = ofp.dep?.pos, dest = ofp.dest?.pos;
  if (!pl) {
    // disconnected after landing (common): count the last time we saw the aircraft as on-block
    if (st.landing && !st.onBlock && st.lastSeen && now - st.lastSeen > 3 * 60e3) { st.onBlock = st.lastSeen; ev.push("onBlock"); }
    return ev;
  }
  const p = [pl.latitude, pl.longitude], gs = pl.groundspeed || 0, alt = pl.altitude || 0;
  const atDep = dep && distKm(p, dep) < 8, atDest = dest && distKm(p, dest) < 12;
  if (st.lastAltT && now - st.lastAltT > 20e3) { st.vs = ((alt - st.lastAlt) / (now - st.lastAltT)) * 60e3; st.lastAlt = alt; st.lastAltT = now; }
  else if (!st.lastAltT) { st.lastAlt = alt; st.lastAltT = now; }
  st.lastSeen = now;
  if (!st.offBlock && gs >= 3 && atDep) { st.offBlock = now; ev.push("offBlock"); }
  if (!st.takeoff && gs >= 90) { st.takeoff = now; if (!st.offBlock) st.offBlock = now - 10 * 60e3; ev.push("takeoff"); }
  if (st.takeoff && !st.landing && gs < 70 && atDest && alt < (ofp.dest?.elev || 0) + 1500) { st.landing = now; ev.push("landing"); }
  if (st.landing && !st.onBlock) {
    st.still = gs < 1 ? (st.still || 0) + 1 : 0;
    if (st.still >= 3) { st.onBlock = now; ev.push("onBlock"); }
  }
  // route position, fix passages
  const pr = project(ofp.navlog, p, st.hint);
  if (pr && st.takeoff) {
    st.hint = pr.i;
    if (st.seenI != null) for (let k = st.seenI + 1; k <= pr.i; k++) { const id = k + ":" + ofp.navlog[k].ident; if (!st.fixTimes[id]) st.fixTimes[id] = now; }
    st.seenI = Math.max(st.seenI ?? -1, pr.i);
  }
  // flown track: a point every 2 minutes or 15 km
  const last = st.track[st.track.length - 1];
  if (st.offBlock && !st.onBlock && (!last || now - last[3] > 120e3 || distKm(p, last) > 15)) {
    st.track.push([+p[0].toFixed(4), +p[1].toFixed(4), Math.round(alt), now]);
    if (st.track.length > 900) st.track = st.track.filter((_, k) => k % 2 === 0);
  }
  return ev;
}

// flight phase for display
export function phaseOf(st, ofp, pl, pr) {
  if (st.onBlock) return "onblock";
  if (st.landing) return "taxiin";
  if (st.takeoff) {
    const alt = pl?.altitude ?? 0, cruise = ofp.cruise || 30000;
    const toGo = pr ? (ofp.dist || ofp.navlog.at(-1)?.cumNm || 0) - pr.along : null;
    if (toGo != null && toGo < 35) return "approach";
    if (alt >= cruise - 1500 && Math.abs(st.vs || 0) < 500) return "cruise";
    const tod = ofp.navlog.find((x) => x.stage === "DSC");
    if ((pr && tod && pr.along >= tod.cumNm - 5) || (st.vs || 0) < -500) return "descent";
    return "climb";
  }
  if (st.offBlock) return "taxiout";
  return "preflight";
}

// top of climb / descent along the route (nm)
export function tocTod(ofp) {
  const nl = ofp.navlog;
  const toc = nl.find((x) => x.ident === "TOC") || nl.find((x) => x.stage === "CRZ");
  const tod = nl.find((x) => x.ident === "TOD") || nl.find((x) => x.stage === "DSC");
  return { toc: toc?.cumNm ?? null, tod: tod ? (nl[nl.indexOf(tod) - 1]?.cumNm ?? tod.cumNm) : null };
}

// times: estimated take-off, landing and on-block; delay against the schedule
export function estimates(st, ofp, pr, now = Date.now()) {
  const T = ofp.times, taxiOut = T.off && T.out ? T.off - T.out : 15 * 60e3, taxiIn = T.in && T.on ? T.in - T.on : 8 * 60e3;
  const ete = (T.ete || 0) * 1000 || (T.on && T.off ? T.on - T.off : 0);
  const totalT = ofp.navlog.at(-1)?.t ?? (ete / 1000);
  let off = st.takeoff || (st.offBlock ? st.offBlock + taxiOut : Math.max(T.off || 0, now + taxiOut));
  let on;
  if (st.landing) on = st.landing;
  else if (st.takeoff && pr) { const tAt = planAt(ofp.navlog, pr, "t") ?? 0; on = now + Math.max(0, totalT - tAt) * 1000; }
  else on = off + ete;
  const inn = st.onBlock || on + taxiIn;
  return { off, on, in: inn, delay: T.in ? inn - T.in : null, taxiOut, taxiIn };
}

// fuel: plan at the position, last check, expected landing fuel
export function fuelState(st, ofp, pr) {
  const planNow = pr ? planAt(ofp.navlog, pr, "fob") : null;
  const last = st.checks[st.checks.length - 1] || null;
  const dev = last ? last.dev : null;
  const planLdg = ofp.fuel.landing;
  const expLdg = planLdg != null ? planLdg + (dev || 0) : null;
  const minLdg = (ofp.fuel.altn || 0) + (ofp.fuel.final || 0);
  // trend: change of the deviation per 1000 nm, from the first to the last check (needs 300 nm between them)
  let trend = null;
  if (st.checks.length >= 2) {
    const a = st.checks[0], b = last;
    if (b.along - a.along > 300) {
      const rate = (b.dev - a.dev) / (b.along - a.along);
      const toGo = (ofp.navlog.at(-1)?.cumNm || 0) - b.along;
      trend = planLdg + b.dev + rate * toGo;
    }
  }
  return { planNow, last, dev, planLdg, expLdg, minLdg, trend };
}
export function addCheck(st, ofp, pr, fob, now = Date.now()) {
  const plan = pr ? planAt(ofp.navlog, pr, "fob") : ofp.fuel.takeoff;
  const next = pr ? ofp.navlog[pr.i + 1] : null;
  const c = { t: now, fob, plan: Math.round(plan ?? fob), dev: Math.round(fob - (plan ?? fob)), along: pr?.along ?? 0, fix: next?.ident || "" };
  st.checks.push(c);
  return c;
}

// logbook entry for a finished (or manually added) flight
export function logEntry(st, ofp, fs) {
  const pts = st.track.length > 3 ? st.track.map((x) => [x[0], x[1]]) : ofp.navlog.map((x) => x.pos);
  const step = Math.max(1, Math.floor(pts.length / 120));
  return {
    id: flightKey(ofp).slice(11) + ":" + (st.onBlock || Date.now()), date: st.offBlock || ofp.times.out || Date.now(),
    callsign: ofp.callsign, flightNo: ofp.iataNo || ofp.callsign, dep: ofp.dep?.icao, arr: ofp.dest?.icao,
    depName: ofp.dep?.name || "", arrName: ofp.dest?.name || "", type: ofp.type, reg: ofp.reg, pax: ofp.pax,
    schedOut: ofp.times.out, schedIn: ofp.times.in, offBlock: st.offBlock, takeoff: st.takeoff, landing: st.landing, onBlock: st.onBlock,
    distNm: ofp.dist || Math.round(ofp.navlog.at(-1)?.cumNm || 0), units: ofp.units, blockFuel: ofp.fuel.block,
    landingFuel: fs?.expLdg ?? null, checks: st.checks.length, route: ofp.route,
    path: pts.filter((_, k) => k % step === 0 || k === pts.length - 1).map((x) => [+x[0].toFixed(3), +x[1].toFixed(3)]),
  };
}
