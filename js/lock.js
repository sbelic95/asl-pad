// Lock screen: clock, flight widgets, notification cards and the live activity of the flight.
import { S, settings, derived, wxOf, logbook } from "./data.js";
import { actions } from "./actions.js";
import { t, dateLong, getLang } from "./i18n.js";
import { esc, hhmmz, localHM, dur } from "./util.js";
import { fmtW } from "./units.js";
import { I } from "./icons.js";
import { tzOf } from "./tz.js";

const LOGO = "https://pics.avs.io/480/160/JU.png"; // Air Serbia logo, loaded at display time (not part of this project)

export function brand() {
  return `<img src="${LOGO}" alt="Air Serbia" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'word',textContent:'AIR SERBIA'}))">`;
}

export function noteHtml(a) {
  const col = a.lv === "red" ? "var(--red)" : a.lv === "attn" ? "var(--warn)" : a.lv === "ok" ? "var(--ok)" : "var(--accent)";
  return `<div class="note ${a.lv === "red" ? "red" : ""}" data-open="${a.app || ""}" data-tab="${a.tab || ""}"><div class="ic" style="background:color-mix(in srgb, ${col} 18%, transparent);color:${col}">${I[a.ic] || I.plane}</div>
    <div><b>${esc(a.title)}</b><span>${esc(a.text || "")}</span></div></div>`;
}

