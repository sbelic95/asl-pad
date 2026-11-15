// Flight suggestions, booking and the plan check.
// Suggestions come from the route list of the airline (va/routes.json, a proposal until the VA confirms it), the logbook
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

const SB = "https://dispatch.simbrief.com/options/custom";
const DAY = 864e5;

// ---------- helpers ----------
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const blockMin = (nm) => Math.round(25 + nm / 7.3); // rough block time: taxi, climb and descent, ~440 kt in cruise
const quarter = (ms) => Math.ceil(ms / 9e5) * 9e5;
const routeList = () => S.routes?.routes || [];
const base = () => S.routes?.base || { icao: "LYBE", name: "Belgrade", lat: 44.82, lon: 20.31 };
const posOf = (icao) => (icao === base().icao ? [base().lat, base().lon] : (() => { const r = routeList().find((x) => x.to === icao); return r ? [r.lat, r.lon] : null; })());
const nameOf = (icao) => (icao === base().icao ? base().name : routeList().find((x) => x.to === icao)?.name || icao);
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

// ---------- suggestions ----------
export function suggestions(now = Date.now()) {
  const R = routeList(); if (!R.length) return [];
  const home = base().icao, log = logbook(), last = log[0], type = topType();
  const flown = new Set(log.flatMap((e) => [e.dep + e.arr, e.arr + e.dep]));
  const here = last?.arr && last.arr !== home && R.some((r) => r.to === last.arr) ? last.arr : home;
  const off = quarter(now + 40 * 60e3), dayKey = Math.floor(now / DAY);
  const make = (dep, dest, r) => {
    const a = posOf(dep), b = posOf(dest), nm = a && b ? Math.round(distNm(a, b)) : 0, blk = blockMin(nm) * 60e3;
    const types = r?.types?.length ? r.types : ["A319"], ac = type && types.includes(type) ? type : types[0];
    const ev = eventAt(dest, now), isNew = !flown.has(dep + dest), reasons = [];
    let score = (hash(dest + dayKey) % 100) / 100;
    if (ev) { score += 3; reasons.push(["ev", t("Event at {icao}: {name}", { icao: dest, name: ev.name })]); }
    if (isNew) { score += 2; reasons.push(["new", t("A route you have not flown yet")]); }
    if (type && ac === type) { score += 1; reasons.push(["type", t("Your most flown type lately: {t}", { t: type })]); }
    const backBy = dep === home ? off + blk * 2 + 50 * 60e3 : off + blk;
    return { dep, dest, nm, type: ac, off, block: blk, arr: off + blk, backBy, callsign: freeCallsign(dep + dest), reasons, score, event: ev };
  };
  if (here !== home) { // first bring the aircraft home
    const s = make(here, home, R.find((r) => r.to === here)); s.score += 10; s.reasons.unshift(["home", t("Back to {city} from where you landed last", { city: base().name })]);
    return [s, ...R.filter((r) => r.to !== here).map((r) => make(home, r.to, r)).sort((a, b) => b.score - a.score).slice(0, 5)];
  }
  return R.map((r) => make(home, r.to, r)).sort((a, b) => b.score - a.score).slice(0, 6);
}

export function suggestCard(now = Date.now()) {
  const list = suggestions(now);
  if (!list.length) return `<div class="hb-card bk-sug"><div class="lbl">${t("Suggested for you")}</div><div class="dim hb-empty">${t("Loading the route network…")}</div></div>`;
  const i = (store.get("asl.sugIdx", 0) || 0) % list.length, s = list[i], free = callsignFree(s.callsign);
  const home = base().icao;
  return `<div class="hb-card bk-sug"><div class="bk-sug-top"><div class="lbl">${t("Suggested for you")}</div><span class="dim">${i + 1}/${list.length}</span></div>
    <div class="bk-legs"><div><b>${esc(s.dep)}</b><span>${esc(nameOf(s.dep))}</span></div>
      <div class="bk-line"><span>${hhmmz(s.off)}</span><i></i><span>${dur(s.block)} · ${nf(s.nm)} NM</span><i></i><span>${hhmmz(s.arr)}</span></div>
      <div class="r"><b>${esc(s.dest)}</b><span>${esc(nameOf(s.dest))}</span></div></div>
    <div class="bk-chips"><span class="bk-chip">${esc(s.type)}</span><span class="bk-chip ${free ? "ok" : "bad"}">${esc(s.callsign)} ${free ? "✓" : "✗"}</span>
      ${s.dep === home ? `<span class="bk-chip">${t("Back in {city} by {t}", { city: base().name, t: hhmmz(s.backBy) })}</span>` : ""}</div>
    ${s.reasons.length ? `<ul class="bk-why">${s.reasons.map(([k, x]) => `<li class="${k}">${esc(x)}</li>`).join("")}</ul>` : ""}
    <div class="bk-act"><button class="btn small pri" data-bk="book">${t("Book this flight")}</button><button class="btn small" data-bk="next">${t("Another one")}</button>
      <button class="btn small" data-bk="new">${t("Own flight")}</button></div></div>`;
}

