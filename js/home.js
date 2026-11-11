// Home screen: widgets on the left, apps and the dock.
import { S, settings, derived, wxOf } from "./data.js";
import { career, careerHtml } from "./career.js";
import { actions } from "./actions.js";
import { t, LOCALE, loc } from "./i18n.js";
import { esc, store, hhmmz } from "./util.js";
import { sheet } from "./sheet.js";
import { APP_ICONS, I } from "./icons.js";
import { flightWidget, timesWidget, todayWidget, liveHtml } from "./lock.js";
import { cityOf } from "./tz.js";

export const HOME_APPS = [
  { id: "fly", name: "ASL Fly", icon: "fly" }, { id: "ops", name: "ASL Ops", icon: "ops" }, { id: "log", name: "Logbook", icon: "log" },
  { id: "cabin", name: "Cabin", icon: "cabin" }, { id: "vdgs", name: "VDGS", icon: "vdgs" }, { id: "simbrief", name: "SimBrief", icon: "simbrief" },
  { id: "downloads", name: "Downloads", icon: "downloads" }, { id: "settings", name: "Settings", icon: "settings" },
];
const DOCK = ["fly", "ops", "log", "settings"];

function greeting(now) {
  const h = new Date(now).getHours();
  return h < 5 ? t("Good night") : h < 12 ? t("Good morning") : h < 18 ? t("Good afternoon") : t("Good evening");
}
const icon = (a, badge) => `<button class="app-ic" data-app="${a.id}"><div class="ico">${badge ? `<span class="badge">${badge}</span>` : ""}${APP_ICONS[a.icon]}</div><span>${esc(t(a.name))}</span></button>`;

export function renderHome(el, now = Date.now()) {
  const o = S.ofp, d = derived(now);
  const urgent = actions(now).filter((a) => a.lv === "red" || a.lv === "attn");
  const badges = { ops: urgent.filter((a) => a.app === "ops").length, fly: urgent.filter((a) => a.app === "fly").length };
  const sub = o ? t("{f} to {city} today", { f: o.iataNo || o.callsign, city: cityOf(o.dest) || o.dest?.icao }) : t("No flight loaded");
  el.innerHTML = `
    <div class="hm-widgets">
      <div><p class="hm-greet">${esc(greeting(now))}, ${t("Captain")}</p><div class="hm-sub">${esc(sub)}</div>${show("wx") ? wxHere(o, d) : ""}${show("career") ? careerHtml(career()) : ""}</div>
      ${flightWidget(o, d, now)}${timesWidget(o, now)}${todayWidget(now)}
    </div>
    <div class="hm-main">
      <div class="hm-apps">${HOME_APPS.map((a) => icon(a, badges[a.id])).join("")}</div>
      <div class="hm-board">${show("notices") ? noticesCard(now, d) : ""}${show("events") ? eventsCard(o, now) : ""}</div>
    </div>
    <div class="dock">${DOCK.map((id) => icon(HOME_APPS.find((a) => a.id === id), badges[id])).join("")}</div>`;
}

// cards the pilot can hide (Settings → Home screen)
export const HOME_CARDS = [["wx", "Weather here"], ["career", "Career"], ["notices", "Notices"], ["events", "Network events"]];
const show = (k) => !(settings.homeHide || []).includes(k);

// ---------- weather where you are: departure until take-off, then destination ----------
function wxHere(o, d) {
  if (!o) return "";
  const apt = d && S.st?.takeoff ? o.dest : o.dep, w = wxOf(apt.icao);
  if (!w) return "";
  const wind = w.wspd != null ? `${w.vrb ? "VRB" : String(w.wdir ?? 0).padStart(3, "0")}/${w.wspd}${w.gust ? "G" + w.gust : ""} kt` : "";
  const bits = [w.temp != null ? `${w.temp}°` : "", wind, w.qnh ? `Q${w.qnh}` : ""].filter(Boolean);
  return `<div class="hm-wx"><span class="i">${I.wx}</span><b>${esc(cityOf(apt) || apt.icao)}</b><span>${bits.map(esc).join(" · ")}</span>${w.cat ? `<span class="cat ${w.cat}">${w.cat}</span>` : ""}</div>`;
}

