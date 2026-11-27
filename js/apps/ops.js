// ASL Ops: today's duty, things to do, departure and arrival (stand, runway, slot, ATIS, frequencies) and the fleet.
import { S, derived, wxOf, atisOf, runwayOf, atcAt, arrivalStand, departureStand } from "../data.js";
import { actions } from "../actions.js";
import { t, nf, LOCALE } from "../i18n.js";
import { esc, hhmmz, localHM, dur, store } from "../util.js";
import { I } from "../icons.js";
import { tzOf, cityOf } from "../tz.js";
import { sheet } from "../sheet.js";
import { planCard, suggestCard, bookingClick, fleetAll, schedule, daysTxt, openBooking, realReg } from "../booking.js";
import { rosterView, deskView, reportView, reportInput, sendReport, duties, doCheckIn, setDesk } from "../crew.js";

export const name = "ASL Ops";
export const tabs = [["ops", "Operations"], ["timetable", "Timetable"], ["roster", "Roster"], ["edesk", "Crew Desk"], ["report", "Report"], ["fleet", "Fleet"]];

// Air Serbia A319 fleet with SimBrief airframes (shared in the Air Serbia virtual community) for the Fenix A319
export const FLEET = [
  { reg: "YU-APA", type: "A319", sb: "https://dispatch.simbrief.com/airframes/share/289231_1726640739736" },
  { reg: "YU-APB", type: "A319", sb: "https://dispatch.simbrief.com/airframes/share/289231_1744438824393" },
  { reg: "YU-APC", type: "A319", sb: "https://dispatch.simbrief.com/airframes/share/289231_1744438937840" },
  { reg: "YU-APD", type: "A319", sb: "https://dispatch.simbrief.com/airframes/share/289231_1744438912177" },
  { reg: "YU-APE", type: "A319", sb: "https://dispatch.simbrief.com/airframes/share/289231_1744439009439" },
];
const LIVERY = "https://flightsim.to/file/91140/air-serbia-pack-fenix-a319";
const TYPE_NAME = { A319: "Airbus A319", A320: "Airbus A320", A20N: "Airbus A320neo", A321: "Airbus A321", A332: "Airbus A330-200", A333: "Airbus A330-300", AT76: "ATR 72-600", AT75: "ATR 72-500", B738: "Boeing 737-800", E195: "Embraer 195" };
const myFleet = () => store.get("asl.fleet", []);

let C = null;
export function render(body, ctx) {
  C = ctx;
  if (!body._ops) { body._ops = true; body.addEventListener("click", onClick); body.addEventListener("change", (e) => { if (e.target.dataset.rp) reportInput(e.target); if (e.target.dataset.tt === "apt") { TT.apt = e.target.value; render(body, C); } }); }
  if (body.contains(document.activeElement) && document.activeElement.matches("input")) return; // typing a report: do not rebuild
  const tab = ctx.tab;
  body.innerHTML = tab === "fleet" ? fleet() : tab === "timetable" ? timetable(ctx.now) : tab === "roster" ? rosterView(ctx.now) : tab === "edesk" ? deskView(ctx.now) : tab === "report" ? reportView(ctx.now) : ops(ctx.now);
}
export function summary() {
  const o = S.ofp; if (!o) return [t("ASL Ops"), t("No flight loaded")];
  const s = arrivalStand();
  return [`${o.iataNo || o.callsign}`, `${o.dep.icao} → ${o.dest.icao}\n${s?.ref ? (s.gate ? t("Gate {r}", { r: s.ref }) : t("Stand {r}", { r: s.ref })) + " · " + o.dest.icao : t("Stand not known yet")}\n${t("{n} open items", { n: actions().length })}`];
}

