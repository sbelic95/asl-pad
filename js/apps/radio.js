// ASL Fly → "Radio & ACARS": slot status before the flight, the frequency guide (js/atc.js) and ACARS/CPDLC over Hoppie
// (js/hoppie.js). Typing happens in sheets, so the tab can be rebuilt every few seconds without losing input.
import { S, settings, atisOf, departureStand, emit } from "../data.js";
import { t, nf } from "../i18n.js";
import { esc, hhmmz, dur } from "../util.js";
import { sheet } from "../sheet.js";
import { freqPlan, loadAtcData, atcReady } from "../atc.js";
import { A, acarsReady, pollAcars, inforeq, telex, cpdlcLogon, cpdlcLogoff, cpdlcAnswer, answersFor, pdcText, unread, markRead } from "../hoppie.js";

const kmTxt = (s) => (s.km != null && s.km > 0.5 ? [s.min != null ? t("in about {n} min", { n: s.min }) : "", t("{n} km ahead", { n: nf(Math.round(s.km)) })].filter(Boolean).join(" · ") : "");
const altTxt = (st) => (st.alt?.length ? t("also") + ": " + st.alt.map((a) => a.cs + " " + a.mhz).join(" · ") : "");

// ---------- slot (vIFF CDM) before off-block ----------
function slotCard(o, now) {
  const c = S.cdm; if (!c || S.st?.offBlock) return "";
  const open = c.tsat ? c.tsat - 5 * 60e3 : null, close = c.tsat ? c.tsat + 5 * 60e3 : null;
  const state = !c.tsat ? "pending" : now < open ? "wait" : now <= close ? "go" : "late";
  const head = { pending: t("No TSAT yet"), wait: t("Start-up from {t}", { t: hhmmz(open) }), go: t("Start-up window open"), late: t("TSAT expired") }[state];
  const sub = state === "wait" ? t("in {t}", { t: dur(open - now) }) : state === "go" ? t("closes {t}", { t: hhmmz(close) }) : state === "late" ? t("Set a new TOBT or call ATC.") : t("TOBT {b}.", { b: hhmmz(c.tobt) });
  const cell = (l, v, cls = "") => `<div><div class="lbl">${l}</div><div class="v ${cls}">${v}</div></div>`;
  return `<div class="card rd-slot ${state}"><div class="rd-slot-h"><div><div class="lbl">${t("Slot")} · vIFF CDM</div><b>${esc(head)}</b><span class="dim">${esc(sub)}</span></div>
      <div class="rd-tsat"><span class="lbl">TSAT</span><b class="num">${hhmmz(c.tsat)}</b></div></div>
    <div class="kv">${cell("EOBT", hhmmz(c.eobt))}${cell("TOBT", hhmmz(c.tobt))}${cell("TTOT", hhmmz(c.ttot))}${c.ctot ? cell("CTOT", hhmmz(c.ctot), "warn") : ""}${cell(t("Runway"), esc(c.rwy || "—"))}${cell("SID", esc(c.sid || "—"))}</div></div>`;
}

// ---------- frequency guide ----------
function freqCard(now) {
  if (!atcReady()) loadAtcData().then(emit);
  const p = freqPlan(); if (!p?.cur) return "";
  const row = (s, cls, lbl, when) => `<div class="rd-row ${cls}${s.st.unicom ? " unicom" : ""}"><span class="lbl">${esc(lbl)} · ${esc(s.role)}</span>
    <span class="stn">${esc(s.st.name)}<small>${esc(s.st.cs)}</small></span><b class="mhz num">${esc(s.st.mhz)}</b>${s.st.ctaf ? `<span class="when ctaf">CTAF ${esc(s.st.apt)} <b class="num">${esc(s.st.ctaf)}</b>${s.st.ctafTwr ? " · " + esc(t("tower frequency")) : ""}</span>` : ""}${when ? `<span class="when">${esc(when)}</span>` : ""}${altTxt(s.st) ? `<span class="when dim">${esc(altTxt(s.st))}</span>` : ""}</div>`;
  const cf = A.freq && now - A.freq.at < 15 * 60e3 ? A.freq : null;
  let h = cf ? `<div class="rd-row cpdlc"><span class="lbl">CPDLC · ${esc(cf.verb)} · ${hhmmz(cf.at)}</span><span class="stn">${esc(cf.station)}<small>${esc(cf.from)}</small></span><b class="mhz num">${esc(cf.mhz)}</b></div>` : "";
  h += row(p.cur, "", t("Now"), "");
  if (p.next) h += row(p.next, "next" + (p.soon ? " soon" : ""), p.soon ? t("Change soon") : t("Next"), [p.next.when !== t("now") ? p.next.when : "", kmTxt(p.next)].filter(Boolean).join(" · "));
  const later = p.later.map((s) => `<div><span class="n"><b>${esc(s.role)}</b>${esc(s.st.name)}</span><span class="tt">${s.km != null && s.km >= 1 ? (s.min != null ? s.min + " min" : nf(Math.round(s.km)) + " km") : ""}</span><span class="f num">${esc(s.st.ctaf ? "CTAF " + s.st.ctaf : s.st.mhz)}</span></div>`);
  if (p.atisArr) later.unshift(`<div><span class="n"><b>ATIS ${esc(S.ofp.dest.icao)}</b>${t("Listen to information {l} before the approach", { l: p.atisArr.atis_code || "" })}</span><span class="tt"></span><span class="f num">${esc(p.atisArr.frequency)}</span></div>`);
  if (later.length) h += `<div class="rd-later">${later.join("")}</div>`;
  return `<div class="card"><div class="lbl" style="margin-bottom:8px">${t("Frequencies")}${atcReady() ? "" : " · " + t("loading the airspaces…")}</div>${h}
    <p class="dim" style="font-size:12.5px;margin:10px 0 0">${t("Without a controller: UNICOM 122.800. Who is responsible follows the VATSIM top-down rule; distances are estimates along your route.")} ${t("US airports also show their CTAF (from OurAirports; at towered airports the tower frequency, used as CTAF when the tower is closed).")}</p></div>`;
}

