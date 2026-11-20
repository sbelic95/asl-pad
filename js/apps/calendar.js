// Calendar: one month at a glance with the pilot's flights (vAMSYS bookings and the loaded OFP), VATSIM events at
// Air Serbia airports and the pilot's own entries with a reminder. Everything in UTC like an airline roster.
import { S } from "../data.js";
import { t, LOCALE } from "../i18n.js";
import { esc, store, hhmmz, p2 } from "../util.js";
import { V } from "../vamsys.js";
import { notify } from "../notify.js";
import { sheet } from "../sheet.js";

export const name = "Calendar";
export const tabs = [["month", "Month"], ["list", "Upcoming"]];
let C = null, view = null, day = null;
const own = () => store.get("asl.cal", []);
const dkey = (ts) => new Date(ts).toISOString().slice(0, 10);

// reminders of own entries (minutes before), checked every 30 s
setInterval(() => {
  const list = own(); let ch = false;
  for (const e of list) if (e.rem != null && !e.done && Date.now() >= e.at - e.rem * 60e3) { e.done = true; ch = true; notify({ app: "calendar", ic: "calendar", lv: "attn", title: e.title, text: hhmmz(e.at) + (e.rem ? " · " + t("in {n} min", { n: e.rem }) : "") }); }
  if (ch) store.set("asl.cal", list);
}, 30e3);