// ---------- booking ----------
function simbriefUrl(b) {
  const m = /^([A-Z]{3})(\w+)$/.exec(b.callsign) || [];
  const d = new Date(b.off);
  const q = { orig: b.dep, dest: b.dest, type: b.type, reg: b.reg || "", airline: m[1] || "ASL", fltnum: m[2] || "", callsign: b.callsign,
    deph: String(d.getUTCHours()), depm: String(d.getUTCMinutes()) };
  return SB + "?" + new URLSearchParams(Object.entries(q).filter(([, v]) => v !== "")).toString();
}
export const booking = () => store.get("asl.booking", null);

export function openBooking(pre) {
  const s = pre || { dep: base().icao, dest: "", type: "A319", off: quarter(Date.now() + 40 * 60e3), callsign: freeCallsign(String(Date.now() / DAY | 0)) };
  const regs = fleetAll().filter((a) => a.type === s.type || !s.type);
  const hhmm = hhmmz(s.off).slice(0, 5);
  const opts = fleetAll().map((a) => `<option value="${esc(a.reg)}|${esc(a.type)}" ${a.reg === (s.reg || regs[0]?.reg) ? "selected" : ""}>${esc(a.reg)} · ${esc(a.type)}</option>`).join("");
  const steps = (n) => `<div class="bk-steps">${[t("Flight"), t("Aircraft and time"), t("Flight plan"), t("Prefile")].map((x, k) => `<div class="${k < n ? "done" : k === n ? "on" : ""}"><i>${k + 1}</i><span>${esc(x)}</span></div>`).join("")}</div>`;
  const form = `${steps(1)}<h2 style="margin:6px 0 12px">${t("Book a flight")}</h2>
    <div class="bk-form">
      <label><div class="lbl">${t("From")}</div><input name="dep" value="${esc(s.dep)}" maxlength="4" autocapitalize="characters"></label>
      <label><div class="lbl">${t("To")}</div><input name="dest" value="${esc(s.dest)}" maxlength="4" autocapitalize="characters" list="bk-dests"></label>
      <datalist id="bk-dests">${routeList().map((r) => `<option value="${esc(r.to)}">${esc(r.name)}</option>`).join("")}</datalist>
      <label class="w2"><div class="lbl">${t("Aircraft")}</div><select name="ac">${opts}<option value="|${esc(s.type)}">${t("Other aircraft")} (${esc(s.type)})</option></select></label>
      <label><div class="lbl">${t("Off-block (UTC)")}</div><input name="off" type="time" value="${hhmm}"></label>
      <label><div class="lbl">${t("Callsign")} <span class="bk-cs"></span></div><input name="cs" value="${esc(s.callsign)}" maxlength="7" autocapitalize="characters"></label>
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
    if (!/^[A-Z]{4}$/.test(b.dep) || !/^[A-Z]{4}$/.test(b.dest) || !/^[A-Z]{3}\w{1,4}$/.test(b.callsign)) { e.preventDefault(); box.querySelectorAll("input").forEach((i) => { if (!i.value.trim()) i.style.borderColor = "var(--red)"; }); return; }
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
  const csCheck = () => { const cs = el.querySelector("[name=cs]")?.value.trim().toUpperCase(), sp = el.querySelector(".bk-cs"); if (sp) sp.innerHTML = cs ? (callsignFree(cs) ? `<span class="ok">✓ ${t("free on VATSIM")}</span>` : `<span class="bad">✗ ${t("in use on VATSIM")}</span>`) : ""; };
  el.addEventListener("input", csCheck); csCheck();
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