// ---------- ACARS / CPDLC (Hoppie) ----------
function acarsCard(o, now) {
  const head = `<div class="rd-ac-h"><div class="lbl">ACARS · CPDLC <span class="dim">(Hoppie)</span></div>`;
  if (!settings.hoppie && !settings.demo) return `<div class="card">${head}</div><p class="dim" style="margin:6px 0 12px">${t("Enter your Hoppie logon code in Settings to read and send ACARS messages, request a PDC, METAR, TAF and ATIS, and log on to CPDLC.")}</p>
      <button class="btn small" data-do="settings">${t("Open Settings")}</button></div>`;
  const err = A.err === "logon" ? t("Hoppie logon code not valid.") : A.err ? t("Hoppie not reachable.") : "";
  const dep = o.dep.icao, arr = o.dest.icao;
  const msgs = A.msgs.map((m) => {
    const at = A.seen.get(m.id), isNew = at && now - at < 10 * 60e3, ans = answersFor(m), done = A.answered?.get(m.id);
    return `<div class="rd-msg ${isNew ? "new" : ""}"><div class="rd-msg-h"><b>${esc(m.from)}</b><span class="pill">${esc(m.own || m.type.toUpperCase())}</span><span class="dim">${at ? hhmmz(at) : t("earlier")}</span></div>
      <div class="rd-msg-t">${esc(m.text)}</div>${ans.length ? `<div class="rd-ans">${ans.map((w) => `<button class="btn small${w === "WILCO" || w === "ROGER" || w === "AFFIRM" ? " pri" : ""}" data-do="ans" data-id="${m.id}" data-w="${w}">${w}</button>`).join("")}</div>` : done ? `<div class="dim" style="font-size:12px">${t("Answered")}: ${esc(done)}</div>` : ""}</div>`;
  }).join("");
  return `<div class="card">${head}<span class="pill ${err ? "bad" : "ok"}">${err ? t("error") : A.station ? "CPDLC " + esc(A.station) : t("connected")}</span></div>
    ${err ? `<div class="bad" style="margin:6px 0">${esc(err)}</div>` : ""}
    <div class="rd-acts">
      <button class="btn small pri" data-do="pdc">${t("Request PDC")}</button>
      <button class="btn small" data-do="req" data-k="vatatis" data-a="${dep}">ATIS ${dep}</button><button class="btn small" data-do="req" data-k="metar" data-a="${dep}">METAR ${dep}</button>
      <button class="btn small" data-do="req" data-k="vatatis" data-a="${arr}">ATIS ${arr}</button><button class="btn small" data-do="req" data-k="metar" data-a="${arr}">METAR ${arr}</button><button class="btn small" data-do="req" data-k="taf" data-a="${arr}">TAF ${arr}</button>
      <button class="btn small" data-do="telex">${t("Telex")}</button>
      ${A.station ? `<button class="btn small" data-do="logoff">${t("CPDLC log off")} ${esc(A.station)}</button>` : `<button class="btn small" data-do="logon">${t("CPDLC log on")}</button>`}
      <button class="btn small" data-do="refresh">${t("Check now")}</button></div>
    <div class="rd-inbox">${msgs || `<div class="dim" style="padding:8px 0">${t("No messages for {cs} yet. The pad checks every minute.", { cs: o.callsign })}</div>`}</div>
    <p class="dim" style="font-size:12px;margin:8px 0 0">${t("Messages are only read here (peek), so an ACARS in the aircraft still gets them.")}${A.at ? " · " + t("checked {t}", { t: hhmmz(A.at) }) : ""}</p></div>`;
}

export function radioView(o, d, now) { markRead(); return slotCard(o, now) + freqCard(now) + acarsCard(o, now); }

