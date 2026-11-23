// Flight suggestions, booking and the plan check.
// Only the Air Serbia network: suggestions and bookings come from va/routes.json (a proposal until the VA confirms it), the logbook
// (where you are, your most flown type, routes you have not flown), the coming VATSIM events and the callsigns in use on VATSIM.
// Booking: flight, aircraft, time and callsign → SimBrief makes the plan (prefilled) → the pad loads it → prefile on VATSIM.
// The plan card shows fuel and weights of the SimBrief OFP; the pilot can change the block fuel with + and −
// (simple sums with the OFP figures – no performance is computed).
import { S, settings, logbook, wxOf, runJob, departureStand, arrivalStand, emit } from "./data.js";
import { FLEET } from "./apps/ops.js";
import { t, nf } from "./i18n.js";
import { esc, store, hhmmz, dur, distNm } from "./util.js";
import { fmtW } from "./units.js";
import { sheet } from "./sheet.js";
import { pilot } from "./account.js";

const SB = "https://dispatch.simbrief.com/options/custom";
const DAY = 864e5;

// ---------- helpers ----------
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const blockMin = (nm) => Math.round(25 + nm / 7.3); // rough block time: taxi, climb and descent, ~440 kt in cruise
const quarter = (ms) => Math.ceil(ms / 9e5) * 9e5;
// the Air Serbia network (va/routes.json): airports and routes, each route both ways; seasonal ones only in their season
const NET = () => S.routes?.airports && S.routes?.routes ? S.routes : { base: "LYBE", airports: {}, routes: [] };
const home = () => NET().base || "LYBE";
const apt = (icao) => NET().airports[icao] || null;
const posOf = (icao) => (apt(icao) ? [apt(icao).lat, apt(icao).lon] : null);
const nameOf = (icao) => apt(icao)?.name || icao;
const season = (now) => { const m = new Date(now).getUTCMonth(); return m >= 3 && m <= 9 ? "summer" : "winter"; };
export function legs(now = Date.now()) {
  const se = season(now);
  return NET().routes.filter((r) => !r.season || r.season === se).flatMap((r) => [{ dep: r.from, dest: r.to, r }, { dep: r.to, dest: r.from, r }]);
}
const legOf = (dep, dest, now) => legs(now).find((l) => l.dep === dep && l.dest === dest) || null;
export const inNetwork = (dep, dest) => !!legOf(dep, dest);
export const fleetAll = () => [...FLEET, ...store.get("asl.fleet", [])];

// a callsign that is neither flying nor prefiled on VATSIM right now (ASL + 3 digits, stable for a route)
export function freeCallsign(seed) {
  let n = 100 + (hash(seed) % 800);
  for (let i = 0; i < 900; i++, n = 100 + ((n - 100 + 7) % 900)) { const cs = "ASL" + n; if (!S.inUse.has(cs)) return cs; }
  return "ASL" + n;
}
export const callsignFree = (cs) => !S.inUse.has(String(cs).toUpperCase());

