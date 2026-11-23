// ASL Pad shell: lock screen, home screen, apps, app switcher (double-tap the home bar), status bar.
import { bookingClick } from "./booking.js";
import { $, esc, hhmmz, store } from "./util.js";
import { S, settings, saveSettings, setTestDemo, onChange, wxOf, startPolling, refreshAll, restart, emit } from "./data.js";
import { t, setLang, getLang, dateLong } from "./i18n.js";
import { APP_ICONS, I } from "./icons.js";
import { renderLock, noteHtml } from "./lock.js";
import { renderHome, HOME_APPS, openNotice, homePage, installed } from "./home.js";
import { loadAirports, cityOf, tzOf } from "./tz.js";
import { applyWall, autoSky } from "./wall.js";
import { career, careerHtml, promoted } from "./career.js";
import { sheet } from "./sheet.js";
import { latest, relDate, groupsHtml } from "./whatsnew.js";
import * as Fly from "./apps/fly.js";
import * as Ops from "./apps/ops.js";
import * as Log from "./apps/log.js";
import * as Settings from "./apps/settings.js";
import * as Downloads from "./apps/downloads.js";
import * as Airport from "./apps/airport.js";
import * as Cabin from "./apps/cabin.js";
import * as Weather from "./apps/weather.js";
import * as Clock from "./apps/clock.js";
import * as Calc from "./apps/calc.js";
import * as Calendar from "./apps/calendar.js";
import * as Kneeboard from "./apps/kneeboard.js";
import * as Manuals from "./apps/manuals.js";
import * as Store from "./apps/store.js";
import { Vatsim, Ivao } from "./apps/radar.js";
import * as Mail from "./apps/mail.js";
import * as Messages from "./apps/messages.js";
import * as Academy from "./apps/academy.js";
import * as Reference from "./apps/reference.js";
import * as Photos from "./apps/photos.js";
import * as Browser from "./apps/browser.js";
import * as Scenery from "./apps/scenery.js";
import * as News from "./apps/news.js";
import * as Turnaround from "./apps/turnaround.js";
import * as Fenix from "./apps/fenix.js";
import * as Checklist from "./apps/checklist.js";
import * as Landing from "./apps/landing.js";
import { startSim, onSim, SIM } from "./sim.js";
import { notify, N } from "./notify.js";
import { startSync } from "./sync.js";
import { initDevice, faceId, applyBright, hide as hideDc, isOpen as dcOpen } from "./device.js";
import { initFrame, applyFrame } from "./frame.js";
import { startAlerts } from "./alerts.js";
import { applyWake } from "./wake.js";
import "./sound.js";

const APPS = {
  fly: Fly, ops: Ops, log: Log, settings: Settings, downloads: Downloads, apt: Airport, cabin: Cabin,
  weather: Weather, clock: Clock, calc: Calc, calendar: Calendar, kneeboard: Kneeboard, manuals: Manuals, store: Store, radar: Vatsim, ivao: Ivao,
  mail: Mail, messages: Messages, academy: Academy, reference: Reference, photos: Photos, browser: Browser, scenery: Scenery, news: News, turnaround: Turnaround, fenix: Fenix, checklist: Checklist, landing: Landing,
};
const NAMES = Object.fromEntries(HOME_APPS.map((a) => [a.id, a]));

const ui = { view: "lock", app: null, recent: store.get("asl.recent", []).filter((id) => APPS[id]), tab: {}, lastInput: Date.now(), switcher: false }; // removed apps (vdgs) drop out

// ---------- URL options: ?app=fly&tab=map, ?unlock, ?lang=de; ?demo / ?demo=ground only on localhost (test) ----------
const q = new URLSearchParams(location.search);
if (q.has("demo")) setTestDemo(q.get("demo") === "ground" ? "ground" : "air");
if (q.get("lang")) setLang(q.get("lang"));
setLang(getLang());