function onClick(e) {
  if (bookingClick(e)) { render(e.target.closest(".app-body") || document.querySelector("#app-ops .app-body"), C); return; }
  const a = e.target.closest("[data-open]");
  if (a && !a.closest("a")) { C.open(a.dataset.open, a.dataset.tab || undefined); return; }
  const tt = e.target.closest("button[data-tt]"); if (tt) { TT[tt.dataset.tt] = tt.dataset.tt === "day" ? +tt.dataset.v : tt.dataset.v; render(tt.closest(".app-body"), C); return; }
  const dk = e.target.closest("[data-desk]"); if (dk) { setDesk(dk.dataset.desk); render(dk.closest(".app-body"), C); return; }
  const b = e.target.closest("[data-do]"); if (!b) return;
  const body = b.closest(".app-body");
  if (b.dataset.do === "checkin") { const d = duties().find((x) => x.key === b.dataset.key); if (d) doCheckIn(d); render(body, C); return; }
  if (b.dataset.do === "pre") { const k = "asl.pre." + (S.ofp ? `${S.ofp.callsign}.${S.ofp.dep.icao}.${S.ofp.dest.icao}` : ""), m = store.get(k, {}); m[b.dataset.k] = !m[b.dataset.k]; store.set(k, m); render(body, C); return; }
  if (b.dataset.do === "report") { body.querySelectorAll(`[data-rp="${CSS.escape(b.dataset.id)}"]`).forEach(reportInput); sendReport(b.dataset.id); render(body, C); return; }
  if (b.dataset.do === "ttbook") { const f = schedule().find((x) => x.no === b.dataset.no && x.dep === b.dataset.dep && x.std === b.dataset.std);
    if (f) { const [h, m] = f.std.split(":").map(Number), d = new Date(); let off = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m); if (off < Date.now()) off += 864e5;
      openBooking({ dep: f.dep, dest: f.arr, no: f.no, callsign: f.cs, type: f.type, off }); } return; }
  if (b.dataset.do === "addac") addAircraft();
  if (b.dataset.do === "delac") { store.set("asl.fleet", myFleet().filter((x) => x.reg !== b.dataset.reg)); render(b.closest(".app-body"), C); }
}