// your most flown type in the last 20 flights
function topType() {
  const c = {};
  for (const e of logbook().slice(0, 20)) if (e.type) c[e.type] = (c[e.type] || 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
// events on VATSIM at an airport in the next 12 hours
const eventAt = (icao, now) => (S.vatEvents || []).find((e) => (e.airports || []).includes(icao) && Date.parse(e.end) > now && Date.parse(e.start) < now + 12 * 36e5);

// ---------- suggestions: only routes of the Air Serbia network ----------
export function suggestions(now = Date.now()) {
  const L = legs(now); if (!L.length) return [];
  const base = home(), log = logbook(), last = log[0], type = topType();
  const flown = new Set(log.map((e) => e.dep + e.arr));
  // where the aircraft is: where your last flight ended, if that is in the network
  const here = last?.arr && L.some((l) => l.dep === last.arr) ? last.arr : base;
  const off = quarter(now + 40 * 60e3), dayKey = Math.floor(now / DAY);
  const make = (l) => {
    const { dep, dest, r } = l, a = posOf(dep), b = posOf(dest), nm = a && b ? Math.round(distNm(a, b)) : 0, blk = blockMin(nm) * 60e3;
    const types = r.types?.length ? r.types : ["A319"], ac = type && types.includes(type) ? type : types[0];
    const ev = eventAt(dest, now), reasons = [];
    let score = (hash(dep + dest + dayKey) % 100) / 100;
    if (dest === base && dep !== base) { score += 10; reasons.push(["home", t("Back to {city} from where you landed last", { city: nameOf(base) })]); }
    if (ev) { score += 3; reasons.push(["ev", t("Event at {icao}: {name}", { icao: dest, name: ev.name })]); }
    if (!flown.has(dep + dest)) { score += 2; reasons.push(["new", t("A route you have not flown yet")]); }
    if (type && ac === type) { score += 1; reasons.push(["type", t("Your most flown type lately: {t}", { t: type })]); }
    const backBy = dep === base ? off + blk * 2 + 50 * 60e3 : off + blk;
    return { dep, dest, nm, type: ac, off, block: blk, arr: off + blk, backBy, callsign: freeCallsign(dep + dest), reasons, score, event: ev };
  };
  return L.filter((l) => l.dep === here).map(make).sort((a, b) => b.score - a.score).slice(0, 6);
}

export function suggestCard(now = Date.now()) {
  const list = suggestions(now);
  if (!list.length) return `<div class="hb-card bk-sug"><div class="lbl">${t("Suggested for you")}</div><div class="dim hb-empty">${t("Loading the route network…")}</div></div>`;
  const i = (store.get("asl.sugIdx", 0) || 0) % list.length, s = list[i], free = callsignFree(s.callsign);
  return `<div class="hb-card bk-sug"><div class="bk-sug-top"><div class="lbl">Air Serbia · ${t("Suggested for you")}</div><span class="dim">${i + 1}/${list.length}</span></div>
    <div class="bk-legs"><div><b>${esc(s.dep)}</b><span>${esc(nameOf(s.dep))}</span></div>
      <div class="bk-line"><span>${hhmmz(s.off)}</span><i></i><span>${dur(s.block)} · ${nf(s.nm)} NM</span><i></i><span>${hhmmz(s.arr)}</span></div>
      <div class="r"><b>${esc(s.dest)}</b><span>${esc(nameOf(s.dest))}</span></div></div>
    <div class="bk-chips"><span class="bk-chip">${esc(s.type)}</span><span class="bk-chip ${free ? "ok" : "bad"}">${esc(s.callsign)} ${free ? "✓" : "✗"}</span>
      ${s.dep === home() ? `<span class="bk-chip">${t("Back in {city} by {t}", { city: nameOf(home()), t: hhmmz(s.backBy) })}</span>` : ""}</div>
    ${s.reasons.length ? `<ul class="bk-why">${s.reasons.map(([k, x]) => `<li class="${k}">${esc(x)}</li>`).join("")}</ul>` : ""}
    <div class="bk-act"><button class="btn small pri" data-bk="book">${t("Book this flight")}</button><button class="btn small" data-bk="next">${t("Another one")}</button>
      <button class="btn small" data-bk="new">${t("Pick a route")}</button></div></div>`;
}

// ---------- the booking from the dashboard (signed in): plan it in SimBrief with one tap ----------
export function vamBookingCard(now = Date.now()) {
  const list = (pilot()?.bookings || []).filter((b) => !b.at || b.at > now - 6 * 36e5).sort((a, b) => (a.at || 9e15) - (b.at || 9e15));
  if (!list.length) return "";
  const b = list[0];
  return `<div class="hb-card bk-sug"><div class="bk-sug-top"><div class="lbl">${t("Your booking")}</div>${list.length > 1 ? `<span class="dim">+${list.length - 1}</span>` : ""}</div>
    <div class="bk-legs"><div><b>${esc(b.dep)}</b><span>${esc(nameOf(b.dep))}</span></div><div class="bk-line"><span>${b.at ? hhmmz(b.at) : ""}</span><i></i><span>${esc(b.callsign || b.number || "")}</span><i></i><span></span></div>
      <div class="r"><b>${esc(b.arr)}</b><span>${esc(nameOf(b.arr))}</span></div></div>
    <div class="bk-chips">${b.type ? `<span class="bk-chip">${esc(b.type)}</span>` : ""}${b.reg ? `<span class="bk-chip">${esc(b.reg)}</span>` : ""}</div>
    <div class="bk-act"><button class="btn small pri" data-bk="vam-book">${t("Plan in SimBrief")}</button></div></div>`;
}

// ---------- booking: only Air Serbia routes and ASL callsigns ----------
function simbriefUrl(b) {
  const m = /^([A-Z]{3})(\w+)$/.exec(b.callsign) || [];
  const d = new Date(b.off);
  const q = { orig: b.dep, dest: b.dest, type: b.type, reg: b.reg || "", airline: "ASL", fltnum: m[2] || "", callsign: b.callsign,
    deph: String(d.getUTCHours()), depm: String(d.getUTCMinutes()) };
  return SB + "?" + new URLSearchParams(Object.entries(q).filter(([, v]) => v !== "")).toString();
}
export const booking = () => store.get("asl.booking", null);
const CS_OK = /^ASL\d{1,4}[A-Z]{0,2}$/;

export function openBooking(pre) {
  const L = legs(), froms = [...new Set(L.map((l) => l.dep))].sort((a, b) => (a === home() ? -1 : b === home() ? 1 : nameOf(a).localeCompare(nameOf(b))));
  const s0 = pre && L.some((l) => l.dep === pre.dep && l.dest === pre.dest) ? pre : { ...(pre || {}), dep: pre && froms.includes(pre.dep) ? pre.dep : home(), dest: "" };
  const s = { type: "A319", off: quarter(Date.now() + 40 * 60e3), callsign: freeCallsign(String(Date.now() / DAY | 0)), ...s0 };
  if (!CS_OK.test(s.callsign || "")) s.callsign = freeCallsign(s.dep + s.dest);
  const hhmm = hhmmz(s.off).slice(0, 5);
  const fromOpts = froms.map((a) => `<option value="${a}" ${a === s.dep ? "selected" : ""}>${esc(nameOf(a))} · ${a}</option>`).join("");
  const toOpts = (dep, sel) => L.filter((l) => l.dep === dep).sort((a, b) => nameOf(a.dest).localeCompare(nameOf(b.dest)))
    .map((l) => `<option value="${l.dest}" ${l.dest === sel ? "selected" : ""}>${esc(nameOf(l.dest))} · ${l.dest}${l.r.season ? " · " + (l.r.season === "summer" ? t("summer") : t("winter")) : ""}</option>`).join("");
  const acOpts = (dep, dest, reg) => {
    const types = legOf(dep, dest)?.r.types || [], list = fleetAll(), fit = list.filter((a) => !types.length || types.includes(a.type));
    const pick = reg && fit.some((a) => a.reg === reg) ? reg : fit[0]?.reg;
    return (fit.length ? fit : list).map((a) => `<option value="${esc(a.reg)}|${esc(a.type)}" ${a.reg === pick ? "selected" : ""}>${esc(a.reg)} · ${esc(a.type)}</option>`).join("")
      + types.filter((ty) => !list.some((a) => a.type === ty)).map((ty) => `<option value="|${esc(ty)}">${esc(ty)}</option>`).join("");
  };
  const steps = (n) => `<div class="bk-steps">${[t("Flight"), t("Aircraft and time"), t("Flight plan"), t("Prefile")].map((x, k) => `<div class="${k < n ? "done" : k === n ? "on" : ""}"><i>${k + 1}</i><span>${esc(x)}</span></div>`).join("")}</div>`;
  const form = `${steps(1)}<h2 style="margin:6px 0 4px">${t("Book a flight")}</h2><p class="dim" style="font-size:13px;margin:0 0 12px">${t("Only routes of the Air Serbia network.")}</p>
    <div class="bk-form">
      <label><div class="lbl">${t("From")}</div><select name="dep">${fromOpts}</select></label>
      <label><div class="lbl">${t("To")}</div><select name="dest">${toOpts(s.dep, s.dest)}</select></label>
      <label class="w2"><div class="lbl">${t("Aircraft")}</div><select name="ac">${acOpts(s.dep, s.dest, s.reg)}</select></label>
      <label><div class="lbl">${t("Off-block (UTC)")}</div><input name="off" type="time" value="${hhmm}"></label>
      <label><div class="lbl">${t("Callsign")} <span class="bk-cs"></span></div><input name="cs" value="${esc(s.callsign)}" maxlength="8" autocapitalize="characters"></label>
      <div class="w2 dim" style="font-size:12.5px">${t("Network")}: <b>VATSIM</b> · ${t("SimBrief opens with everything filled in. Check it there and press Generate.")}</div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn" data-close>${t("Cancel")}</button><a class="btn pri" data-go target="_blank" rel="noopener" href="#">${t("Plan in SimBrief")} ↗</a></div>`;
  const after = (b) => `${steps(2)}<h2 style="margin:6px 0 8px">${esc(b.callsign)} · ${esc(b.dep)} → ${esc(b.dest)}</h2>
    <p class="dim" style="font-size:14px;margin:0 0 14px">${t("When SimBrief has made the plan, load it here. Then check the fuel and prefile on VATSIM in the plan card.")}</p>
    <div style="display:flex;gap:10px;justify-content:flex-end"><a class="btn" href="${esc(simbriefUrl(b))}" target="_blank" rel="noopener">${t("Open SimBrief again")}</a><button class="btn pri" data-load>${t("Load my plan")}</button></div>`;
  const { el } = sheet(form, (e, close, box) => {
    if (e.target.closest("[data-load]")) { runJob("simbrief", true).then(() => { emit(); close(); }); return; }
    const go = e.target.closest("[data-go]"); if (!go) return;
    const b = read(box);
    if (!inNetwork(b.dep, b.dest) || !CS_OK.test(b.callsign)) { e.preventDefault(); if (!CS_OK.test(b.callsign)) box.querySelector("[name=cs]").style.borderColor = "var(--red)"; return; }
    go.href = simbriefUrl(b); // the link opens SimBrief in a new tab (allowed on the iPad because it is a real tap on a link)
    store.set("asl.booking", { ...b, at: Date.now() });
    setTimeout(() => { box.querySelector(".box").innerHTML = after(b); }, 50);
  });
  const read = (box) => {
    const v = (n) => box.querySelector(`[name=${n}]`).value.trim().toUpperCase();
    const [reg, type] = box.querySelector("[name=ac]").value.split("|");
    const [h, mi] = (box.querySelector("[name=off]").value || hhmm).split(":").map(Number);
    let off = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), h, mi);
    if (off < Date.now() - 60 * 60e3) off += DAY; // a time earlier today means tomorrow
    return { dep: v("dep"), dest: v("dest"), reg, type: type || s.type, off, callsign: v("cs") };
  };
  const csCheck = () => {
    const cs = el.querySelector("[name=cs]")?.value.trim().toUpperCase(), sp = el.querySelector(".bk-cs"); if (!sp) return;
    sp.innerHTML = !cs ? "" : !CS_OK.test(cs) ? `<span class="bad">✗ ${t("ASL and a number")}</span>` : callsignFree(cs) ? `<span class="ok">✓ ${t("free on VATSIM")}</span>` : `<span class="bad">✗ ${t("in use on VATSIM")}</span>`;
  };
  el.addEventListener("input", csCheck); csCheck();
  el.addEventListener("change", (e) => { // the destinations and aircraft follow the departure
    const f = el.querySelector("[name=dep]"), d = el.querySelector("[name=dest]");
    if (e.target === f) d.innerHTML = toOpts(f.value, "");
    if (e.target === f || e.target === d) el.querySelector("[name=ac]").innerHTML = acOpts(f.value, d.value);
  });
}

