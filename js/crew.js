// Crew side of ASL Ops: the roster (dashboard bookings and the loaded OFP, put together into duties), check-in,
// the crew desk (inbox, preflight list, weather, NOTAMs) and the report after the flight (actual times and fuel, 72 h).
import { S, settings, logbook, saveLogbook, wxOf } from "./data.js";
import { t, nf, loc, LOCALE } from "./i18n.js";
import { esc, store, hhmmz, localHM, dur, distNm } from "./util.js";
import { tzOf, cityOf, aptDb } from "./tz.js";
import { pilot } from "./account.js";
import { A } from "./hoppie.js";
import { notes } from "./notify.js";
import { notify } from "./notify.js";
import { metarFor } from "./apps/weather.js";
import { career, careerHtml } from "./career.js";

const REPORT = 60 * 60e3, RELEASE = 30 * 60e3; // report 60 min before the first departure, off duty 30 min after the last arrival
const estBlock = (dep, arr) => { const a = aptDb(dep), b = aptDb(arr); return a && b ? (distNm([a[0], a[1]], [b[0], b[1]]) / 430 * 60 + 25) * 60e3 : 2 * 36e5; };

// every leg we know of, then joined into duties: a leg that starts where the last ended within 12 h belongs to the same duty
export function legs() {
  const o = S.ofp, out = [];
  if (o?.times?.out) out.push({ src: "OFP", cs: o.callsign, no: o.iataNo || o.callsign, dep: o.dep.icao, arr: o.dest.icao, std: o.times.out, sta: o.times.in || o.times.out + estBlock(o.dep.icao, o.dest.icao), type: o.type, reg: o.reg });
  for (const b of pilot()?.bookings || []) {
    if (!b.at || (o && b.dep === o.dep.icao && b.arr === o.dest.icao && Math.abs(b.at - o.times.out) < 6 * 36e5)) continue;
    out.push({ src: "Booking", cs: b.callsign || "", no: b.number || b.callsign || "", dep: b.dep, arr: b.arr, std: b.at, sta: b.at + estBlock(b.dep, b.arr), type: b.type || "", reg: b.reg || "", est: true });
  }
  if (settings.demo && o?.times?.in && o.dest.icao === "KJFK") out.push({ src: "demo", cs: "ASL501", no: "JU501", dep: "KJFK", arr: "LYBE", std: o.times.in + 2.5 * 36e5, sta: o.times.in + 2.5 * 36e5 + 9 * 36e5, type: o.type, reg: o.reg, est: true });
  return out.sort((a, b) => a.std - b.std);
}
export function duties() {
  const ds = [];
  for (const l of legs()) {
    const d = ds.at(-1), prev = d?.legs.at(-1);
    if (prev && prev.arr === l.dep && l.std - prev.sta < 12 * 36e5 && l.std > prev.sta) d.legs.push(l);
    else ds.push({ legs: [l] });
  }
  for (const d of ds) { d.report = d.legs[0].std - REPORT; d.end = d.legs.at(-1).sta + RELEASE; d.key = d.legs[0].dep + d.legs[0].std; d.block = d.legs.reduce((s, l) => s + (l.sta - l.std), 0); }
  return ds;
}
const checkin = () => store.get("asl.checkin", {});
export const checkedIn = (d) => checkin()[d.key] || null;
export function doCheckIn(d) { store.set("asl.checkin", { ...checkin(), [d.key]: Date.now() }); notify({ app: "ops", tab: "roster", ic: "check", lv: "ok", title: t("Checked in"), text: `${d.legs.map((l) => l.no).join(" · ")} · ${t("Report")} ${hhmmz(d.report)}` }); }