// ---------- theme ----------
export function applyTheme() { document.documentElement.dataset.theme = settings.theme === "light" ? "light" : "dark"; applyWall(settings, skyNow()); }
// the sky for the "auto" wallpaper: local hour and weather at the airport where you are
export function skyNow(now = Date.now()) {
  const o = S.ofp, apt = o ? (S.st?.takeoff ? o.dest : o.dep) : null;
  let hour = new Date(now).getHours();
  if (apt) { try { hour = +new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tzOf(apt) || undefined }).format(now) % 24; } catch {} }
  return autoSky(hour, apt ? wxOf(apt.icao) : null);
}
applyTheme();

// ---------- status bar ----------
// network and battery like on a real tablet; the battery only where the browser tells it (Chrome, Edge), never made up
let BAT = null;
navigator.getBattery?.().then((b) => { const u = () => { BAT = { l: b.level, c: b.charging }; renderStatus(); }; u(); b.addEventListener("levelchange", u); b.addEventListener("chargingchange", u); }).catch(() => {});
addEventListener("online", () => renderStatus()); addEventListener("offline", () => renderStatus());
const simDot = () => (SIM.base ? `<span title="${SIM.ok ? t("Simulator connected") : t("Simulator not connected")}"><span class="dot ${SIM.ok ? "on" : SIM.d ? "" : "off"}"></span>SIM</span>` : "");
const sysIcons = () => simDot() + `<span class="sysi" title="${navigator.onLine ? "" : t("Offline")}">${navigator.onLine ? I.wifi : I.wifiOff}</span>`
  + (BAT ? `<span class="bat${BAT.c ? " chg" : BAT.l <= 0.2 ? " low" : ""}" title="${BAT.c ? t("Charging") : ""}"><span class="num">${Math.round(BAT.l * 100)} %</span><i><b style="width:calc(${Math.max(4, BAT.l * 100)}% - 3px)"></b></i></span>` : "");
function renderStatus(now = Date.now()) {
  const vat = settings.demo ? `<span class="dot on"></span>DEMO` : S.feedOk == null ? "" : `<span class="dot ${S.pilot ? "on" : S.feedOk ? "" : "off"}"></span>VATSIM${S.pilot ? " · " + esc(S.pilot.callsign) : ""}`;
  $("status").innerHTML = ui.view === "lock" ? `<span class="sp"></span><span>${vat}</span>${sysIcons()}`
    : `<span class="num">${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(now)}</span><span class="dim">${esc(dateLong(now))}</span><span class="sp"></span><span>${vat}</span><span class="num">${hhmmz(now)}</span>${sysIcons()}`;
}

