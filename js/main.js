// ASL Pad shell: lock screen, home screen, apps, app switcher (double-tap the home bar), status bar.
import { $, esc, hhmmz, store } from "./util.js";
import { S, settings, saveSettings, setUrlDemo, onChange, startPolling, refreshAll, restart, emit } from "./data.js";
import { t, setLang, getLang, dateLong } from "./i18n.js";
import { APP_ICONS, I } from "./icons.js";
import { renderLock, noteHtml } from "./lock.js";
import { renderHome, HOME_APPS } from "./home.js";
import { loadAirports, cityOf } from "./tz.js";
import { applyWall } from "./wall.js";
import * as Fly from "./apps/fly.js";
import * as Ops from "./apps/ops.js";
import * as Log from "./apps/log.js";
import * as Settings from "./apps/settings.js";

const frameApp = (id, name, url) => ({ id, name, frame: true, url, render(body) {
  if (!body.querySelector("iframe")) body.innerHTML = `<iframe src="${esc(url())}" style="border:0;width:100%;height:100%;display:block;background:#fff" allow="fullscreen; autoplay"></iframe>`;
}, summary: () => [name, t("Opened in the pad")] });
const VDGS = "https://sbelic95.github.io/vdgs-slot-board/";
const cs = () => S.ofp?.callsign || "";
const APPS = {
  fly: Fly, ops: Ops, log: Log, settings: Settings,
  cabin: frameApp("cabin", "Cabin", () => VDGS + "airserbia/" + (cs() ? "?cs=" + cs() : "")),
  vdgs: frameApp("vdgs", "VDGS", () => VDGS + (cs() ? "?cs=" + cs() : "")),
};
const NAMES = Object.fromEntries(HOME_APPS.map((a) => [a.id, a]));

const ui = { view: "lock", app: null, recent: store.get("asl.recent", []), tab: {}, lastInput: Date.now(), switcher: false };

// ---------- URL options: ?demo, ?demo=ground (only for this visit), ?demo=off, ?app=fly&tab=map, ?unlock ----------
const q = new URLSearchParams(location.search);
if (q.has("demo")) { const v = q.get("demo"); if (v === "off") saveSettings({ demo: "" }); else setUrlDemo(v === "ground" ? "ground" : "air"); }
if (q.get("lang")) setLang(q.get("lang"));
setLang(getLang());

// ---------- theme ----------
export function applyTheme() { document.documentElement.dataset.theme = settings.theme === "light" ? "light" : "dark"; applyWall(settings); }
applyTheme();

// ---------- status bar ----------
function renderStatus(now = Date.now()) {
  const vat = settings.demo ? `<span class="dot on"></span>DEMO` : S.feedOk == null ? "" : `<span class="dot ${S.pilot ? "on" : S.feedOk ? "" : "off"}"></span>VATSIM${S.pilot ? " · " + esc(S.pilot.callsign) : ""}`;
  $("status").innerHTML = ui.view === "lock" ? `<span class="sp"></span><span>${vat}</span>`
    : `<span class="num">${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(now)}</span><span class="dim">${esc(dateLong(now))}</span><span class="sp"></span><span>${vat}</span><span class="num">${hhmmz(now)}</span>`;
}

// ---------- app frames ----------
function frameOf(id) {
  let el = $("app-" + id);
  if (el) return el;
  const A = APPS[id], meta = NAMES[id];
  const [first, ...rest] = (meta?.name || A.name).split(" ");
  el = document.createElement("div");
  el.className = "app"; el.id = "app-" + id;
  el.innerHTML = `<div class="app-head"><div class="app-name"><span class="mini">${APP_ICONS[meta?.icon || id] || ""}</span>${rest.length ? `${esc(first)} <em>${esc(rest.join(" "))}</em>` : esc(t(first))}</div>
    <div class="tabs">${(A.tabs || []).map(([k, l]) => `<button data-tab="${k}">${esc(t(l))}</button>`).join("")}</div>
    <div class="head-r"><span class="zclock num"></span><button class="rbtn" data-act="theme" title="${t("Light / dark")}">${I.sun}</button><button class="rbtn" data-act="refresh" title="${t("Refresh")}">${I.refresh}</button></div></div>
    <div class="app-body"></div>`;
  if (!A.tabs?.length) el.querySelector(".tabs").classList.add("none");
  if (A.frame) el.querySelector(".app-body").style.padding = "0";
  el.querySelector(".tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { ui.tab[id] = b.dataset.tab; renderApp(id); } });
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
function lockPad() { hideSwitcher(); ui.view = "lock"; renderLock($("lock")); $("lock").classList.remove("gone"); renderStatus(); }
function unlock() { $("lock").classList.add("gone"); if (ui.app) { ui.view = "app"; renderApp(ui.app); } else goHome(); renderStatus(); }

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
  if (e.key === "Escape") { if (ui.switcher) hideSwitcher(); else if (ui.view === "app") goHome(); }
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
  const a = e.target.closest("[data-app]"); if (a) { openApp(a.dataset.app); return; }
  const o = e.target.closest("[data-open]"); if (o) openApp(o.dataset.open, o.dataset.tab || undefined);
});

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
  renderStatus(now);
  if (ui.view === "lock") renderLock($("lock"), now);
  if (ui.view === "home") renderHome($("home"), now);
  if (ui.view === "app" && ui.app) renderApp(ui.app, now);
  while (S.events.length) { const ev = S.events.shift(); const n = EVENT_NOTE[ev.e]?.(); if (n && Date.now() - ev.t < 60e3) toast(n); }
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
  applyTheme();
  if (kind === "lang") { // tab labels are built with the frame: build the frames again
    document.querySelectorAll(".app").forEach((a) => a.remove());
    if (ui.view === "app" && ui.app) { renderApp(ui.app); frameOf(ui.app).classList.add("open"); }
  }
  if (kind === "data") restart();
  renderAll();
}
loadAirports().then(() => renderAll());
renderLock($("lock")); renderHome($("home")); renderStatus();
if (q.has("unlock") || q.get("app")) { $("lock").classList.add("gone"); ui.view = "home"; }
if (q.get("app")) openApp(q.get("app"), q.get("tab") || undefined);
startPolling();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
window.ASL = { S, settings, openApp, goHome, emit }; // for the console and tests