// ---------- operations ----------
function sidStar(o) {
  const nl = o.navlog, proc = /^[A-Z]{2,5}\d{1,2}[A-Z]?$/;
  const tok = (o.route || "").split(/\s+/);
  const sidNl = nl.find((x) => x.sidstar && proc.test(x.airway))?.airway;
  const starNl = [...nl].reverse().find((x) => x.sidstar && proc.test(x.airway))?.airway;
  return { sid: S.cdm?.sid || sidNl || (proc.test(tok[0]) ? tok[0] : ""), star: starNl || (proc.test(tok.at(-1)) ? tok.at(-1) : "") };
}
const freqs = (icao) => {
  const list = atcAt(icao), a = atisOf(icao);
  const rows = list.map((c) => `<div class="freq"><span class="lbl">${esc(c.type)}</span><span>${esc(c.callsign)}</span><span class="f">${esc(c.frequency)}</span></div>`);
  if (a?.freq) rows.unshift(`<div class="freq"><span class="lbl">ATIS</span><span>${esc(a.list[0]?.callsign || icao + "_ATIS")} · <b>${esc(a.letter || "")}</b></span><span class="f">${esc(a.freq)}</span></div>`);
  return rows.length ? rows.join("") : `<div class="dim" style="font-size:13px;padding:6px 0">${t("No ATC online on VATSIM")}</div>`;
};
const wxLine = (icao) => {
  const w = wxOf(icao); if (!w) return "";
  return `<div class="wx-raw" style="font-size:12px">${w.cat ? `<span class="cat ${w.cat}">${w.cat}</span> ` : ""}${esc(w.raw)}</div>`;
};
const cell = (l, v, s, cls = "") => `<div><div class="lbl">${esc(l)}</div><div class="v ${cls}">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;

function ops(now) {
  const o = S.ofp;
  const acts = actions(now);
  const todo = `<div class="card"><div class="lbl" style="margin-bottom:4px">${t("To do")}</div>${acts.length ? acts.map((a) => `<div class="act ${a.lv === "red" ? "red" : a.lv === "ok" ? "ok" : ""}"><div class="ic">${I[a.ic] || I.plane}</div>
      <div><b>${esc(a.title)}</b><div class="dim" style="font-size:13px">${esc(a.text || "")}</div></div>
      ${a.link ? `<a class="btn small" href="${esc(a.link)}" target="_blank" rel="noopener">${t("Open")}</a>` : a.app && a.app !== "ops" ? `<button class="btn small" data-open="${a.app}" data-tab="${a.tab || ""}">${t("Open")}</button>` : "<span></span>"}</div>`).join("")
    : `<div class="dim" style="padding:10px 0">${t("Nothing to do right now.")}</div>`}</div>`;
  if (!o) return `<div class="ops-book">${suggestCard(now)}</div><div style="margin-top:14px">${todo}</div>`;
  const st = S.st, d = derived(now), T = o.times;
  const report = T.out ? T.out - 60 * 60e3 : null;
  const duty = `<div class="duty"><div><div class="lbl">${t("Duty")} · ${esc(o.iataNo || o.callsign)}</div><div class="legs">${esc(o.dep.icao)} – ${esc(o.dest.icao)}</div>
      <div class="dim" style="font-size:12.5px">${esc(TYPE_NAME[o.type] || o.type)}${o.reg ? " · " + esc(o.reg) : ""}${o.pax ? " · " + t("{n} pax", { n: o.pax }) : ""}</div></div>
    ${cell(t("Report"), hhmmz(report), t("Local") + " " + localHM(report, tzOf(o.dep)))}${cell("STD", hhmmz(T.out), st.offBlock ? t("out {t}", { t: hhmmz(st.offBlock) }) : "")}
    ${cell("STA", hhmmz(T.in), st.onBlock ? t("in {t}", { t: hhmmz(st.onBlock) }) : "ETA " + hhmmz(d.est.in))}${cell(t("Block"), dur(T.block ? T.block * 1000 : T.in - T.out), d.est.delay != null ? t("delay {d}", { d: dur(d.est.delay, true) }) : "")}</div>`;
  const { sid, star } = sidStar(o);

  // departure
  const ds = departureStand(), rd = runwayOf(o.dep.icao, "dep"), c = S.cdm;
  const depStand = st.offBlock ? `<div class="stand-big">${t("OUT")} ${hhmmz(st.offBlock)}</div><div class="dim">${st.takeoff ? t("Airborne {t}", { t: hhmmz(st.takeoff) }) : t("Taxiing")}</div>`
    : ds?.state === "parked" ? `<div class="stand-big">${esc(ds.ref)}</div><div class="dim">${ds.gate ? t("Gate") : t("Stand")}${ds.t ? " · " + esc(ds.t) : ""}</div>`
    : ds?.state === "forecast" ? `<div class="stand-big">${esc(ds.ref)}</div><div class="dim">${[ds.gate ? t("Gate") : t("Stand"), ds.term, t("forecast")].filter(Boolean).map(esc).join(" · ")}</div>`
    : `<div class="stand-big wait">—</div><div class="dim">${S.pilot ? t("Not at a known stand") : t("Connect to VATSIM to see your stand")}</div>`;
  const tsatState = c?.tsat ? (now < c.tsat - 5 * 60e3 ? "" : now <= c.tsat + 5 * 60e3 ? "ok" : "bad") : "";
  const cdm = c ? `<div class="kv" style="margin-top:12px">${cell("EOBT", hhmmz(c.eobt))}${cell("TOBT", hhmmz(c.tobt))}${cell("TSAT", hhmmz(c.tsat), tsatState === "ok" ? t("window open") : tsatState === "bad" ? t("expired") : c.tsat ? t("in {t}", { t: dur(c.tsat - now) }) : "", tsatState)}
      ${cell("TTOT", hhmmz(c.ttot))}${c.ctot ? cell("CTOT", hhmmz(c.ctot), esc(c.reason || ""), "warn") : ""}</div>`
    : `<div class="dim" style="font-size:13px;margin-top:10px">${st.takeoff ? "" : S.cdmOk === false ? t("vIFF CDM not reachable.") : t("No slot in vIFF CDM for {cs}.", { cs: o.callsign })}</div>`;
  const dep = `<div class="card"><div style="display:flex;align-items:baseline;gap:10px"><div class="lbl">${t("Departure")}</div><b style="font:700 20px var(--f-cond)">${esc(o.dep.icao)}</b><span class="dim">${esc(cityOf(o.dep))}</span><span class="num dim" style="margin-left:auto">${localHM(now, tzOf(o.dep))}</span></div>
      ${depStand}
      <div class="kv" style="margin-top:12px">${cell(t("Runway"), esc(c?.rwy || rd?.rwy || "—"), c?.rwy ? "CDM" : rd ? (rd.src === "plan" ? t("plan") : rd.src === "wind" ? t("by wind") : "ATIS") : "")}${cell("SID", esc(sid || "—"))}
        ${cell("ATIS", esc(atisOf(o.dep.icao)?.depLetter || "—"))}${cell(t("Trans. alt"), o.dep.transAlt ? nf(o.dep.transAlt) + " ft" : "—")}</div>
      ${cdm}
      <div class="lbl" style="margin:14px 0 2px">${t("Frequencies")}</div>${freqs(o.dep.icao)}
      ${wxLine(o.dep.icao)}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">${o.prefile && !st.offBlock ? `<a class="btn small" href="${esc(o.prefile)}" target="_blank" rel="noopener">${t("File on VATSIM")}</a>` : ""}${o.pdf ? `<a class="btn small" href="${esc(o.pdf)}" target="_blank" rel="noopener">OFP PDF</a>` : ""}
        <a class="btn small" href="https://viff-system.network" target="_blank" rel="noopener">vIFF CDM</a></div></div>`;

  // arrival
  const as = arrivalStand(), ra = runwayOf(o.dest.icao, "arr");
  const big = as?.ref ? `<div class="stand-big">${esc(as.ref)}</div>` : `<div class="stand-big wait">${as?.state === "loading" ? "…" : "—"}</div>`;
  const sub = !as ? "" : as.state === "parked" ? t("You are parked.") : as.state === "assigned" ? t("Assigned by {src}", { src: as.src }) :
    as.state === "forecast" ? [as.gate ? t("Gate") : as.remote ? t("Remote stand") : t("Stand"), as.term, as.schengen === true ? "Schengen" : as.schengen === false ? t("non-Schengen") : "", t("forecast")].filter(Boolean).join(" · ")
    : as.state === "loading" ? t("Loading stand data…") : t("No stand data for {icao}", { icao: o.dest.icao });
  const arr = `<div class="card"><div style="display:flex;align-items:baseline;gap:10px"><div class="lbl">${t("Arrival")}</div><b style="font:700 20px var(--f-cond)">${esc(o.dest.icao)}</b><span class="dim">${esc(cityOf(o.dest))}</span><span class="num dim" style="margin-left:auto">${localHM(now, tzOf(o.dest))}</span></div>
      ${big}<div class="dim">${esc(sub)}</div>
      <div class="kv" style="margin-top:12px">${cell(t("Runway"), esc(ra?.rwy || "—"), ra ? (ra.src === "plan" ? t("plan") : ra.src === "wind" ? t("by wind") : "ATIS") : "")}${cell("STAR", esc(star || "—"))}
        ${cell("ATIS", esc(atisOf(o.dest.icao)?.letter || "—"))}${cell(st.landing ? t("Landed") : "ETA", hhmmz(st.landing || d.est.on), t("in-block {t}", { t: hhmmz(d.est.in) }))}</div>
      <div class="lbl" style="margin:14px 0 2px">${t("Frequencies")}</div>${freqs(o.dest.icao)}
      ${wxLine(o.dest.icao)}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn small" data-open="fly" data-tab="radio">${t("Radio & ACARS")}</button><button class="btn small" data-open="cabin">${t("Cabin screen")}</button></div></div>`;
  return duty + `<div class="ops-book">${planCard(o, now)}</div><div style="margin-top:14px">${todo}</div><div class="ops-cols">${dep}${arr}</div>`;
}

