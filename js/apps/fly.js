// ASL Fly: the flight at a glance, times, the flight plan, map, weather and fuel.
import { S, derived, wxOf, atisOf, runwayOf, airportsOfFlight, emit } from "../data.js";
import { t, nf } from "../i18n.js";
import { esc, hhmmz, localHM, dur } from "../util.js";
import { fmtW, unitLabel, fromUnit } from "../units.js";
import { tzOf, cityOf } from "../tz.js";
import { tocTod, addCheck, saveFlight, planAt } from "../flight.js";
import { I } from "../icons.js";
import { PHASE } from "../lock.js";
import { renderMap, dropMap } from "./map.js";
import { perfView, sel as perfSel } from "./perf.js";
import { routeSigmetsHtml } from "../sigmet.js";

export const name = "ASL Fly";
export const tabs = [["overview", "Overview"], ["times", "Times"], ["plan", "Flight plan"], ["map", "Map"], ["wx", "Weather"], ["fuel", "Fuel"], ["perf", "Performance"]];

let C = null, lastTab = "";
export function render(body, ctx) {
  C = ctx;
  const o = S.ofp, tab = ctx.tab;
  if (!body._fly) { body._fly = true; body.addEventListener("click", onClick); }
  body.classList.toggle("map-body", tab === "map" && !!o);
  if (tab !== "map" || !o) dropMap();
  if (!o) { body.innerHTML = noFlight(); lastTab = ""; return; }
  const d = derived(ctx.now);
  if (tab === "map") { renderMap(body, o, d); lastTab = tab; return; }
  body.innerHTML = (VIEW[tab] || VIEW.overview)(o, d, ctx.now);
  if (tab === "plan" && lastTab !== "plan") { // the next fix in the middle (scrollIntoView would also move the pad itself)
    const r = body.querySelector("tr.next");
    if (r) body.scrollTop += r.getBoundingClientRect().top - body.getBoundingClientRect().top - body.clientHeight / 2;
  }
  lastTab = tab;
}
export function summary() {
  const o = S.ofp; if (!o) return [t("ASL Fly"), t("No flight loaded")];
  const d = derived();
  return [`${o.dep.icao} → ${o.dest.icao}`, `${o.iataNo || o.callsign} · ${t(PHASE[d.phase])}\nETA ${hhmmz(d.est.on)}\n${nf(d.toGo)} NM ${t("to go")}`];
}

function onClick(e) {
  const b = e.target.closest("[data-do]"); if (!b) return;
  if (b.dataset.do === "check") fuelCheck();
  if (b.dataset.do === "settings") C.open("settings");
  if (b.dataset.do === "tab") C.setTab(b.dataset.tab);
  if (b.dataset.do === "rwy") { perfSel[b.dataset.side] = b.dataset.id; C.setTab("perf"); }
  if (b.dataset.do === "delcheck") {
    const i = +b.dataset.i;
    if (b.dataset.sure) { S.st.checks.splice(i, 1); saveFlight(S.ofp, S.st); emit(); }
    else { b.dataset.sure = "1"; b.textContent = t("Delete?"); setTimeout(() => { delete b.dataset.sure; b.textContent = "×"; }, 3000); }
  }
}

export async function fuelCheck() {
  const o = S.ofp; if (!o || !S.st) return;
  const plan = S.pr && S.st.takeoff ? planAt(o.navlog, S.pr, "fob") : o.fuel.takeoff;
  const v = await C.ask({ title: t("Fuel check"), text: t("Fuel on board now in {u}. Planned here: {p}", { u: unitLabel(), p: fmtW(plan, o) }), unit: unitLabel() });
  if (v == null || v <= 0) return;
  const c = addCheck(S.st, o, S.st.takeoff ? S.pr : null, fromUnit(v, o));
  saveFlight(o, S.st); emit();
  C.toast({ lv: c.dev < 0 ? "attn" : "ok", ic: "fuel", title: t("Fuel check saved"), text: t("{d} against the plan", { d: fmtW(c.dev, o, { sign: true }) }) });
}

