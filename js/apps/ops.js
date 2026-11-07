// ASL Ops: today's duty, things to do, departure and arrival (stand, runway, slot, ATIS, frequencies) and the fleet.
import { S, derived, wxOf, atisOf, runwayOf, atcAt, arrivalStand, departureStand } from "../data.js";
import { actions } from "../actions.js";
import { t, nf } from "../i18n.js";
import { esc, hhmmz, localHM, dur, store } from "../util.js";
import { I } from "../icons.js";
import { tzOf, cityOf } from "../tz.js";
import { sheet } from "../sheet.js";

export const name = "ASL Ops";
export const tabs = [["ops", "Operations"], ["fleet", "Fleet"]];

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
  if (!body._ops) { body._ops = true; body.addEventListener("click", onClick); }
  body.innerHTML = ctx.tab === "fleet" ? fleet() : ops(ctx.now);
}
export function summary() {
  const o = S.ofp; if (!o) return [t("ASL Ops"), t("No flight loaded")];
  const s = arrivalStand();
  return [`${o.iataNo || o.callsign}`, `${o.dep.icao} → ${o.dest.icao}\n${s?.ref ? (s.gate ? t("Gate {r}", { r: s.ref }) : t("Stand {r}", { r: s.ref })) + " · " + o.dest.icao : t("Stand not known yet")}\n${t("{n} open items", { n: actions().length })}`];
}

function onClick(e) {
  const a = e.target.closest("[data-open]");
  if (a && !a.closest("a")) { C.open(a.dataset.open, a.dataset.tab || undefined); return; }
  const b = e.target.closest("[data-do]"); if (!b) return;
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
  if (!o) return todo;
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
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn small" data-open="vdgs">${t("Docking guidance (VDGS)")}</button><button class="btn small" data-open="cabin">${t("Cabin screen")}</button></div></div>`;
  return duty + `<div style="margin-top:14px">${todo}</div><div class="ops-cols">${dep}${arr}</div>`;
}

// ---------- fleet ----------
function fleet() {
  const cur = S.ofp?.reg;
  const tile = (a, own) => `<a href="${esc(a.sb)}" target="_blank" rel="noopener" class="${a.reg === cur ? "cur" : ""}"><div style="width:30px;height:30px;color:var(--accent)">${I.plane}</div>
      <div style="flex:1;min-width:0"><b>${esc(a.reg)}</b><div><span>${esc(TYPE_NAME[a.type] || a.type)} · ${t("SimBrief airframe")}</span></div></div>
      ${own ? `<button class="btn small" data-do="delac" data-reg="${esc(a.reg)}" onclick="event.preventDefault()">×</button>` : ""}</a>`;
  const o = S.ofp;
  return `<div class="card"><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><div class="lbl">${t("Fleet")} · Airbus A319</div>
      <a class="btn small" style="margin-left:auto" href="${LIVERY}" target="_blank" rel="noopener">${t("Livery pack (Fenix A319)")}</a></div>
      <div class="fleet">${FLEET.map((a) => tile(a)).join("")}</div>
      <p class="dim" style="font-size:12.5px;margin:12px 0 0">${t("Tap an aircraft to open its SimBrief airframe and save it to your account. Then plan with that airframe so the OFP has the right registration and weights.")}</p></div>
    <div class="card"><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><div class="lbl">${t("My aircraft")}</div><button class="btn small" style="margin-left:auto" data-do="addac">${t("Add aircraft")}</button></div>
      ${myFleet().length ? `<div class="fleet">${myFleet().map((a) => tile(a, true)).join("")}</div>` : `<div class="dim" style="font-size:13px">${t("Add more SimBrief airframes, for example A320 or A330.")}</div>`}</div>
    ${o ? `<div class="card"><div class="lbl" style="margin-bottom:12px">${t("Aircraft of this flight")}</div><div class="kv">
      ${cell(t("Type"), esc(o.type), esc(o.typeName || TYPE_NAME[o.type] || ""))}${cell(t("Registration"), esc(o.reg || "—"))}${cell("SELCAL", esc(o.selcal || "—"))}
      ${cell("MZFW", o.weights.maxZfw ? nf(o.weights.maxZfw) : "—", o.units)}${cell("MTOW", o.weights.maxTow ? nf(o.weights.maxTow) : "—", o.units)}${cell("MLW", o.weights.maxLdw ? nf(o.weights.maxLdw) : "—", o.units)}</div></div>` : ""}`;
}

function addAircraft() {
  sheet(`<h2>${t("Add aircraft")}</h2><p class="dim" style="font-size:13px">${t("Paste the share link of a SimBrief airframe.")}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
      <label><div class="lbl">${t("Registration")}</div><input name="reg" placeholder="YU-ARB" style="width:100%"></label>
      <label><div class="lbl">${t("Type")}</div><input name="type" placeholder="A332" style="width:100%"></label>
      <label style="grid-column:1/-1"><div class="lbl">${t("SimBrief share link")}</div><input name="sb" placeholder="https://dispatch.simbrief.com/airframes/share/…" style="width:100%"></label></div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn" data-close>${t("Cancel")}</button><button class="btn pri" data-save>${t("Save")}</button></div>`,
  (e, close, el) => {
    if (!e.target.closest("[data-save]")) return;
    const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
    const reg = v("reg").toUpperCase(), type = v("type").toUpperCase(), sb = v("sb");
    if (!reg || !/^https:\/\/(dispatch\.)?simbrief\.com\//.test(sb)) { el.querySelector("[name=sb]").style.borderColor = "var(--red)"; return; }
    store.set("asl.fleet", [...myFleet().filter((x) => x.reg !== reg), { reg, type, sb }]);
    close(); C.setTab("fleet");
  });
}