// one line for the overview: the frequency now and next, and the newest ACARS message
export function radioStrip(o, now) {
  if (!atcReady()) loadAtcData().then(emit);
  const p = freqPlan(), u = unread(now)[0];
  if (!p?.cur) return "";
  const f = (st) => `<span class="num">${esc(st.mhz)}</span>${st.ctaf ? ` <span class="ctaf">CTAF <span class="num">${esc(st.ctaf)}</span></span>` : ""}`;
  const dest = S.ofp?.dest?.icao || "";
  return `<button class="rd-strip halves${p.soon ? " soon" : ""}" data-do="tab" data-tab="radio">
    <span class="half"><span class="lbl">${t("Now")} · ${esc(p.cur.role)}</span><b>${esc(p.cur.st.name)}</b> ${f(p.cur.st)}</span>
    ${p.next ? `<span class="half next"><span class="lbl">${p.soon ? t("Change soon") : t("Next frequency change")} · ${esc(p.next.role)}</span><b>${esc(p.next.st.name)}</b> ${f(p.next.st)} <span class="dim">${esc(kmTxt(p.next) || p.next.when || "")}</span></span>`
      : `<span class="half next"><span class="lbl">${t("Next frequency change")}</span><b>${t("No change until {apt}", { apt: dest })}</b> <span class="dim">${t("stay on this frequency")}</span></span>`}
    ${u ? `<span class="rd-new"><span class="lbl">ACARS · ${esc(u.from)}</span>${esc(u.text.slice(0, 80))}</span>` : ""}</button>`;
}

// clicks of the tab; true when handled
export async function radioClick(e, C) {
  const b = e.target.closest("[data-do]"); if (!b) return false;
  const o = S.ofp, k = b.dataset.do;
  const run = async (fn) => { b.disabled = true; try { await fn(); } catch (x) { C.toast({ lv: "attn", ic: "warn", title: t("Hoppie not reachable."), text: x.message === "logon" ? t("Hoppie logon code not valid.") : x.message }); } b.disabled = false; emit(); };
  if (k === "refresh") { await run(pollAcars); return true; }
  if (k === "req") { await run(() => inforeq(b.dataset.k, b.dataset.a)); return true; }
  if (k === "ans") { const m = A.msgs.find((x) => String(x.id) === b.dataset.id); if (m) await run(() => cpdlcAnswer(m, b.dataset.w)); return true; }
  if (k === "logoff") { await run(cpdlcLogoff); return true; }
  if (k === "logon") { compose(C, { title: t("CPDLC log on"), to: A.station || "", toLbl: t("ATC station (logon code)"), hint: t("The logon code of the ATC station, e.g. EDYY or LYBA, as the controller gives it in the ATIS or controller info."), noText: true, send: (to) => cpdlcLogon(to) }); return true; }
  if (k === "telex") { compose(C, { title: t("Telex"), to: "", toLbl: t("To (callsign or station)"), text: "", send: (to, tx) => telex(to, tx) }); return true; }
  if (k === "pdc" && o) {
    const st = departureStand()?.ref, at = atisOf(o.dep.icao)?.depLetter;
    compose(C, { title: t("Request PDC"), to: o.dep.icao, toLbl: t("To (callsign or station)"), text: pdcText(o, st, at), hint: t("The pre-departure clearance comes back as a message. Some airports use another station than the ICAO code – see the controller info."), send: (to, tx) => telex(to, tx) });
    return true;
  }
  return false;
}
function compose(C, x) {
  sheet(`<h2>${esc(x.title)}</h2>${x.hint ? `<p class="dim" style="font-size:13px">${esc(x.hint)}</p>` : ""}
    <label><div class="lbl">${esc(x.toLbl)}</div><input name="to" value="${esc(x.to)}" autocapitalize="characters" style="width:100%"></label>
    ${x.noText ? "" : `<label><div class="lbl" style="margin-top:10px">${t("Message")}</div><textarea name="tx" rows="4" style="width:100%;text-transform:uppercase">${esc(x.text || "")}</textarea></label>`}
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px"><button class="btn" data-close>${t("Cancel")}</button><button class="btn pri" data-send>${t("Send")}</button></div>`,
  async (e, close, el) => {
    const s = e.target.closest("[data-send]"); if (!s) return;
    const to = el.querySelector("[name=to]").value.trim(), tx = el.querySelector("[name=tx]")?.value.trim() || "";
    if (!to || (!x.noText && !tx)) return;
    s.disabled = true;
    try { await x.send(to, tx); close(); C.toast({ lv: "ok", ic: "plane", title: t("Sent"), text: to.toUpperCase() }); }
    catch (er) { s.disabled = false; C.toast({ lv: "attn", ic: "warn", title: t("Not sent"), text: er.message === "logon" ? t("Hoppie logon code not valid.") : t("Hoppie not reachable.") }); }
  });
}