function noFlight() {
  const e = S.ofpErr;
  const msg = e === "setup" ? t("Enter your SimBrief name in Settings to load your flight.") : e === "user" ? t("SimBrief user not found.") : e === "noofp" ? t("No OFP found at SimBrief.") : e === "net" ? t("SimBrief not reachable.") : t("Loading flight plan…");
  return `<div class="card" style="max-width:560px;margin:8vh auto;text-align:center;padding:30px">
    <div style="width:46px;height:46px;margin:0 auto 12px;color:var(--accent)">${I.plane}</div>
    <h2 style="margin:0 0 6px;font:700 24px var(--f-cond)">${t("No flight loaded")}</h2><p class="dim">${esc(msg)}</p>
    ${e ? `<button class="btn pri" data-do="settings">${t("Open Settings")}</button>` : ""}</div>`;
}

// ---------- shared bits ----------
const wind = (w) => (!w || w.wspd == null ? "—" : `${w.vrb ? "VRB" : String(w.wdir ?? 0).padStart(3, "0")}°/${w.wspd}${w.gust ? "G" + w.gust : ""} kt`);
const vis = (w) => (w?.vis == null ? "—" : w.cavok ? "CAVOK" : w.vis >= 10000 ? "10 km+" : w.vis >= 5000 ? nf(w.vis / 1000) + " km" : nf(w.vis) + " m");
const ceil = (w) => (w?.ceil != null ? nf(w.ceil) + " ft" : w?.clouds?.length ? t("none") : w?.cavok ? t("none") : "—");
const cat = (w) => (w?.cat ? `<span class="cat ${w.cat}">${w.cat}</span>` : "");
export const fl = (a) => (a == null ? "—" : a >= 10000 ? "FL" + String(Math.round(a / 100)).padStart(3, "0") : nf(Math.round(a / 10) * 10) + " ft");
const roleOf = (o, a) => (a === o.dep ? t("Departure") : a === o.dest ? t("Destination") : o.altns.includes(a) ? t("Alternate") : t("EDTO"));
const kv = (items) => `<div class="kv">${items.filter(Boolean).map(([l, v, s]) => `<div><div class="lbl">${esc(l)}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`).join("")}</div>`;

function aptCard(o, a, now, main) {
  const w = wxOf(a.icao), side = a === o.dep ? "dep" : a === o.dest ? "arr" : null;
  const r = side ? runwayOf(a.icao, side) : null, at = side ? atisOf(a.icao) : null;
  return `<div class="apt-card ${main ? "main" : ""}"><div class="h"><span class="icao">${esc(a.icao)}</span>${cat(w)}<span class="role">${esc(roleOf(o, a))}</span></div>
    <div class="nm">${esc(cityOf(a))}${a.iata ? " · " + esc(a.iata) : ""}</div>
    <div class="ln">${t("Local")} <b>${localHM(now, tzOf(a))}</b>${at?.letter ? ` · ATIS <b>${esc(side === "dep" ? at.depLetter : at.letter)}</b>` : ""}</div>
    <div class="ln">${wind(w)} · ${vis(w)}</div>
    <div class="ln">${w?.ceil != null ? "CIG " + nf(w.ceil) + " ft · " : ""}${w?.qnh ? "Q" + w.qnh : ""}${w?.temp != null ? " · " + w.temp + "°C" : ""}</div>
    ${r ? `<div class="ln">RWY <b>${esc(r.rwy)}</b> <span class="dim">${esc(r.src === "plan" ? t("plan") : r.src === "wind" ? t("by wind") : "ATIS")}</span></div>` : ""}</div>`;
}
function edtoCard(o) {
  const e = o.edto; if (!e?.airports?.length) return "";
  return `<div class="apt-card"><div class="h"><span class="icao">EDTO</span><span class="role">${e.rule ? e.rule + " min" : ""}</span></div><div class="nm">${t("Suitable airports")}</div>
    <div class="edto-list">${e.airports.map((a) => `<div>${esc(a.icao)} ${cat(wxOf(a.icao))}</div>`).join("")}</div></div>`;
}

function routeLine(o, d) {
  const { toc, tod } = tocTod(o), pct = d.pct * 100;
  const tick = (x, l) => (x != null && d.total ? `<i class="tick" style="left:${(x / d.total) * 100}%" title="${l}"></i>` : "");
  return `<div class="route-line"><div class="track"></div><div class="done" style="width:${pct}%"></div>${tick(toc, "TOC")}${tick(tod, "TOD")}
    <div class="plane" style="left:${pct}%;transform:translateX(-50%) rotate(90deg)">${I.plane}</div></div>
    <div class="rl-lbl"><span>${esc(o.dep.icao)}</span><span class="num">${nf(d.along)} / ${nf(d.total)} NM</span><span>${esc(o.dest.icao)}</span></div>`;
}

