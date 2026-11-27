// The device around the apps (no PIN: the pad opens with a swipe, wish of the user), a played Face ID before ASL Ops
// and Manuals (once every 10 minutes), the Control Center (pull down at the top right) and the Notification Center
// (pull down at the top left). Pure pad chrome – no app data is changed here except the pilot's own toggles.
import { S, settings, saveSettings, refreshAll } from "./data.js";
import { t, setLang, getLang, LANGS } from "./i18n.js";
import { esc, store, hhmmz } from "./util.js";
import { I, APP_ICONS } from "./icons.js";
import { notes, clearNote, N } from "./notify.js";
import { signedIn, pilot } from "./account.js";
import { actions } from "./actions.js";
import { SY } from "./sync.js";

const pad = () => document.getElementById("pad");
const ago = (ts) => { const m = Math.round((Date.now() - ts) / 6e4); return m < 1 ? t("now") : m < 60 ? t("{n} min ago", { n: m }) : m < 1440 ? t("{n} h ago", { n: Math.round(m / 60) }) : new Date(ts).toISOString().slice(5, 10); };

// ---------- Face ID (played: an animation, no camera) ----------
const FACE = new Set(["ops", "manuals"]);
let faceAt = 0;
export function faceId(id, go) {
  if (!FACE.has(id) || Date.now() - faceAt < 10 * 60e3 || (navigator.webdriver && !location.search.includes("faceid"))) { go(); return; }
  const d = document.createElement("div"); d.className = "faceid";
  d.innerHTML = `<div class="fi-box"><svg viewBox="0 0 64 64" class="fi-face"><path d="M4 18V10a6 6 0 0 1 6-6h8M46 4h8a6 6 0 0 1 6 6v8M60 46v8a6 6 0 0 1-6 6h-8M18 60h-8a6 6 0 0 1-6-6v-8"/><g class="fi-eyes"><path d="M22 24v5M42 24v5M32 26v12l-3 2M24 46c5 4 11 4 16 0"/></g><path class="fi-ok" d="M20 33l8 8 16-17"/></svg><b>Face ID</b></div>`;
  pad().appendChild(d);
  setTimeout(() => d.classList.add("ok"), 1000);
  setTimeout(() => { d.classList.add("out"); faceAt = Date.now(); go(); }, 1550);
  setTimeout(() => d.remove(), 1900);
}