// ---------- the plan card ----------
const adjKey = "asl.fuelAdj";
const fuelAdj = (o) => { const a = store.get(adjKey, null); return a && a.id === o.id ? a.d : 0; };
function concerns(icao) {
  const w = wxOf(icao); if (!w) return null;
  const c = [];
  if (w.cat === "IFR" || w.cat === "LIFR") c.push(w.cat);
  if (/\b[+-]?(VC)?TS/.test(w.raw || "")) c.push(t("thunderstorms"));
  if (w.gust >= 25) c.push(t("gusts {g} kt", { g: w.gust }));
  if (/\b[+-]?(FZ\w*|\w*SN|GR|PL)\b/.test(w.raw || "")) c.push(t("snow or freezing"));
  return c;
}
const wxDot = (icao) => {
  const c = concerns(icao);
  return c == null ? `<span class="dim">${t("no weather yet")}</span>` : c.length ? `<span class="bk-wx bad">${c.map(esc).join(" · ")}</span>` : `<span class="bk-wx ok">${t("No weather concerns")}</span>`;
};
const wbar = (lbl, v, max, o) => {
  const pct = max ? Math.min(100, (v / max) * 100) : 0, over = max && v > max;
  return `<div class="bk-w"><div class="lbl">${lbl}</div><div class="bk-wb"><i style="width:${pct.toFixed(1)}%" class="${over ? "over" : ""}"></i></div>
    <div><b class="${over ? "bad" : ""}">${fmtW(v, o, { bare: true })}</b><span class="dim"> / ${max ? fmtW(max, o) : "—"}</span></div></div>`;
};