// OUT / OFF / ON / IN: planned and estimated or actual
function timesStrip(o, d) {
  const st = S.st, T = o.times, e = d.est;
  const cell = (lbl, plan, act, est) => {
    const v = act || est, late = plan && v && v - plan > 15 * 60e3;
    return `<div class="${late ? "late" : ""}"><div class="lbl">${lbl}</div><div class="v">${hhmmz(v)}</div><div class="s">${act ? t("actual") : t("estimated")} · ${t("plan")} ${hhmmz(plan)}</div></div>`;
  };
  return `<div class="strip">${cell("OUT", T.out, st.offBlock, T.out)}${cell("OFF", T.off, st.takeoff, e.off)}${cell("ON", T.on, st.landing, e.on)}${cell("IN", T.in, st.onBlock, e.in)}
    <div class="head"><div class="lbl">${t("Delay")}</div><div class="v ${e.delay > 15 * 60e3 ? "bad" : e.delay > 5 * 60e3 ? "warn" : "ok"}">${e.delay == null ? "—" : dur(e.delay, true)}</div><div class="s">${t("at the gate")}</div></div></div>`;
}

function fuelBox(o, d, big) {
  const st = S.st, f = o.fuel, fs = d.fs;
  const fobNow = st.takeoff && !st.landing ? fs.planNow : st.landing ? fs.expLdg : f.block;
  const lastTxt = fs.last ? `${fmtW(fs.last.fob, o)} <small class="${fs.last.dev < 0 ? "warn" : "ok"}">${fmtW(fs.last.dev, o, { sign: true, bare: true })}</small>` : "—";
  return `<div class="fuelbox"><div><div class="lbl">${st.takeoff ? t("Planned FOB now") : t("Block fuel")}</div><div class="big">${fmtW(fobNow, o, { bare: true })}<small class="dim" style="font-size:14px"> ${unitLabel()}</small></div></div>
    <div><div class="lbl">${t("Last check")}</div><div class="v" style="font:700 18px var(--f-num);margin-top:6px">${lastTxt}</div><div class="dim" style="font-size:12px">${fs.last ? hhmmz(fs.last.t) + (fs.last.fix ? " · " + esc(fs.last.fix) : "") : t("none yet")}</div></div>
    ${fuelBar(o, d, big)}
    <button class="btn pri" data-do="check">${I.fuel.replace("<svg", '<svg width="18" height="18"')}${t("Fuel check")}</button></div>`;
}
// the tank from right to left: taxi and trip burn away, reserves stay
function fuelBar(o, d, legend) {
  const f = o.fuel, fs = d.fs, block = f.block || 1;
  const parts = [["final", f.final, t("Final reserve")], ["altn", f.altn, t("Alternate")], ["cont", f.cont, t("Contingency")], ["etops", f.etops, "EDTO"], ["extra", f.extra, t("Extra")], ["trip", f.trip, t("Trip")], ["taxi", f.taxi, t("Taxi")]].filter((p) => p[1] > 0);
  const sum = parts.reduce((s, p) => s + p[1], 0) || block;
  const pc = (v) => Math.max(0, Math.min(100, (v / sum) * 100));
  const now = S.st.takeoff && !S.st.landing && fs.planNow != null ? fs.planNow + (fs.dev || 0) : null; // plan here, corrected by the last check
  const mk = (v, cls, top, bot) => (v == null ? "" : `<div class="fbar-mk ${cls}" style="left:${pc(v)}%">${top ? `<span class="top">${top}</span>` : ""}${bot ? `<span class="bot">${bot}</span>` : ""}</div>`);
  return `<div class="fbar-wrap"><div class="fbar">${parts.map((p) => `<i class="c-${p[0]}" style="width:${pc(p[1])}%" title="${esc(p[2])}"></i>`).join("")}
      ${now != null ? `<i class="c-used" style="position:absolute;right:0;top:0;bottom:0;width:${100 - pc(now)}%;opacity:.85"></i>` : ""}</div>
    ${mk(fs.minLdg, "", "", t("MIN {v}", { v: fmtW(fs.minLdg, o, { bare: true }) }))}
    ${fs.expLdg != null ? mk(fs.expLdg, "exp", t("LDG {v}", { v: fmtW(fs.expLdg, o, { bare: true }) }), "") : ""}
    ${now != null ? mk(now, "", t("NOW {v}", { v: fmtW(now, o, { bare: true }) }), "") : ""}
    ${legend ? `<div class="legend">${parts.map((p) => `<span><i class="c-${p[0]}"></i>${esc(p[2])} ${fmtW(p[1], o, { bare: true })}</span>`).join("")}</div>` : ""}</div>`;
}