// ---------- app frames ----------
function frameOf(id) {
  let el = $("app-" + id);
  if (el) return el;
  const A = APPS[id], meta = NAMES[id];
  const [first, ...rest] = (meta?.name || A.name).split(" ");
  el = document.createElement("div");
  el.className = "app"; el.id = "app-" + id;
  el.innerHTML = `<div class="app-head"><button class="app-name" aria-label="${t("Home")}"><span class="back">${I.back}</span><span class="mini">${APP_ICONS[meta?.icon || id] || ""}</span>${rest.length ? `${esc(first)} <em>${esc(rest.join(" "))}</em>` : esc(t(first))}</button>
    <div class="tabs">${(A.tabs || []).map(([k, l]) => `<button data-tab="${k}">${esc(t(l))}</button>`).join("")}</div>
    <div class="head-r"><span class="zclock num"></span><button class="rbtn" data-act="theme" title="${t("Light / dark")}">${I.sun}</button><button class="rbtn" data-act="refresh" title="${t("Refresh")}">${I.refresh}</button></div></div>
    <div class="app-body"></div>`;
  if (!A.tabs?.length) el.querySelector(".tabs").classList.add("none");
  if (A.frame) el.querySelector(".app-body").style.padding = "0";
  el.querySelector(".tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { ui.tab[id] = b.dataset.tab; renderApp(id); } });
  el.querySelector(".app-name").addEventListener("click", () => goHome()); // the app's own logo leads back home
  el.querySelector(".head-r").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "theme") { saveSettings({ theme: settings.theme === "light" ? "dark" : "light" }); applyTheme(); renderAll(); }
    if (b.dataset.act === "refresh") { b.classList.add("spin"); await refreshAll(); b.classList.remove("spin"); }
  });
  $("apps").appendChild(el);
  return el;
}
function renderApp(id, now = Date.now()) {
  const A = APPS[id], el = frameOf(id);
  const tab = ui.tab[id] || A.tabs?.[0]?.[0];
  el.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  el.querySelector(".zclock").innerHTML = hhmmz(now).slice(0, 5) + "<small> z</small>";
  try { A.render(el.querySelector(".app-body"), ctx(id, tab, now)); } catch (e) { console.error(e); el.querySelector(".app-body").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
const ctx = (id, tab, now) => ({ tab, now, open: openApp, toast, ask, changed: settingsChanged, setTab: (k) => { ui.tab[id] = k; renderApp(id); } });

// ---------- navigation ----------
export function openApp(id, tab) {
  if (id === "simbrief") { window.open(S.ofp?.pdf || "https://dispatch.simbrief.com/home", "_blank", "noopener"); return; }
  if (!APPS[id]) return;
  if (ui.app !== id || ui.view !== "app") { faceId(id, () => showApp(id, tab)); return; }
  showApp(id, tab);
}
function showApp(id, tab) {
  if (tab) ui.tab[id] = tab;
  if (ui.view === "lock") $("lock").classList.add("gone");
  hideSwitcher();
  document.querySelectorAll(".app.open").forEach((a) => a.id !== "app-" + id && a.classList.remove("open"));
  renderApp(id);
  requestAnimationFrame(() => frameOf(id).classList.add("open"));
  $("home").classList.add("zoom");
  ui.view = "app"; ui.app = id;
  ui.recent = [id, ...ui.recent.filter((x) => x !== id)].slice(0, 8); store.set("asl.recent", ui.recent);
  APPS[id].onShow?.();
  renderStatus();
}
export function goHome() {
  hideSwitcher();
  document.querySelectorAll(".app.open").forEach((a) => a.classList.remove("open"));
  $("home").classList.remove("zoom"); $("lock").classList.add("gone");
  ui.view = "home"; ui.app = null;
  renderHome($("home")); renderStatus();
}
function lockPad() { hideSwitcher(); hideDc(true); ui.view = "lock"; renderLock($("lock")); $("lock").classList.remove("gone"); renderStatus(); }
function unlock() { reallyUnlock(); } // no PIN: a swipe opens the pad
function reallyUnlock() { $("lock").classList.add("gone"); if (ui.app) { ui.view = "app"; renderApp(ui.app); } else goHome(); renderStatus(); whatsNewOnce(); }

// ---------- a new rank: a letter, once ----------
function checkPromotion() {
  if (ui.view === "lock") return; // the letter waits until the pad is unlocked
  const c = career();
  if (!promoted(c)) return;
  sheet(`<div class="wn-top"><div><div class="lbl">Air Serbia Virtual · ${t("Career")}</div><h2>${t("Congratulations!")}</h2></div><button class="btn pri" data-close>${t("Thank you")}</button></div>
    <div style="padding:20px 24px 24px"><p style="font-size:17px;margin:0 0 14px">${t("With your flights in the logbook you are now {rank}.", { rank: "<b>" + esc(c.rank) + "</b>" })}</p>${careerHtml(c, true)}</div>`).el.classList.add("wn");
}

// ---------- what's new: once after every update, and from Settings ----------
export function showWhatsNew() {
  const r = latest();
  store.set("asl.seen", r.v);
  sheet(`<div class="wn-top"><div><div class="lbl">ASL Pad ${esc(r.v)} · ${esc(relDate(r))}</div><h2>${t("What's new")}</h2></div>
    <button class="btn pri" data-close>${t("Let's fly")}</button></div><div class="wn-grid">${groupsHtml(r)}</div>`).el.classList.add("wn");
}
function whatsNewOnce() {
  if (navigator.webdriver && !q.has("whatsnew")) return; // automated tests click through the pad
  if (store.get("asl.seen") !== latest().v) setTimeout(showWhatsNew, 450);
}

// ---------- app switcher ----------
// iPad-style multitasking: a live miniature of every recent app (the web apps in frames get a summary card)
function showSwitcher() {
  const sw = $("switcher"), pad = $("pad"), ar = pad.clientWidth / pad.clientHeight;
  const ids = ui.recent.filter((id) => APPS[id]);
  sw.style.setProperty("--ar", ar.toFixed(3));
  sw.innerHTML = ids.map((id) => {
    const meta = NAMES[id], live = !APPS[id].frame;
    const [a, b] = live ? ["", ""] : APPS[id].summary?.() || [t(meta.name), ""];
    return `<div class="sw-card" data-id="${id}"><div class="sw-title"><span class="mini">${APP_ICONS[meta.icon]}</span>${esc(t(meta.name))}</div>
      <div class="sw-shot ${live ? "mini" : ""}" data-open="${id}">${live ? "" : `<div class="big">${esc(a)}</div>${String(b).split("\n").map((l) => `<div class="ln">${esc(l)}</div>`).join("")}`}</div>
      <button class="sw-x" data-close="${id}" aria-label="${t("Close")}">×</button></div>`;
  }).join("") || `<div class="sw-empty">${t("No recent apps")}</div>`;
  sw.classList.remove("gone"); ui.switcher = true;
  for (const id of ids) {
    if (APPS[id].frame) continue;
    const shot = sw.querySelector(`.sw-card[data-id="${id}"] .sw-shot`);
    if (!$("app-" + id)) renderApp(id);
    const clone = $("app-" + id).cloneNode(true);
    clone.removeAttribute("id"); clone.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    clone.classList.add("open");
    const mini = document.createElement("div");
    mini.className = "sw-mini"; mini.style.width = pad.clientWidth + "px"; mini.style.height = pad.clientHeight + "px";
    mini.style.transform = `scale(${shot.clientWidth / pad.clientWidth})`;
    mini.appendChild(clone); shot.appendChild(mini);
    // keep the scroll position of the app in the miniature
    const b0 = $("app-" + id).querySelector(".app-body"), b1 = clone.querySelector(".app-body");
    if (b0 && b1) b1.scrollTop = b0.scrollTop;
  }
}
function hideSwitcher() { $("switcher").classList.add("gone"); ui.switcher = false; }
$("switcher").addEventListener("click", (e) => {
  const x = e.target.closest("[data-close]"), o = e.target.closest("[data-open]");
  if (x) {
    const id = x.dataset.close, card = x.closest(".sw-card");
    card.classList.add("closing");
    setTimeout(() => { ui.recent = ui.recent.filter((r) => r !== id); store.set("asl.recent", ui.recent); $("app-" + id)?.remove(); if (ui.app === id) ui.app = null; showSwitcher(); }, 230);
  } else if (o) openApp(o.dataset.open);
  else { hideSwitcher(); if (ui.view === "app" && ui.app) openApp(ui.app); else goHome(); }
});
// swipe a card up to close it
let swY = null;
$("switcher").addEventListener("pointerdown", (e) => { const c = e.target.closest(".sw-card"); swY = c ? [e.clientY, c] : null; });
$("switcher").addEventListener("pointerup", (e) => { if (swY && swY[0] - e.clientY > 90) swY[1].querySelector("[data-close]").click(); swY = null; });

// ---------- home bar: tap = home, double tap = switcher ----------
let hbTimer = null;
$("homebar").addEventListener("click", () => {
  if (ui.view === "lock") { unlock(); return; }
  if (hbTimer) { clearTimeout(hbTimer); hbTimer = null; showSwitcher(); return; }
  hbTimer = setTimeout(() => { hbTimer = null; if (ui.switcher) hideSwitcher(); goHome(); }, 280);
});
document.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input,select,textarea") || document.querySelector(".sheet,.ask")) return;
  if (e.key === "Escape") { if (dcOpen()) return; if (ui.switcher) hideSwitcher(); else if (ui.view === "app") goHome(); }
  if (e.key === "Tab" && e.altKey) { e.preventDefault(); showSwitcher(); }
});