export function entries() {
  const net = new Set(Object.keys(S.routes?.airports || {})), out = [];
  const o = S.ofp;
  if (o?.times?.out) out.push({ k: "flight", at: o.times.out, end: o.times.in, title: `${o.iataNo || o.callsign} ${o.dep.icao}–${o.dest.icao}`, sub: "OFP" + (o.type ? " · " + o.type : "") });
  for (const b of V.data?.bookings || []) if (b.at && !(o && b.dep === o.dep.icao && b.arr === o.dest.icao && Math.abs(b.at - o.times.out) < 6 * 36e5))
    out.push({ k: "flight", at: b.at, title: `${b.callsign || b.number || "ASL"} ${b.dep}–${b.arr}`, sub: "vAMSYS" + (b.type ? " · " + b.type : "") });
  for (const e of S.vatEvents || []) { const ap = (e.airports || []).filter((a) => net.has(a)); if (ap.length) out.push({ k: "event", at: Date.parse(e.start), end: Date.parse(e.end), title: e.name, sub: "VATSIM · " + ap.slice(0, 4).join(" "), link: e.link }); }
  own().forEach((e, i) => out.push({ k: "own", at: e.at, title: e.title, sub: e.note || "", i }));
  return out.filter((e) => Number.isFinite(e.at)).sort((a, b) => a.at - b.at);
}
const row = (e) => `<div class="cal-e ${e.k}"><span class="num">${hhmmz(e.at).slice(0, 5)}</span><div><b>${esc(e.title)}</b><small>${esc(e.sub || "")}</small></div>${e.k === "own" ? `<button class="btn small" data-cal="del" data-i="${e.i}">×</button>` : e.link ? `<a class="btn small" href="${esc(e.link)}" target="_blank" rel="noopener">↗</a>` : ""}</div>`;
export function render(body, ctx) {
  C = ctx;
  if (!body._cal) { body._cal = true; body.addEventListener("click", onClick); }
  const now = Date.now(), all = entries();
  if (!view) { const d = new Date(now); view = [d.getUTCFullYear(), d.getUTCMonth()]; }
  if (ctx.tab === "list") {
    const up = all.filter((e) => (e.end || e.at) > now - 36e5).slice(0, 40);
    let last = "";
    body.innerHTML = `<div class="cal-top"><span class="lbl">${t("Upcoming")} · UTC</span><button class="btn pri small" data-cal="add">${t("New entry")}</button></div>` + (up.map((e) => { const k = dkey(e.at), h = k !== last ? `<div class="cal-day">${esc(new Intl.DateTimeFormat(LOCALE(), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(e.at))}</div>` : ""; last = k; return h + row(e); }).join("") || `<div class="empty">${t("Nothing planned.")}</div>`);
    return;
  }
  const [y, m] = view, first = Date.UTC(y, m, 1), lead = (new Date(first).getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const by = {}; for (const e of all) (by[dkey(e.at)] ||= []).push(e);
  const wd = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(LOCALE(), { weekday: "short", timeZone: "UTC" }).format(Date.UTC(2024, 0, 1 + i)));
  const today = dkey(now); day ||= today;
  let cells = ""; for (let i = 0; i < lead; i++) cells += `<span></span>`;
  for (let d = 1; d <= days; d++) { const k = `${y}-${p2(m + 1)}-${p2(d)}`, es = by[k] || [];
    cells += `<button class="cal-d${k === today ? " today" : ""}${k === day ? " sel" : ""}" data-cal="day" data-d="${k}"><b>${d}</b><span>${es.slice(0, 3).map((e) => `<i class="${e.k}"></i>`).join("")}</span></button>`; }
  body.innerHTML = `<div class="cal"><div class="cal-m"><div class="cal-top"><button class="btn small" data-cal="prev">‹</button><h2>${esc(new Intl.DateTimeFormat(LOCALE(), { month: "long", year: "numeric", timeZone: "UTC" }).format(first))}</h2><button class="btn small" data-cal="next">›</button><button class="btn small" data-cal="today">${t("Today")}</button></div>
    <div class="cal-g">${wd.map((w) => `<span class="wd">${esc(w)}</span>`).join("")}${cells}</div>
    <div class="cal-leg"><span><i class="flight"></i>${t("Flights")}</span><span><i class="event"></i>${t("VATSIM events")}</span><span><i class="own"></i>${t("My entries")}</span></div></div>
    <div class="cal-side"><div class="cal-top"><span class="lbl">${esc(new Intl.DateTimeFormat(LOCALE(), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(Date.parse(day)))}</span><button class="btn pri small" data-cal="add">${t("New entry")}</button></div>
      ${(by[day] || []).map(row).join("") || `<div class="dim">${t("Nothing planned.")}</div>`}</div></div>`;
}
function onClick(e) {
  const b = e.target.closest("[data-cal]"); if (!b) return; const k = b.dataset.cal;
  if (k === "prev" || k === "next") { const d = new Date(Date.UTC(view[0], view[1] + (k === "next" ? 1 : -1), 1)); view = [d.getUTCFullYear(), d.getUTCMonth()]; }
  if (k === "today") { view = null; day = null; }
  if (k === "day") day = b.dataset.d;
  if (k === "del") { const l = own(); l.splice(+b.dataset.i, 1); store.set("asl.cal", l); }
  if (k === "add") { sheet(`<h2>${t("New entry")}</h2><label><div class="lbl">${t("Title")}</div><input name="ti" style="width:100%" placeholder="${t("e.g. group flight")}"></label>
      <div style="display:flex;gap:10px;margin-top:10px"><label style="flex:1"><div class="lbl">${t("Date")}</div><input name="d" type="date" value="${day || dkey(Date.now())}" style="width:100%"></label><label style="flex:1"><div class="lbl">${t("Time")} (UTC)</div><input name="hm" type="time" value="18:00" style="width:100%"></label></div>
      <label><div class="lbl" style="margin-top:10px">${t("Reminder")}</div><select name="rem" style="width:100%"><option value="">${t("None")}</option>${[0, 15, 30, 60, 120].map((n) => `<option value="${n}"${n === 30 ? " selected" : ""}>${n ? t("{n} min before", { n }) : t("At the time")}</option>`).join("")}</select></label>
      <label><div class="lbl" style="margin-top:10px">${t("Note")}</div><input name="no" style="width:100%"></label>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px"><button class="btn" data-close>${t("Cancel")}</button><button class="btn pri" data-save>${t("Save")}</button></div>`,
    (ev, close, el) => { if (!ev.target.closest("[data-save]")) return; const g = (n) => el.querySelector(`[name=${n}]`).value.trim(); const at = Date.parse(g("d") + "T" + (g("hm") || "00:00") + ":00Z");
      if (!g("ti") || !Number.isFinite(at)) return; const r = g("rem"); store.set("asl.cal", [...own(), { title: g("ti"), at, note: g("no"), rem: r === "" ? null : +r }]); close(); C.changed("view"); }); return; }
  C.changed("view");
}
export function summary() { const n = entries().find((e) => e.at > Date.now()); return [t("Calendar"), n ? `${hhmmz(n.at)} ${n.title}` : t("Nothing planned.")]; }
// home widget: the next three entries
export function calendarWidget() {
  const up = entries().filter((e) => (e.end || e.at) > Date.now()).slice(0, 3);
  return `<div class="wg wg-cal" data-app="calendar"><div class="lbl">${t("Calendar")}</div>${up.map((e) => `<div class="${e.k}"><span class="num">${esc(new Intl.DateTimeFormat(LOCALE(), { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(e.at))} ${hhmmz(e.at).slice(0, 5)}</span><b>${esc(e.title)}</b></div>`).join("") || `<div class="dim">${t("Nothing planned.")}</div>`}</div>`;
}