export function flightWidget(o, d, now = Date.now()) {
  if (!o) return `<div class="wdg"><div class="lbl">${t("Flight")}</div><div style="margin-top:6px" class="dim">${t("No flight loaded")}</div></div>`;
  const ph = d?.phase;
  const label = ph === "onblock" ? t("Last flight") : ph && ph !== "preflight" ? t("In flight") : t("Next flight");
  return `<div class="wdg"><div class="lbl">${label}</div>
    <div class="route" style="margin-top:6px">${esc(o.dep?.icao)}<span class="arr">→</span>${esc(o.dest?.icao)}</div>
    <div style="font:700 15px var(--f-num);margin-top:2px">${esc(o.iataNo || o.callsign)} <span class="dim" style="font-weight:500">· ${esc(o.callsign)}</span></div>
    <div class="dim" style="font-size:13px;margin-top:2px">${esc(o.type)}${o.reg ? " · " + esc(o.reg) : ""}${o.pax ? " · " + t("{n} pax", { n: o.pax }) : ""}</div>${countdown(o, now)}</div>`;
}
// before off-block: time to the planned departure (STD)
function countdown(o, now) {
  const std = o.times?.out;
  if (!std || S.st?.offBlock || std - now > 24 * 36e5) return "";
  const late = now > std, ms = Math.abs(std - now), h = Math.floor(ms / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  const txt = (h ? h + " h " : "") + m + " min";
  return `<div class="cd${late ? " late" : ""}"><span>${late ? t("STD passed") : t("Departure in")}</span><b>${late ? "+" : ""}${txt}</b><span class="dim">STD ${hhmmz(std)}</span></div>`;
}

export function timesWidget(o, now) {
  const row = (lbl, time, apt) => {
    const w = apt ? wxOf(apt) : null;
    return `<div class="row"><span class="lbl">${esc(lbl)}</span><span class="v">${time}</span><span>${w?.cat ? `<span class="cat ${w.cat}">${w.cat}</span> ` : ""}<span class="dim num" style="font-size:12px">${w ? (w.wdir != null ? String(w.wdir).padStart(3, "0") : w.vrb ? "VRB" : "") + (w.wspd != null ? "/" + w.wspd : "") + (w.temp != null ? " · " + w.temp + "°" : "") : ""}</span></span></div>`;
  };
  return `<div class="wdg">${row("UTC", hhmmz(now).slice(0, 5), null)}${o ? row(o.dep.icao, localHM(now, tzOf(o.dep)), o.dep.icao) + row(o.dest.icao, localHM(now, tzOf(o.dest)), o.dest.icao) : ""}</div>`;
}

export function todayWidget(now) {
  const day = new Date(now).toISOString().slice(0, 10);
  const today = logbook().filter((e) => new Date(e.date).toISOString().slice(0, 10) === day);
  const legs = today.length + (S.ofp && !S.st?.logged && S.st?.offBlock ? 1 : 0);
  if (!legs) return "";
  return `<div class="wdg" style="display:flex;gap:10px;align-items:center"><div style="width:26px;height:26px;color:var(--accent)">${I.plane}</div>
    <div style="font-size:13.5px"><b>${t(legs === 1 ? "{n} flight today" : "{n} flights today", { n: legs })}</b>${today.length ? `<span class="dim"> · ${today.map((e) => esc(e.flightNo)).slice(0, 3).join(", ")}</span>` : ""}</div></div>`;
}

export function liveHtml(o, d, now) {
  if (!o || !d) return "";
  const st = S.st, pct = d.pct * 100;
  const offTxt = st.takeoff ? t("off {t}", { t: hhmmz(st.takeoff) }) : st.offBlock ? t("out {t}", { t: hhmmz(st.offBlock) }) : t("STD {t}", { t: hhmmz(o.times.out) });
  const etaTxt = st.onBlock ? t("in {t}", { t: hhmmz(st.onBlock) }) : st.landing ? t("on {t}", { t: hhmmz(st.landing) }) : t("ETA {t}", { t: hhmmz(d.est.on) });
  const fob = d.fs.last ? `${t("FOB")} <b>${fmtW(d.fs.last.fob, o, { bare: true })}</b> <span style="color:${d.fs.last.dev < 0 ? "var(--warn)" : "var(--ok)"}">${fmtW(d.fs.last.dev, o, { sign: true, bare: true })}</span>` : "";
  const facts = [
    `<b>${esc(o.iataNo || o.callsign)}</b>`,
    d.next ? `${esc(d.next.ident)} <b>${hhmmz(d.nextEta)}</b>` : `<b>${esc(t(PHASE[d.phase] || d.phase))}</b>`,
    S.pilot && st.takeoff && !st.landing ? `<b>FL${String(Math.round(S.pilot.altitude / 100)).padStart(3, "0")}</b>` : "",
    fob, st.takeoff && !st.landing ? `<b>${Math.round(d.toGo).toLocaleString()}</b> NM` : "",
    settings.demo ? `<span class="warn">DEMO</span>` : S.pilot ? `<span class="ok">VATSIM ✓</span>` : `<span class="dim">VATSIM —</span>`,
  ].filter(Boolean);
  return `<div class="live" data-open="fly"><div class="ends">
    <div class="apt">${esc(o.dep.icao)}<small>${offTxt}</small></div>
    <div class="prog"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div>
    <div class="apt r">${esc(o.dest.icao)}<small>${etaTxt}</small></div></div>
    <div class="facts">${facts.map((x) => `<span>${x}</span>`).join("")}</div></div>`;
}

export const PHASE = { preflight: "At the gate", taxiout: "Taxi out", climb: "Climb", cruise: "Cruise", descent: "Descent", approach: "Approach", taxiin: "Taxi in", onblock: "On block" };

export function renderLock(el, now = Date.now()) {
  const o = S.ofp, d = derived(now);
  const acts = actions(now).slice(0, 4);
  el.innerHTML = `
    <div class="lk-left">${flightWidget(o, d, now)}${timesWidget(o, now)}${todayWidget(now)}</div>
    <div class="lk-clock"><div class="lock-ic">${I.lock}</div><div class="lk-date">${esc(dateLong(now))}</div>
      <div class="lk-time">${new Intl.DateTimeFormat(getLang() === "en" ? "en-GB" : getLang() === "sr" ? "sr-Latn-RS" : "de-DE", { hour: "2-digit", minute: "2-digit" }).format(now)}</div>
      <div class="lk-brand">${brand()}</div></div>
    <div class="lk-right">${acts.map(noteHtml).join("")}</div>
    ${liveHtml(o, d, now)}
    <div class="lk-hint">${t("Swipe up or tap to unlock")}</div>`;
}