// ---------- notices and tips of the airline (va/notices.json) ----------
const day = (ts) => new Date(ts).toISOString().slice(0, 10);
function activeNotices(now) {
  const today = day(now);
  return (S.notices?.notices || []).filter((n) => n.id && (!n.date || n.date <= today) && (!n.until || n.until >= today))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}
// a tip for the phase of the flight ("crew info"), else the tip of the day
function tipFor(now, d) {
  const tips = S.notices?.tips || [], ph = d?.phase;
  const forPhase = ph ? tips.filter((x) => (x.phase || []).includes(ph)) : [];
  if (forPhase.length) return [t("Crew info"), loc(forPhase[Math.floor(now / 6e5) % forPhase.length])];
  const daily = tips.filter((x) => !x.phase);
  return daily.length ? [t("Tip of the day"), loc(daily[Math.floor(now / 864e5) % daily.length])] : ["", ""];
}
function noticesCard(now, d) {
  const list = activeNotices(now).slice(0, 3), read = store.get("asl.noticesRead", []);
  const [tipLbl, tip] = tipFor(now, d);
  const fmt = new Intl.DateTimeFormat(LOCALE(), { day: "numeric", month: "short", timeZone: "UTC" });
  return `<div class="hb-card"><div class="lbl">Air Serbia Virtual · ${t("Notices")}</div>
    ${list.length ? list.map((n) => `<button class="hb-row" data-notice="${esc(n.id)}">${read.includes(n.id) ? "" : `<i class="dot"></i>`}<b>${esc(loc(n.title))}</b><span class="dim">${n.date ? esc(fmt.format(new Date(n.date))) : ""}</span></button>`).join("")
      : `<div class="dim hb-empty">${t("No notices right now.")}</div>`}
    ${tip ? `<div class="hb-tip"><div class="lbl">${esc(tipLbl)}</div>${esc(tip)}</div>` : ""}</div>`;
}
export function openNotice(id) {
  const n = activeNotices(Date.now()).find((x) => x.id === id) || (S.notices?.notices || []).find((x) => x.id === id);
  if (!n) return;
  store.set("asl.noticesRead", [...new Set([...store.get("asl.noticesRead", []), id])].slice(-50));
  sheet(`<div class="lbl">${t("Notices")}${n.date ? " · " + esc(n.date) : ""}</div><h2 style="margin:4px 0 10px">${esc(loc(n.title))}</h2>
    <p style="white-space:pre-line;font-size:16px;line-height:1.5;margin:0 0 16px">${esc(loc(n.text))}</p><button class="btn pri" data-close>${t("Close")}</button>`);
}

// ---------- coming VATSIM events: ours first (Serbia, the airports of this flight), then the soonest ----------
function eventsCard(o, now) {
  const mine = new Set([o?.dep?.icao, o?.dest?.icao].filter(Boolean));
  const score = (e) => (e.airports || []).some((a) => mine.has(a)) ? 0 : (e.airports || []).some((a) => a.startsWith("LY")) ? 1 : 2;
  const list = (S.vatEvents || []).filter((e) => Date.parse(e.end) > now)
    .sort((a, b) => score(a) - score(b) || Date.parse(a.start) - Date.parse(b.start)).slice(0, 4)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const dd = new Intl.DateTimeFormat(LOCALE(), { day: "2-digit", timeZone: "UTC" }), mm = new Intl.DateTimeFormat(LOCALE(), { month: "short", timeZone: "UTC" });
  const row = (e) => {
    const s = Date.parse(e.start), live = s <= now;
    return `<a class="hb-ev" href="${esc(e.link || "https://my.vatsim.net/events")}" target="_blank" rel="noopener"><div class="d"><b>${dd.format(s)}</b><span>${esc(mm.format(s))}</span></div>
      <div class="n"><b>${esc(e.name)}</b><span class="dim">${live ? `<span class="live-dot"></span>${t("Now on")} · ` : ""}${hhmmz(s).slice(0, 5)}–${hhmmz(Date.parse(e.end))}${(e.airports || []).slice(0, 3).map((a) => ` <span class="apt${mine.has(a) ? " mine" : ""}">${esc(a)}</span>`).join("")}</span></div></a>`;
  };
  return `<div class="hb-card"><div class="lbl">VATSIM · ${t("Network events")}</div>
    ${list.length ? list.map(row).join("") : `<div class="dim hb-empty">${t("No events loaded yet.")}</div>`}</div>`;
}
export { liveHtml };