// ---------- lock screen gestures ----------
let lockY = null;
$("lock").addEventListener("pointerdown", (e) => { lockY = e.clientY; });
$("lock").addEventListener("pointerup", (e) => {
  const dy = lockY == null ? 0 : e.clientY - lockY; lockY = null;
  const open = e.target.closest("[data-open]");
  if (dy < -60) { unlock(); return; }
  if (open && open.dataset.open) { openApp(open.dataset.open, open.dataset.tab || undefined); return; }
  unlock();
});
$("home").addEventListener("click", (e) => {
  const pg = e.target.closest("[data-page]"); if (pg) { homePage(+pg.dataset.page); renderHome($("home")); return; }
  const a = e.target.closest("[data-app]"); if (a) { openApp(a.dataset.app); return; }
  const n = e.target.closest("[data-notice]"); if (n) { openNotice(n.dataset.notice); renderHome($("home")); return; }
  if (bookingClick(e)) { renderHome($("home")); return; }
  const o = e.target.closest("[data-open]"); if (o) openApp(o.dataset.open, o.dataset.tab || undefined);
});

// swipe the app grid sideways to turn the page
let hmX = null;
$("home").addEventListener("pointerdown", (e) => { hmX = e.target.closest(".hm-pages") ? [e.clientX, e.clientY] : null; });
$("home").addEventListener("pointerup", (e) => { if (!hmX) return; const dx = e.clientX - hmX[0], dy = e.clientY - hmX[1]; hmX = null; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { homePage(dx < 0 ? 1 : -1, true); renderHome($("home")); } });