// ---------- Control Center & Notification Center ----------
let open = null, ctx = null;
export function initDevice(c) {
  ctx = c; // { goHome, lock, applyTheme, renderAll, openApp, changed }
  const st = document.getElementById("status");
  let y0 = null, x0 = 0;
  st.addEventListener("pointerdown", (e) => { y0 = e.clientY; x0 = e.clientX - st.getBoundingClientRect().left; }); // relative: the pad may sit in a frame
  st.addEventListener("pointerup", (e) => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; if (dy > 20 || Math.abs(dy) < 6) show(x0 > st.clientWidth * 0.55 ? "cc" : "nc"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) hide(); });
  N.dnd = () => !!settings.dnd; N.system = () => !!settings.push;
  N.changed = () => { if (open === "nc") draw(); badge(); };
  badge();
}
function badge() { document.getElementById("status")?.classList.toggle("has-notes", notes().some((n) => n.at > store.get("asl.notes.seen", 0))); }
export function show(kind) {
  if (document.querySelector(".pin,.faceid")) return;
  hide(true); open = kind;
  const d = document.createElement("div"); d.className = "dc " + kind; d.id = "dc";
  d.addEventListener("click", onClick);
  let y0 = null; d.addEventListener("pointerdown", (e) => { y0 = e.clientY; }); d.addEventListener("pointerup", (e) => { if (y0 != null && y0 - e.clientY > 70) hide(); y0 = null; });
  pad().appendChild(d); draw();
  requestAnimationFrame(() => d.classList.add("in"));
  if (kind === "nc") { store.set("asl.notes.seen", Date.now()); badge(); }
}
export function hide(now) { const d = document.getElementById("dc"); open = null; if (!d) return; if (now) d.remove(); else { d.classList.remove("in"); setTimeout(() => d.remove(), 220); } }
export const isOpen = () => !!open;
function tile(k, on, icon, label, sub = "") { return `<button class="cc-t${on ? " on" : ""}" data-cc="${k}"><span class="i">${icon}</span><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`; }
const dot = (ok) => `<i class="cc-dot ${ok === true ? "on" : ok === false ? "off" : ""}"></i>`;
function draw() {
  const d = document.getElementById("dc"); if (!d) return;
  if (open === "cc") {
    const light = settings.theme === "light", push = settings.push && "Notification" in window && Notification.permission === "granted";
    d.innerHTML = `<div class="cc-panel" data-stop>
      <div class="cc-grid">
        ${tile("theme", light, I.sun, light ? t("Light") : t("Dark"), t("Look"))}${tile("dnd", settings.dnd, "☾", t("Do not disturb"), settings.dnd ? t("On") : t("Off"))}
        ${tile("push", push, "🔔", t("Notifications"), push ? t("On") : t("Off"))}${tile("lang", false, "🌐", LANGS[getLang()], t("Language"))}
        ${tile("refresh", false, I.refresh, t("Refresh"), t("All data"))}${tile("lock", false, I.lock, t("Lock pad"), "")}
      </div>
      <label class="cc-slider"><span class="i">${I.sun}</span><input type="range" min="40" max="100" value="${Math.round((settings.bright ?? 1) * 100)}" data-cc="bright"></label>
      <div class="cc-apps">${["clock", "calc", "kneeboard", "weather", "radar"].map((a) => `<button data-ccapp="${a}">${APP_ICONS[a]}</button>`).join("")}</div>
      <div class="cc-st">
        <div>${dot(S.feedOk == null ? null : !!S.feedOk)}<b>VATSIM</b><span>${S.pilot ? esc(S.pilot.callsign) : S.feedOk ? t("not connected") : S.feedOk === false ? t("not reachable") : "…"}</span></div>
        <div>${dot(S.ofp ? true : S.ofpErr ? false : null)}<b>SimBrief</b><span>${S.ofp ? esc(S.ofp.callsign + " " + S.ofp.dep.icao + "–" + S.ofp.dest.icao) : S.ofpErr ? t("no OFP") : "…"}</span></div>
        <div>${dot(signedIn() ? true : null)}<b>${t("Account")}</b><span>${signedIn() ? esc(pilot()?.name || "CID " + pilot()?.pilotId) : t("not signed in")}</span></div>
        <div>${dot(settings.hoppie ? true : null)}<b>Hoppie ACARS</b><span>${settings.hoppie ? t("ready") : t("no logon code")}</span></div>
        ${SY.on ? `<div>${dot(SY.err ? false : SY.at ? true : null)}<b>${t("Server sync")}</b><span>${SY.err ? esc(SY.err) : SY.at ? hhmmz(SY.at) : "…"}</span></div>` : ""}
        <div>${dot(null)}<b>Zulu</b><span class="num">${hhmmz(Date.now())}</span></div>
      </div></div>`;
    d.querySelector("[data-cc=bright]").addEventListener("input", (e) => { saveSettings({ bright: e.target.value / 100 }); applyBright(); });
    return;
  }
  const list = notes(), todo = actions(Date.now()).slice(0, 4);
  d.innerHTML = `<div class="nc-panel" data-stop><div class="nc-head"><h2>${t("Notifications")}</h2>${list.length ? `<button class="btn small" data-nc="clear">${t("Clear all")}</button>` : ""}</div>
    ${todo.length ? `<div class="lbl">${t("To do")}</div>${todo.map((a) => `<button class="nc-i ${a.lv}" data-nco="${a.app || ""}" data-tab="${a.tab || ""}"><span class="i">${I[a.ic] || I.plane}</span><div><b>${esc(a.title)}</b><small>${esc(a.text || "")}</small></div></button>`).join("")}` : ""}
    <div class="lbl" style="margin-top:12px">${t("Earlier")}</div>
    ${list.map((n) => `<div class="nc-i ${n.lv}" data-nco="${n.app || ""}" data-tab="${n.tab || ""}"><span class="i">${I[n.ic] || APP_ICONS[n.ic] || I.plane}</span><div><b>${esc(n.title)}</b><small>${esc(n.text || "")}</small></div><span class="when">${ago(n.at)}</span><button class="x" data-ncx="${n.id}">×</button></div>`).join("") || `<div class="dim" style="padding:12px 0">${t("No notifications.")}</div>`}</div>`;
}
export function applyBright() { const p = pad(); if (p) p.style.filter = settings.bright && settings.bright < 1 ? `brightness(${settings.bright})` : ""; }
async function onClick(e) {
  const panel = e.target.closest("[data-stop]");
  if (!panel) { hide(); return; }
  const c = e.target.closest("[data-cc]")?.dataset.cc, app = e.target.closest("[data-ccapp]")?.dataset.ccapp;
  if (app) { hide(); ctx.openApp(app); return; }
  const x = e.target.closest("[data-ncx]"); if (x) { clearNote(+x.dataset.ncx); return; }
  if (e.target.closest("[data-nc=clear]")) { clearNote(null); return; }
  const o = e.target.closest("[data-nco]"); if (o) { if (o.dataset.nco) { hide(); ctx.openApp(o.dataset.nco, o.dataset.tab || undefined); } return; }
  if (c === "theme") { saveSettings({ theme: settings.theme === "light" ? "dark" : "light" }); ctx.applyTheme(); ctx.renderAll(); }
  if (c === "dnd") saveSettings({ dnd: !settings.dnd });
  if (c === "push") {
    if (settings.push) saveSettings({ push: false });
    else if ("Notification" in window) { const p = await Notification.requestPermission().catch(() => "denied"); saveSettings({ push: p === "granted" }); if (p !== "granted") ctx.toast({ lv: "attn", ic: "warn", title: t("Notifications blocked"), text: t("Allow notifications for this page in the browser settings.") }); }
  }
  if (c === "lang") { const ks = Object.keys(LANGS), n = ks[(ks.indexOf(getLang()) + 1) % ks.length]; setLang(n); ctx.changed("lang"); }
  if (c === "refresh") { refreshAll(); }
  if (c === "lock") { hide(); ctx.lock(); return; }
  if (c && c !== "bright") draw();
}