// ---------- fleet: the VA fleet (va/fleet.json) by type, SimBrief airframe where we have one ----------
const TYPE_ORDER = ["A319", "A320", "E195", "AT76", "A332"];
function fleet() {
  const cur = S.ofp?.reg, own = store.get("asl.fleet", []), all = fleetAll();
  const tile = (a) => { const isOwn = a.own, inner = `<div style="width:30px;height:30px;color:var(--accent)">${I.plane}</div>
      <div style="flex:1;min-width:0"><b>${esc(a.reg)}</b><div><span>${esc(a.name || TYPE_NAME[a.type] || a.type)}${a.sb ? " · " + t("SimBrief airframe") : ""}</span></div></div>
      ${isOwn ? `<button class="btn small" data-do="delac" data-reg="${esc(a.reg)}" onclick="event.preventDefault()">×</button>` : ""}`;
    return a.sb ? `<a href="${esc(a.sb)}" target="_blank" rel="noopener" class="${a.reg === cur ? "cur" : ""}">${inner}</a>` : `<div class="nolink ${a.reg === cur ? "cur" : ""}">${inner}</div>`; };
  const types = [...new Set(all.map((a) => a.type))].sort((x, y) => (TYPE_ORDER.indexOf(x) + 99) % 99 - (TYPE_ORDER.indexOf(y) + 99) % 99);
  const o = S.ofp;
  return `<div class="card"><div style="display:flex;align-items:center;gap:12px;margin-bottom:6px"><div class="lbl">${t("Fleet")} · Air Serbia Virtual · ${all.length} ${t("aircraft")}</div>
      <a class="btn small" style="margin-left:auto" href="${LIVERY}" target="_blank" rel="noopener">${t("Livery pack (Fenix A319)")}</a><button class="btn small" data-do="addac">${t("SimBrief airframe")} +</button></div>
      ${types.map((ty) => `<div class="lbl" style="margin:14px 0 8px">${esc(TYPE_NAME[ty] || ty)} · ${all.filter((a) => a.type === ty).length}</div><div class="fleet">${all.filter((a) => a.type === ty).map(tile).join("")}</div>`).join("")}
      <p class="dim" style="font-size:12.5px;margin:12px 0 0">${t("Aircraft with a SimBrief airframe open it on a tap – save it to your account and plan with it. For the others SimBrief uses its default for the type.")}</p></div>
    ${o ? `<div class="card"><div class="lbl" style="margin-bottom:12px">${t("Aircraft of this flight")}</div><div class="kv">
      ${cell(t("Type"), esc(o.type), esc(o.typeName || TYPE_NAME[o.type] || ""))}${cell(t("Registration"), esc(o.reg || "—"))}${cell("SELCAL", esc(o.selcal || "—"))}
      ${cell("MZFW", o.weights.maxZfw ? nf(o.weights.maxZfw) : "—", o.units)}${cell("MTOW", o.weights.maxTow ? nf(o.weights.maxTow) : "—", o.units)}${cell("MLW", o.weights.maxLdw ? nf(o.weights.maxLdw) : "—", o.units)}</div></div>` : ""}`;
}