// ---------- auto-lock, like an iPad ----------
["pointerdown", "keydown", "wheel"].forEach((ev) => document.addEventListener(ev, () => { ui.lastInput = Date.now(); }, { passive: true }));

// ---------- toasts (take-off, landing, logged) and the fuel check prompt ----------
let toastT = null;
export function toast(a) {
  const el = $("toast"); el.innerHTML = noteHtml(a); el.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 7000);
}
export function ask({ title, text, value = "", unit = "" }) {
  return new Promise((res) => {
    const d = document.createElement("div"); d.className = "ask";
    d.innerHTML = `<div class="box"><h3>${esc(title)}</h3><p>${esc(text || "")}</p><input type="text" inputmode="decimal" autocomplete="off" value="${esc(value)}" placeholder="${esc(unit)}">
      <div class="btns"><button class="btn" data-a="0">${t("Cancel")}</button><button class="btn pri" data-a="1">${t("Save")}</button></div></div>`;
    const done = (ok) => { const v = parseFloat(String(d.querySelector("input").value).replace(/\s/g, "").replace(",", ".")); d.remove(); res(ok && isFinite(v) ? v : null); };
    d.addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b) done(b.dataset.a === "1"); else if (e.target === d) done(false); });
    d.querySelector("input").addEventListener("keydown", (e) => { if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); });
    $("pad").appendChild(d); setTimeout(() => d.querySelector("input").focus(), 50);
  });
}
const EVENT_NOTE = {
  offBlock: () => ({ lv: "info", ic: "plane", title: t("Off block"), text: t("{f} is on its way. Have a good flight.", { f: S.ofp?.iataNo || S.ofp?.callsign }) }),
  takeoff: () => ({ lv: "info", ic: "plane", title: t("Airborne {t}", { t: hhmmz(S.st?.takeoff) }), text: t("Remember your fuel checks.") }),
  landing: () => ({ lv: "ok", ic: "plane", title: t("Welcome to {c}", { c: cityOf(S.ofp?.dest) || S.ofp?.dest?.icao }), text: t("Landed {t}", { t: hhmmz(S.st?.landing) }), app: "ops" }),
  onBlock: () => ({ lv: "ok", ic: "check", title: t("Flight logged"), text: t("Your flight is in the logbook."), app: "log" }),
};