// ---------- roster ----------
export function rosterView(now) {
  const ds = duties().filter((d) => d.end > now - 24 * 36e5);
  const dayF = new Intl.DateTimeFormat(LOCALE(), { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
  const duty = (d) => {
    const ci = checkedIn(d), open = now >= d.report - 3 * 36e5 && now < d.legs[0].std, cur = now >= d.report && now <= d.end;
    const legRows = d.legs.map((l, i) => {
      const turn = i ? `<div class="rs-turn">${t("Turnaround")} ${esc(l.dep)} · ${dur(l.std - d.legs[i - 1].sta)}</div>` : "";
      return `${turn}<div class="rs-leg"><b class="no">${esc(l.no)}</b><span class="rt"><b>${esc(l.dep)}</b> ${hhmmz(l.std).slice(0, 5)} <span class="dim">→</span> <b>${esc(l.arr)}</b> ${hhmmz(l.sta).slice(0, 5)}${l.est ? "<sup>*</sup>" : ""}</span>
        <span class="dim">${esc(l.type || "")}${l.reg ? " · " + esc(l.reg) : ""}</span><span class="tag">${esc(l.src)}</span></div>`; }).join("");
    return `<div class="card rs-duty${cur ? " cur" : ""}"><div class="rs-top"><div><div class="lbl">${esc(dayF.format(d.report))}</div><b class="rs-route">${[d.legs[0].dep, ...d.legs.map((l) => l.arr)].map(esc).join(" – ")}</b></div>
        <div class="rs-times"><div><span class="lbl">${t("Report")}</span><b class="num">${hhmmz(d.report)}</b><small>${t("Local")} ${localHM(d.report, tzOf({ icao: d.legs[0].dep }))}</small></div>
        <div><span class="lbl">${t("Block")}</span><b class="num">${dur(d.block)}</b></div><div><span class="lbl">${t("Duty")}</span><b class="num">${dur(d.end - d.report)}</b></div>
        <div><span class="lbl">${t("Off duty")}</span><b class="num">${hhmmz(d.end)}</b></div></div></div>
      ${legRows}
      <div class="rs-ci">${ci ? `<span class="ok">✓ ${t("Checked in {t}", { t: hhmmz(ci) })}</span>` : open ? `<button class="btn pri" data-do="checkin" data-key="${esc(d.key)}">${t("Check in")}</button><span class="dim">${t("Check-in is open until the departure.")}</span>`
        : now < d.report - 3 * 36e5 ? `<span class="dim">${t("Check-in opens {t}", { t: hhmmz(d.report - 3 * 36e5) })}</span>` : ""}</div></div>`;
  };
  return `<div class="rs-cols"><div>${ds.length ? ds.map(duty).join("") : `<div class="card"><div class="lbl">${t("Roster")}</div><p class="dim">${t("No duties yet. Book a flight on the dashboard or load an OFP from SimBrief.")}</p></div>`}
      <p class="dim" style="font-size:12px">* ${t("estimated from the distance – bookings have no arrival time.")} ${t("All times UTC.")}</p></div>
    <div>${profileCard()}</div></div>`;
}
function profileCard() {
  const d = pilot(), kv = (l, v) => `<div><span class="lbl">${l}</span><b>${v}</b></div>`;
  return `<div class="card rs-prof"><div class="lbl">${t("Profile")}</div><h3>${esc(d?.name || t("Captain"))}</h3>
    <div class="rs-kv">${kv(t("Pilot ID"), esc(d?.pilotId || d?.callsign || "—"))}${kv(t("Rank"), esc(d?.rank || "—"))}
      ${kv("VATSIM", esc(settings.cid || "—"))}${kv("SimBrief", esc(settings.simbrief || "—"))}</div>
    ${d ? "" : `<p class="dim" style="font-size:12.5px">${t("Sign in with your VATSIM CID and PIN in Settings to see your profile.")}</p>`}
    <div style="margin-top:12px">${careerHtml(career())}</div></div>`;
}

// ---------- crew desk ----------
let desk = "inbox";
export const setDesk = (k) => { desk = k; };
const flightKey = () => S.ofp ? `${S.ofp.callsign}.${S.ofp.dep.icao}.${S.ofp.dest.icao}` : "";
const PRE = [["wx", "Weather briefed"], ["notam", "NOTAMs read"], ["fuel", "Fuel decided"], ["tech", "Aircraft status checked"], ["load", "Load sheet checked"]];
export function preflight() {
  const o = S.ofp, man = store.get("asl.pre." + flightKey(), {});
  const auto = [[!!o, t("OFP loaded"), o ? `${o.callsign} ${o.dep.icao}–${o.dest.icao}` : ""], [!!(o && S.ofpAt && Date.now() - (o.generated || S.ofpAt) < 24 * 36e5), t("OFP from the last 24 h"), ""],
    [!!S.pilot, t("Connected to VATSIM"), S.pilot?.callsign || ""], [!!(o && (wxOf(o.dep.icao) || metarFor(o.dep.icao)) && (wxOf(o.dest.icao) || metarFor(o.dest.icao))), t("Weather for departure and destination"), ""],
    [!!(duties().find((d) => d.legs.some((l) => l.dep === o?.dep.icao)) && checkedIn(duties().find((d) => d.legs.some((l) => l.dep === o?.dep.icao)))), t("Checked in"), ""]];
  return { auto, man, done: auto.filter((a) => a[0]).length + PRE.filter(([k]) => man[k]).length, all: auto.length + PRE.length };
}
export function deskView(now) {
  const sub = [["inbox", "Inbox"], ["pre", "Preflight"], ["wx", "Weather"], ["notam", "NOTAM"]];
  const head = `<div class="seg ed-seg">${sub.map(([k, l]) => `<button data-desk="${k}" class="${desk === k ? "on" : ""}">${t(l)}</button>`).join("")}</div>`;
  const o = S.ofp;
  if (desk === "inbox") {
    const items = [
      ...(S.notices?.notices || []).filter((n) => n.id && (!n.until || n.until >= new Date(now).toISOString().slice(0, 10))).map((n) => ({ at: Date.parse(n.date || "") || 0, from: "Air Serbia Virtual", title: loc(n.title), text: loc(n.text) })),
      ...A.msgs.map((m) => ({ at: A.seen.get(m.id) || 0, from: "ACARS · " + m.from, title: m.type.toUpperCase(), text: m.text })),
      ...notes().slice(0, 20).map((n) => ({ at: n.at, from: "ASL Pad", title: n.title, text: n.text })),
    ].sort((a, b) => b.at - a.at);
    return head + `<div class="card ed-inbox">${items.map((i) => `<div class="ed-msg"><div><span class="lbl">${esc(i.from)}</span><b>${esc(i.title || "")}</b><p>${esc(i.text || "")}</p></div><span class="dim num">${!i.at ? "" : now - i.at > 864e5 ? new Date(i.at).toISOString().slice(0, 10) : hhmmz(i.at)}</span></div>`).join("") || `<p class="dim">${t("No messages.")}</p>`}</div>`;
  }
  if (desk === "pre") {
    const p = preflight();
    return head + `<div class="card"><div class="ed-prog"><b>${p.done}/${p.all}</b><span><i style="width:${Math.round((p.done / p.all) * 100)}%"></i></span></div>
      <div class="lbl" style="margin:12px 0 6px">${t("Checked by the pad")}</div>${p.auto.map(([ok, l, s]) => `<div class="ed-chk ${ok ? "ok" : ""}"><span class="b">${ok ? "✓" : ""}</span><b>${esc(l)}</b><span class="dim">${esc(s)}</span></div>`).join("")}
      <div class="lbl" style="margin:14px 0 6px">${t("Your checks")}</div>${PRE.map(([k, l]) => `<button class="ed-chk ${p.man[k] ? "ok" : ""}" data-do="pre" data-k="${k}"><span class="b">${p.man[k] ? "✓" : ""}</span><b>${t(l)}</b></button>`).join("")}</div>`;
  }
  if (desk === "wx") {
    if (!o) return head + `<div class="card dim">${t("No flight loaded")}</div>`;
    return head + [["Departure", o.dep], ["Destination", o.dest], ...(o.altns || []).map((a) => ["Alternate", a])].map(([l, a]) => { const w = wxOf(a.icao);
      return `<div class="card"><div style="display:flex;gap:10px;align-items:baseline"><span class="lbl">${t(l)}</span><b style="font:700 20px var(--f-cond)">${esc(a.icao)}</b><span class="dim">${esc(cityOf(a))}</span>${w?.cat ? `<span class="cat ${w.cat}" style="margin-left:auto">${w.cat}</span>` : ""}</div>
        <div class="lbl" style="margin-top:8px">METAR</div><div class="wx-raw">${esc(w?.raw || metarFor(a.icao) || a.metar || "—")}</div><div class="lbl" style="margin-top:8px">TAF</div><div class="wx-raw">${esc(a.taf || "—")}</div></div>`; }).join("");
  }
  if (!o) return head + `<div class="card dim">${t("No flight loaded")}</div>`;
  const list = [o.dep, o.dest, ...(o.altns || [])];
  return head + list.map((a) => `<div class="card"><div style="display:flex;gap:10px;align-items:baseline"><b style="font:700 20px var(--f-cond)">${esc(a.icao)}</b><span class="dim">${esc(cityOf(a))}</span><span class="dim" style="margin-left:auto">${t("{n} NOTAMs", { n: (a.notams || []).length })}</span></div>
      ${(a.notams || []).filter((n) => !n.to || n.to > now).map((n) => `<details class="ed-notam"><summary><b>${esc(n.id)}</b> <span class="dim">${n.from ? hhmmz(n.from) : ""}${n.to ? " – " + new Date(n.to).toISOString().slice(5, 16).replace("T", " ") + "z" : ""}</span> <span>${esc(n.text.split("\n").find((x) => /^E\)/.test(x.trim()))?.trim().slice(2).trim().slice(0, 90) || n.text.slice(0, 90))}</span></summary><pre>${esc(n.text)}</pre></details>`).join("")
        || `<p class="dim" style="font-size:13px">${t("No NOTAMs in the OFP. In SimBrief, NOTAMs are part of the OFP options.")}</p>`}</div>`).join("")
    + (o.pdf ? `<a class="btn small" href="${esc(o.pdf)}" target="_blank" rel="noopener">OFP PDF</a>` : "");
}

// ---------- report: actual times and fuel of the last 72 h ----------
const MISSING = (e) => ["offBlock", "takeoff", "landing", "onBlock"].filter((k) => !e[k]); // fuel is welcome but optional
export const openReports = (now = Date.now()) => logbook().filter((e) => now - (e.onBlock || e.date) < 72 * 36e5 && MISSING(e).length && !e.reported);
export function reportView(now) {
  const list = logbook().filter((e) => now - (e.onBlock || e.date) < 72 * 36e5);
  const hm = (v) => (v ? new Date(v).toISOString().slice(11, 16) : "");
  return `<div class="card"><div class="lbl">${t("Flight report")}</div><p class="dim" style="font-size:13px;margin:4px 0 10px">${t("Check your actual times and the fuel of the last 72 hours. Times in UTC.")}</p>
    ${list.map((e) => { const miss = MISSING(e), done = e.reported || !miss.length;
      return `<div class="rp ${done ? "ok" : ""}"><div class="rp-h"><b>${esc(e.flightNo)} ${esc(e.dep)}–${esc(e.arr)}</b><span class="dim">${new Date(e.date).toISOString().slice(0, 10)}</span>${done ? `<span class="ok">✓ ${t("Complete")}</span>` : `<span class="tag warn">${t("Times missing")}</span>`}</div>
        <div class="rp-f">${[["offBlock", "OUT"], ["takeoff", "OFF"], ["landing", "ON"], ["onBlock", "IN"]].map(([k, l]) => `<label><span>${l}</span><input type="time" data-rp="${esc(e.id)}" data-f="${k}" value="${hm(e[k])}"></label>`).join("")}
          <label><span>${t("Fuel used")} (${esc(e.units || "kg")})</span><input inputmode="numeric" data-rp="${esc(e.id)}" data-f="fuelUsed" value="${e.fuelUsed ?? ""}"></label>
          <label><span>${t("Fuel at landing")}</span><input inputmode="numeric" data-rp="${esc(e.id)}" data-f="fuelLanding" value="${e.fuelLanding ?? ""}"></label>
          <button class="btn small${done ? "" : " pri"}" data-do="report" data-id="${esc(e.id)}">${t("Save report")}</button></div></div>`; }).join("") || `<p class="dim">${t("No flights in the last 72 hours.")}</p>`}</div>`;
}
export function reportInput(el) {
  const id = el.dataset.rp, f = el.dataset.f, l = logbook(), e = l.find((x) => x.id === id); if (!e) return;
  if (f === "fuelUsed" || f === "fuelLanding") e[f] = el.value.trim() === "" ? null : +el.value.replace(/\D/g, "");
  else { const base = new Date(e.date || Date.now()), [h, m] = el.value.split(":").map(Number); if (el.value) { let v = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, m); if (f !== "offBlock" && e.offBlock && v < e.offBlock - 36e5) v += 864e5; e[f] = v; } else e[f] = null; }
  saveLogbook(l);
}
export function sendReport(id) { const l = logbook(), e = l.find((x) => x.id === id); if (!e) return; e.reported = Date.now(); saveLogbook(l); notify({ app: "log", ic: "check", lv: "ok", title: t("Report saved"), text: `${e.flightNo} ${e.dep}–${e.arr}` }); }