// ---------- timetable: the VA schedule, departures and arrivals of an airport on a day ----------
const TT = { apt: "LYBE", day: null, dir: "dep" };
function timetable(now) {
  const list = schedule(); if (!list.length) return `<div class="card dim">${t("Loading the route network…")}</div>`;
  const wdNow = ((new Date(now).getUTCDay() + 6) % 7) + 1, wd = TT.day || wdNow;
  const apts = [...new Set(list.flatMap((f) => [f.dep, f.arr]))].sort((a, b) => (a === "LYBE" ? -1 : b === "LYBE" ? 1 : a.localeCompare(b)));
  const rows = list.filter((f) => (TT.dir === "dep" ? f.dep : f.arr) === TT.apt && f.days.includes(wd)).sort((a, b) => (TT.dir === "dep" ? a.std : a.sta).localeCompare(TT.dir === "dep" ? b.std : b.sta));
  const dn = [1, 2, 3, 4, 5, 6, 7].map((d) => new Intl.DateTimeFormat(LOCALE(), { weekday: "short", timeZone: "UTC" }).format(Date.UTC(2024, 0, d)));
  const name = (i) => S.routes?.airports?.[i]?.name || i;
  return `<div class="card"><div class="tt-bar"><select data-tt="apt">${apts.map((a) => `<option value="${a}" ${a === TT.apt ? "selected" : ""}>${esc(name(a))} · ${a}</option>`).join("")}</select>
      <div class="seg">${[["dep", t("Departures")], ["arr", t("Arrivals")]].map(([k, l]) => `<button data-tt="dir" data-v="${k}" class="${TT.dir === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="seg">${dn.map((d, i) => `<button data-tt="day" data-v="${i + 1}" class="${wd === i + 1 ? "on" : ""}">${esc(d)}${i + 1 === wdNow ? " •" : ""}</button>`).join("")}</div></div>
    <table class="tt"><thead><tr><th>${t("Flight")}</th><th>${TT.dir === "dep" ? t("To") : t("From")}</th><th>STD</th><th>STA</th><th>${t("Block")}</th><th>${t("Type")}</th><th>${t("Gate")}</th><th>${t("Days")}</th><th></th></tr></thead><tbody>
    ${rows.map((f) => `<tr><td><b>${esc(f.no)}</b><small>${esc(f.cs)}</small></td><td><b>${esc(TT.dir === "dep" ? f.arr : f.dep)}</b><small>${esc(name(TT.dir === "dep" ? f.arr : f.dep))}</small></td>
      <td class="num">${esc(f.std)}z</td><td class="num">${esc(f.sta)}z</td><td class="num">${esc(f.blk)}</td><td>${esc(f.type)}</td><td>${esc(f.gate || "—")}${f.term ? `<small>T${esc(f.term)}</small>` : ""}</td><td class="dim">${esc(daysTxt(f.days))}</td>
      <td><button class="btn small" data-do="ttbook" data-no="${esc(f.no)}" data-dep="${esc(f.dep)}" data-std="${esc(f.std)}">${t("Book")}</button></td></tr>`).join("") || `<tr><td colspan="9" class="dim">${t("No flights on this day.")}</td></tr>`}
    </tbody></table><p class="dim" style="font-size:12px;margin:10px 0 0">${t("Timetable of Air Serbia Virtual ({src}). All times UTC.", { src: S.routes?.source || "vAMSYS" })}</p></div>`;
}

// a SimBrief airframe link for an aircraft of the VA fleet – the registration is picked from the fleet, never typed
function addAircraft() {
  const list = fleetAll();
  sheet(`<h2>${t("SimBrief airframe")}</h2><p class="dim" style="font-size:13px">${t("Pick the aircraft of Air Serbia Virtual and paste the share link of your SimBrief airframe for it. Only registrations of the fleet can be used.")}</p>
    <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-top:10px">
      <label><div class="lbl">${t("Registration")}</div><select name="reg" style="width:100%">${list.map((a) => `<option value="${esc(a.reg)}">${esc(a.reg)} · ${esc(a.name || TYPE_NAME[a.type] || a.type)}</option>`).join("")}</select></label>
      <label><div class="lbl">${t("SimBrief share link")}</div><input name="sb" placeholder="https://dispatch.simbrief.com/airframes/share/…" style="width:100%"></label></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn" data-close>${t("Cancel")}</button><button class="btn pri" data-save>${t("Save")}</button></div>`,
  (e, close, el) => {
    if (!e.target.closest("[data-save]")) return;
    const reg = realReg(el.querySelector("[name=reg]").value), sb = el.querySelector("[name=sb]").value.trim(), a = list.find((x) => x.reg === reg);
    if (!a || !/^https:\/\/(dispatch\.)?simbrief\.com\//.test(sb)) { el.querySelector("[name=sb]").style.borderColor = "var(--red)"; return; }
    store.set("asl.fleet", [...myFleet().filter((x) => x.reg !== reg && realReg(x.reg)), { reg, type: a.type, sb }]);
    close(); C.setTab("fleet");
  });
}