// ---------- tabs ----------
const VIEW = {
  perf: (o) => perfView(o),
  overview(o, d, now) {
    const st = S.st, ph = d.phase, pl = S.pilot;
    const air = st.takeoff && !st.landing;
    const toOut = o.times.out - now;
    const c1 = `<div><div class="lbl">${t("Phase")}</div><div class="big acc" style="font-family:var(--f-cond)">${esc(t(PHASE[ph]))}</div><div class="s dim">${pl ? `${fl(pl.altitude)} · GS ${pl.groundspeed} kt` : t("no live position")}</div></div>`;
    const c2 = air && d.next ? `<div><div class="lbl">${t("Next fix")}</div><div class="big">${esc(d.next.ident)}</div><div class="s dim">${nf(d.nextIn)} NM · ${hhmmz(d.nextEta)}</div></div>`
      : !st.offBlock ? `<div><div class="lbl">${t("Off block")}</div><div class="big ${toOut < 0 ? "warn" : ""}">${hhmmz(o.times.out)}</div><div class="s dim">${toOut > 0 ? t("in {t}", { t: dur(toOut) }) : t("{t} ago", { t: dur(-toOut) })}</div></div>`
      : `<div><div class="lbl">${st.landing ? t("Landed") : t("Take-off")}</div><div class="big">${hhmmz(st.landing || d.est.off)}</div><div class="s dim">${st.landing ? esc(o.dest.icao) : t("estimated")}</div></div>`;
    const c3 = `<div><div class="lbl">${t("To go")}</div><div class="big">${nf(d.toGo)}<small style="font-size:14px" class="dim"> NM</small></div><div class="s dim">${t("of {n} NM", { n: nf(d.total) })}</div></div>`;
    const late = d.est.delay > 15 * 60e3;
    const c4 = `<div><div class="lbl">${st.landing ? t("On block") : "ETA"}</div><div class="big ${late ? "warn" : ""}">${hhmmz(st.landing ? d.est.in : d.est.on)}</div><div class="s dim">${t("Local")} ${localHM(st.landing ? d.est.in : d.est.on, tzOf(o.dest))} · ${d.est.delay == null ? "" : dur(d.est.delay, true)}</div></div>`;
    return `<div class="fly-top"><div class="fly-cs">${esc(o.iataNo || o.callsign)}<small>${esc(o.callsign)}</small></div>
        <div class="dim">${esc(cityOf(o.dep))} → ${esc(cityOf(o.dest))}</div>
        <div class="fly-meta">${esc(o.type)}${o.reg ? " · " + esc(o.reg) : ""}${o.selcal ? " · SELCAL " + esc(o.selcal) : ""} · OFP ${hhmmz(o.generated)}${o.airac ? " · AIRAC " + esc(o.airac) : ""}</div></div>
      ${routeLine(o, d)}
      <div class="apts">${aptCard(o, o.dep, now, true)}${aptCard(o, o.dest, now, true)}${o.altns.map((a) => aptCard(o, a, now)).join("")}${edtoCard(o)}</div>
      <div class="now-card">${c1}${c2}${c3}${c4}</div>
      ${timesStrip(o, d)}
      ${fuelBox(o, d, false)}
      <div class="card" style="margin-top:14px">${kv([
        [t("Passengers"), o.pax != null ? nf(o.pax) : "—"], ["ZFW", fmtW(o.weights.zfw, o)], ["TOW", fmtW(o.weights.tow, o)],
        [t("Cruise"), fl(o.cruise), o.stepclimb ? esc(o.stepclimb) : ""], ["CI", esc(o.ci || "—")],
        [t("Avg wind"), o.avgWind != null ? (o.avgWind > 0 ? "+" : "") + o.avgWind + " kt" : "—", o.avgWind < 0 ? t("headwind") : o.avgWind > 0 ? t("tailwind") : ""],
        [t("Distance"), nf(o.dist) + "<small>NM</small>", o.airDist ? t("air {n} NM", { n: nf(o.airDist) }) : ""], [t("Flight time"), dur((o.times.ete || 0) * 1000)],
      ])}</div>`;
  },

  times(o, d, now) {
    const st = S.st, T = o.times, e = d.est, tzD = tzOf(o.dep), tzA = tzOf(o.dest);
    const row = (lbl, plan, est, act, tz) => {
      const v = act || est, diff = plan && v ? v - plan : null;
      return `<tr><td class="id">${lbl}</td><td>${hhmmz(plan)}</td><td>${act ? "" : hhmmz(est)}</td><td>${act ? `<b>${hhmmz(act)}</b>` : "—"}</td>
        <td class="${diff > 15 * 60e3 ? "bad" : diff > 5 * 60e3 ? "warn" : "ok"}">${diff == null ? "" : dur(diff, true)}</td><td class="dim">${localHM(v, tz)}</td></tr>`;
    };
    const blockAct = st.onBlock && st.offBlock ? st.onBlock - st.offBlock : null, airAct = st.landing && st.takeoff ? st.landing - st.takeoff : null;
    return `<div class="card"><table class="t"><thead><tr><th></th><th>${t("Plan")}</th><th>${t("Estimated")}</th><th>${t("Actual")}</th><th>${t("Diff")}</th><th>${t("Local")}</th></tr></thead><tbody>
        ${row(t("Off block") + " · OUT", T.out, T.out, st.offBlock, tzD)}${row(t("Take-off") + " · OFF", T.off, e.off, st.takeoff, tzD)}
        ${row(t("Landing") + " · ON", T.on, e.on, st.landing, tzA)}${row(t("On block") + " · IN", T.in, e.in, st.onBlock, tzA)}</tbody></table></div>
      <div class="card">${kv([
        [t("Block time"), dur(T.block ? T.block * 1000 : T.in - T.out), blockAct ? t("actual {t}", { t: dur(blockAct) }) : t("plan")],
        [t("Flight time"), dur((T.ete || 0) * 1000), airAct ? t("actual {t}", { t: dur(airAct) }) : t("plan")],
        [t("Taxi out"), dur(e.taxiOut), st.takeoff && st.offBlock ? t("actual {t}", { t: dur(st.takeoff - st.offBlock) }) : t("plan")],
        [t("Taxi in"), dur(e.taxiIn), st.onBlock && st.landing ? t("actual {t}", { t: dur(st.onBlock - st.landing) }) : t("plan")],
        [t("Delay at the gate"), e.delay == null ? "—" : dur(e.delay, true)],
      ])}</div>
      <div class="card"><div class="lbl" style="margin-bottom:10px">${t("Clocks")}</div>${kv([
        ["UTC", hhmmz(now)], [o.dep.icao, localHM(now, tzD), esc(tzD)], [o.dest.icao, localHM(now, tzA), esc(tzA)],
        [t("Time difference"), tzDiff(now, tzD, tzA)],
      ])}</div>`;
  },

  plan(o, d, now) {
    const st = S.st, nl = o.navlog, pr = S.pr, air = st.takeoff && !st.landing;
    const tPos = air && pr ? planAt(nl, pr, "t") ?? 0 : 0;
    const base = air ? now - tPos * 1000 : d.est.off; // time at the start of the route
    const total = d.total;
    const rows = nl.map((x, k) => {
      const past = air && pr ? k <= pr.i : st.landing ? true : false, next = air && pr && k === pr.i + 1;
      const ata = st.fixTimes[k + ":" + x.ident];
      const eta = base + (x.t || 0) * 1000;
      return `<tr class="${past ? "past" : ""} ${next ? "next" : ""}"><td class="id">${esc(x.ident)}</td><td>${esc(x.airway === "DCT" ? "DCT" : x.airway)}</td><td>${fl(x.alt)}</td>
        <td>${x.wind?.[1] != null ? String(x.wind[0]).padStart(3, "0") + "/" + x.wind[1] : ""}</td><td>${x.oat != null ? x.oat + "°" : ""}</td>
        <td class="r">${nf(x.legNm)}</td><td class="r">${nf(total - x.cumNm)}</td><td class="r">${dur((x.t || 0) * 1000)}</td>
        <td>${ata ? "" : hhmmz(eta)}</td><td>${ata ? `<b>${hhmmz(ata)}</b>` : ""}</td><td class="r">${fmtW(x.fob, o, { bare: true })}</td><td class="r dim">${fmtW(x.fobMin, o, { bare: true })}</td></tr>`;
    }).join("");
    return `<div class="card"><div class="lbl">${t("Route")}</div><div class="wx-raw" style="margin-top:8px">${esc(o.dep.icao)}/${esc(o.dep.rwy)} ${esc(o.route)} ${esc(o.dest.icao)}/${esc(o.dest.rwy)}</div>
        <div style="margin-top:12px">${kv([[t("Cruise"), fl(o.cruise)], [t("Step climbs"), esc(o.stepclimb || "—")], ["CI", esc(o.ci || "—")], [t("Distance"), nf(o.dist) + "<small>NM</small>"], ["AIRAC", esc(o.airac || "—")]])}</div></div>
      <div class="card" style="padding:0;overflow:auto;max-height:none"><table class="t"><thead><tr><th>${t("Fix")}</th><th>${t("Via")}</th><th>${t("Alt")}</th><th>${t("Wind")}</th><th>OAT</th>
        <th class="r">${t("Leg")}</th><th class="r">${t("To go")}</th><th class="r">ETE</th><th>ETA</th><th>ATA</th><th class="r">FOB ${unitLabel()}</th><th class="r">${t("Min")}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  },

  wx(o, d, now) {
    return `<div class="grid wx-grid">${routeSigmetsHtml(o, now)}${airportsOfFlight(o).map((a) => {
      const w = wxOf(a.icao), at = (a === o.dep || a === o.dest) ? atisOf(a.icao) : null;
      const age = w?.at ? Math.round((now - w.at) / 60e3) : null;
      return `<div class="card wx-card"><div class="h"><span class="icao">${esc(a.icao)}</span>${cat(w)}<span class="pill">${esc(roleOf(o, a))}</span><span class="dim" style="margin-left:auto;font-size:12px">${esc(cityOf(a))}</span></div>
        ${w ? `<div style="margin-top:12px">${kv([[t("Wind"), wind(w)], [t("Visibility"), vis(w)], [t("Ceiling"), ceil(w)], ["QNH", w.qnh ? w.qnh + (w.alt ? `<small>${w.alt.toFixed(2)}</small>` : "") : "—"],
          [t("Temp / dew"), w.temp != null ? `${w.temp}° / ${w.dew ?? "—"}°` : "—"], w.wx ? [t("Weather"), esc(w.wx)] : null])}</div>
          <div class="lbl" style="margin-top:12px">METAR <span class="faint">· ${esc(w.src || "")}${age != null ? " · " + t("{n} min ago", { n: age }) : ""}</span></div><div class="wx-raw">${esc(w.raw)}</div>` : `<div class="empty">${t("No weather")}</div>`}
        ${a.taf ? `<div class="lbl" style="margin-top:12px">TAF <span class="faint">· SimBrief</span></div><div class="wx-raw">${esc(a.taf)}</div>` : ""}
        ${at ? `<div class="lbl" style="margin-top:12px">ATIS ${esc(at.letter || "")} <span class="faint">· ${esc(at.freq || "")}</span></div><div class="wx-raw">${esc(at.list.flatMap((x) => x.text_atis || []).join(" "))}</div>` : ""}</div>`;
    }).join("")}</div>`;
  },

  fuel(o, d, now) {
    const f = o.fuel, fs = d.fs, st = S.st, W = o.weights;
    const rowF = (l, v, cls = "") => `<tr class="${cls}"><td class="id">${esc(l)}</td><td class="r">${fmtW(v, o, { bare: true })}</td></tr>`;
    const margin = fs.expLdg != null ? fs.expLdg - fs.minLdg : null;
    const checks = st.checks.map((c, i) => {
      const prev = st.checks[i - 1];
      return `<tr><td class="id">${hhmmz(c.t)}</td><td>${esc(c.fix || "—")}</td><td class="r">${nf(c.along)}</td><td class="r">${fmtW(c.plan, o, { bare: true })}</td><td class="r"><b>${fmtW(c.fob, o, { bare: true })}</b></td>
        <td class="r ${c.dev < 0 ? "warn" : "ok"}">${fmtW(c.dev, o, { sign: true, bare: true })}</td><td class="r dim">${prev ? fmtW(c.dev - prev.dev, o, { sign: true, bare: true }) : ""}</td>
        <td class="r"><button class="btn small" data-do="delcheck" data-i="${i}">×</button></td></tr>`;
    }).join("");
    const wrow = (l, v, max) => [l, fmtW(v, o, { bare: true }) + `<small>${unitLabel()}</small>`,
    max ? t("max {m}", { m: fmtW(max, o, { bare: true }) }) + (v && max ? ` · <span class="${v > max ? "bad" : "ok"}">${fmtW(max - v, o, { sign: true, bare: true })}</span>` : "") : ""];
    return `${fuelBox(o, d, true)}
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));margin-top:14px">
        <div class="card"><div class="lbl" style="margin-bottom:8px">${t("Fuel plan")} · ${unitLabel()}</div><table class="t"><tbody>
          ${rowF(t("Taxi"), f.taxi)}${rowF(t("Trip"), f.trip)}${rowF(t("Contingency"), f.cont)}${rowF(t("Alternate"), f.altn)}${rowF(t("Final reserve"), f.final)}
          ${f.etops ? rowF("EDTO", f.etops) : ""}${rowF(t("Extra"), f.extra)}${rowF(t("Block fuel"), f.block, "next")}${rowF(t("Take-off fuel"), f.takeoff)}${rowF(t("Min. take-off fuel"), f.minTakeoff)}</tbody></table></div>
        <div class="card"><div class="lbl" style="margin-bottom:12px">${t("At landing")}</div>${kv([
          [t("Plan"), fmtW(fs.planLdg, o, { bare: true }) + `<small>${unitLabel()}</small>`],
          [t("Expected"), `<span class="${fs.expLdg != null && fs.expLdg < fs.minLdg ? "bad" : ""}">${fmtW(fs.expLdg, o, { bare: true })}</span><small>${unitLabel()}</small>`, fs.dev != null ? t("{d} from the last check", { d: fmtW(fs.dev, o, { sign: true }) }) : t("no check yet")],
          [t("Trend"), fs.trend != null ? `<span class="${fs.trend < fs.minLdg ? "bad" : ""}">${fmtW(fs.trend, o, { bare: true })}</span><small>${unitLabel()}</small>` : "—", fs.trend != null ? t("if the burn stays as it is") : t("after two checks 300 NM apart")],
          [t("Minimum"), fmtW(fs.minLdg, o, { bare: true }) + `<small>${unitLabel()}</small>`, t("alternate + final reserve")],
          [t("Margin"), margin != null ? `<span class="${margin < 0 ? "bad" : margin < (f.cont || 0) ? "warn" : "ok"}">${fmtW(margin, o, { sign: true, bare: true })}</span>` : "—"],
        ])}</div>
        <div class="card"><div class="lbl" style="margin-bottom:12px">${t("Weights")}</div>${kv([wrow("ZFW", W.zfw, W.maxZfw), wrow("TOW", W.tow, W.maxTow), wrow("LDW", W.ldw, W.maxLdw), wrow(t("Payload"), W.payload)])}</div>
      </div>
      <div class="card"><div style="display:flex;align-items:center;gap:12px;margin-bottom:6px"><div class="lbl">${t("Fuel checks")}</div><span class="dim" style="font-size:12px">${t("about every hour in cruise")}</span>
          <button class="btn small pri" style="margin-left:auto" data-do="check">${t("Fuel check")}</button></div>
        ${checks ? `<table class="t"><thead><tr><th>${t("Time")}</th><th>${t("Next fix")}</th><th class="r">NM</th><th class="r">${t("Plan")}</th><th class="r">FOB</th><th class="r">${t("Diff")}</th><th class="r">${t("Change")}</th><th></th></tr></thead><tbody>${checks}</tbody></table>`
          : `<div class="empty">${t("No fuel check on this flight yet.")}</div>`}</div>`;
  },
};

function tzDiff(now, a, b) {
  const off = (tz) => { try { const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(now).find((x) => x.type === "timeZoneName")?.value || "GMT"; const m = p.match(/GMT([+-]\d+)(?::(\d+))?/); return m ? +m[1] * 60 + (m[2] ? Math.sign(+m[1] || 1) * +m[2] : 0) : 0; } catch { return 0; } };
  const d = off(b) - off(a);
  return (d >= 0 ? "+" : "-") + Math.floor(Math.abs(d) / 60) + (Math.abs(d) % 60 ? ":" + String(Math.abs(d) % 60).padStart(2, "0") : "") + " h";
}