// ---------- rendering ----------
let lastRender = 0;
function renderAll() {
  const now = Date.now(); lastRender = now;
  if (settings.wall === "auto") applyWall(settings, skyNow(now));
  checkPromotion();
  renderStatus(now);
  if (ui.view === "lock") renderLock($("lock"), now);
  if (ui.view === "home") renderHome($("home"), now);
  if (ui.view === "app" && ui.app) renderApp(ui.app, now);
  while (S.events.length) { const ev = S.events.shift(); const n = EVENT_NOTE[ev.e]?.(); if (n && Date.now() - ev.t < 60e3) notify(n); }
}
onChange(() => { if (Date.now() - lastRender > 400) renderAll(); else setTimeout(renderAll, 420); });
setInterval(() => {
  const now = Date.now();
  if (settings.lock > 0 && ui.view !== "lock" && now - ui.lastInput > settings.lock * 60e3) lockPad();
  renderStatus(now);
  if (ui.view === "lock") renderLock($("lock"), now);
  else if (ui.view === "app" && ui.app) { const z = $("app-" + ui.app)?.querySelector(".zclock"); if (z) z.innerHTML = hhmmz(now).slice(0, 5) + "<small> z</small>"; APPS[ui.app].tick?.(now); }
  if (now - lastRender > 10e3) renderAll(); // countdowns and clocks inside the apps
}, 1000);

// ---------- start ----------
export function settingsChanged(kind) {
  applyTheme(); applyFrame(); applyWake();
  if (kind === "lang") { // tab labels are built with the frame: build the frames again
    document.querySelectorAll(".app").forEach((a) => a.remove());
    if (ui.view === "app" && ui.app) { renderApp(ui.app); frameOf(ui.app).classList.add("open"); }
  }
  if (kind === "data") restart();
  renderAll();
}
loadAirports().then(() => renderAll());
renderLock($("lock")); renderHome($("home")); renderStatus();
N.banner = toast;
initDevice({ goHome, lock: lockPad, applyTheme, renderAll, openApp, changed: settingsChanged, toast });
applyBright();
initFrame({ lock: lockPad, unlock, isLocked: () => ui.view === "lock", brighter: (d) => { saveSettings({ bright: Math.min(1, Math.max(0.4, Math.round(((settings.bright ?? 1) + d * 0.1) * 10) / 10)) }); applyBright(); } });
if (q.has("unlock") || q.get("app")) { $("lock").classList.add("gone"); ui.view = "home"; if (q.get("app")) openApp(q.get("app"), q.get("tab") || undefined); }
if (ui.view !== "lock") whatsNewOnce();
startPolling();
News.pollNews(); setInterval(() => News.pollNews(), 15 * 60e3);
import("./account.js").then((m) => { m.accLoad(true); setInterval(() => m.accLoad(), 5 * 60e3); });
startAlerts(); applyWake();
startSim(); onSim(() => { renderStatus(); if (ui.view === "app" && ["turnaround", "fenix"].includes(ui.app)) renderApp(ui.app); });
startSync();
if ("serviceWorker" in navigator && location.protocol === "https:") {
  // a new version took over (sw.js changed): load it once, so a fix shows up without opening the pad twice
  if (navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
}
window.ASL = { S, settings, openApp, goHome, emit, showWhatsNew, toast, notify }; // for the console and tests