export function planCard(o, now = Date.now()) {
  if (!o) return "";
  const f = o.fuel, w = o.weights, d = fuelAdj(o), st = S.st || {};
  const ete = (o.times.ete || 0) / 60, bpm = f.trip && ete ? f.trip / ete : null; // average burn per minute on the trip
  const block = (f.block || 0) + d, extra = Math.max(0, (f.extra || 0) + d), res = (f.cont || 0) + (f.altn || 0) + (f.final || 0) + (f.etops || 0);
  const ldgFuel = (f.landing || 0) + d, ldgMin = bpm ? Math.round(ldgFuel / bpm) : null;
  const tow = (w.zfw || 0) + block - (f.taxi || 0), ldw = tow - (f.trip || 0);
  const seg = [["taxi", f.taxi], ["trip", f.trip], ["res", res], ["extra", extra]], sum = seg.reduce((a, [, v]) => a + (v || 0), 0) || 1;
  const b = booking(), match = b && b.dep === o.dep?.icao && b.dest === o.dest?.icao && b.callsign === o.callsign;
  const ds = departureStand(), as = arrivalStand();
  const minOf = (v) => (bpm ? "≈ " + t("{n} min", { n: Math.round(v / bpm) }) : "");
  return `<div class="hb-card bk-plan wide">
    <div class="bk-plan-h"><div class="lbl">${t("Flight plan")} · ${esc(o.iataNo || o.callsign)}</div>${match ? `<span class="pill ok">${t("as booked")}</span>` : ""}<span class="dim" style="margin-left:auto;font-size:12px">SimBrief · ${o.generated ? hhmmz(o.generated) : ""}</span></div>
    <div class="bk-ends">
      <div><span class="lbl">DEP</span><b>${esc(o.dep.icao)}</b><span class="dim">${t("Off-block")} ${hhmmz(o.times.out)}</span>${wxDot(o.dep.icao)}<span class="bk-st"><span class="lbl">${t("Stand")}</span><b>${esc(ds?.ref || "—")}</b></span></div>
      <div><span class="lbl">ARR</span><b>${esc(o.dest.icao)}</b><span class="dim">ETA ${hhmmz(o.times.in)}</span>${wxDot(o.dest.icao)}<span class="bk-st"><span class="lbl">${t("Stand")}</span><b>${esc(as?.ref || "—")}</b></span></div>
    </div>
    <div class="bk-fuel"><div class="bk-fbar">${seg.map(([k, v]) => `<i class="${k}" style="width:${(((v || 0) / sum) * 100).toFixed(1)}%"></i>`).join("")}</div>
      <div class="bk-leg"><span class="taxi"><b>${fmtW(f.taxi, o, { bare: true })}</b> ${t("taxi")}</span><span class="trip"><b>${fmtW(f.trip, o, { bare: true })}</b> ${t("trip")} ${ete ? "· " + dur(ete * 60e3) : ""}</span>
        <span class="res"><b>${fmtW(res, o, { bare: true })}</b> ${t("reserves")} ${minOf(res)}</span><span class="extra"><b>${fmtW(extra, o, { bare: true })}</b> ${t("extra")} ${minOf(extra)}</span></div></div>
    <div class="bk-blk"><button class="bk-pm" data-bk="fuel-" aria-label="−">−</button>
      <div class="bk-blk-v"><div class="lbl">${t("Block fuel")}</div><b>${fmtW(block, o)}</b>${d ? `<span class="dim">${t("plan")} ${fmtW(f.block, o)} · ${fmtW(d, o, { sign: true })}</span>` : `<span class="dim">${t("as planned")}</span>`}</div>
      <button class="bk-pm" data-bk="fuel+" aria-label="+">+</button>
      <div class="bk-blk-s"><div class="${ldgMin != null && ldgMin < 45 ? "bad" : ""}">${ldgMin != null ? t("Land with ≈ {n} min", { n: ldgMin }) : "—"}</div>
        <div class="dim">${d ? t("Load this in the aircraft – SimBrief still has {f}.", { f: fmtW(f.block, o) }) : t("Plan is up to date")}</div></div></div>
    <div class="bk-ws">${wbar("ZFW", w.zfw, w.maxZfw, o)}${wbar("TOW", tow, w.maxTow, o)}${wbar("LDW", ldw, w.maxLdw, o)}</div>
    <div class="bk-act">${o.prefile && !st.offBlock ? `<a class="btn small pri" href="${esc(o.prefile)}" target="_blank" rel="noopener">${t("Prefile on VATSIM")} ↗</a>` : ""}
      <button class="btn small" data-bk="again">${t("New flight plan")}</button>${o.pdf ? `<a class="btn small" href="${esc(o.pdf)}" target="_blank" rel="noopener">OFP PDF</a>` : ""}
      ${d ? `<button class="btn small" data-bk="fuel0">${t("Back to the plan")}</button>` : ""}</div></div>`;
}

// clicks from the home screen and from ASL Ops; true when handled
export function bookingClick(e) {
  const b = e.target.closest("[data-bk]"); if (!b) return false;
  const k = b.dataset.bk, o = S.ofp;
  if (k === "next") store.set("asl.sugIdx", (store.get("asl.sugIdx", 0) || 0) + 1);
  if (k === "book") { const l = suggestions(), s = l[(store.get("asl.sugIdx", 0) || 0) % l.length]; if (s) openBooking({ ...s, reg: fleetAll().find((a) => a.type === s.type)?.reg }); }
  if (k === "new") openBooking();
  if (k === "vam-book") { const b = (pilot()?.bookings || []).filter((x) => !x.at || x.at > Date.now() - 6 * 36e5).sort((a, c) => (a.at || 9e15) - (c.at || 9e15))[0];
    if (b) { const cs = /^[A-Z]{3}\w+$/.test(b.callsign || "") ? b.callsign : ""; window.open(simbriefUrl({ dep: b.dep, dest: b.arr, type: b.type || "A319", reg: b.reg || "", callsign: cs || "ASL" + (b.number || ""), off: b.at || quarter(Date.now() + 40 * 60e3) }), "_blank", "noopener"); } }
  if (k === "again" && o) openBooking({ dep: o.dep.icao, dest: o.dest.icao, type: o.type, reg: o.reg, off: o.times.out > Date.now() ? o.times.out : quarter(Date.now() + 40 * 60e3), callsign: o.callsign });
  if (o && /^fuel/.test(k)) {
    const step = (settings.unit === "lb") === (o.units === "lb") ? (o.units === "lb" ? 200 : 100) : o.units === "lb" ? 220.46 : 90.72; // 100 kg or 200 lb as the pilot sees it
    const d = k === "fuel0" ? 0 : fuelAdj(o) + (k === "fuel+" ? step : -step);
    const minD = -(o.fuel.extra || 0); // only the extra fuel can go, never what the plan needs
    store.set(adjKey, { id: o.id, d: Math.max(minD, d) });
  }
  emit();
  return true;
}
