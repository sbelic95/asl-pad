// Settings: SimBrief and VATSIM, units, language, look, auto-lock, data and the about box.
import { S, settings, saveSettings } from "../data.js";
import { t, LANGS, getLang, setLang } from "../i18n.js";
import { esc, store } from "../util.js";
import { WALLS, getPhoto, delPhoto, savePhoto } from "../wall.js";
import { latest } from "../whatsnew.js";
import { HOME_CARDS, boardOrder } from "../home.js";
import { ACC, DASH, accSignIn, accSignOut, accLoad, accConnect, accConfig } from "../account.js";
import { WAKE } from "../wake.js";
import { play } from "../sound.js";

export const name = "Settings";
export const tabs = [];
export const VERSION = latest().v;

let C = null;
export function render(body, ctx) {
  C = ctx;
  if (!body._set) {
    body._set = true;
    body.addEventListener("click", onClick);
    body.addEventListener("change", onInput);
    body.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("input[data-k]")) e.target.blur(); });
  }
  // keep what the pilot is typing: only rebuild when no field has the focus
  if (body.contains(document.activeElement) && document.activeElement.matches("input:not([type=file])")) return;
  body.innerHTML = page();
}
export function summary() { return [t("Settings"), `SimBrief: ${settings.simbrief || "—"}\nVATSIM: ${settings.cid || "—"}\n${LANGS[getLang()]} · ${settings.unit}`]; }

const seg = (key, opts, cur) => `<div class="seg">${opts.map(([v, l]) => `<button data-seg="${key}" data-v="${esc(v)}" class="${String(cur) === String(v) ? "on" : ""}">${esc(l)}</button>`).join("")}</div>`;
const row = (h, sub, ctl) => `<div class="set-row"><div class="h">${h}${sub ? `<small>${sub}</small>` : ""}</div><div>${ctl}</div></div>`;

let cfgAsked = false;
function accRow() {
  if (ACC.token) {
    const p = ACC.profile;
    return `<span class="pill ok">${esc(p?.name || "CID " + (ACC.cid || ""))}</span> <span class="pill">CID ${esc(ACC.cid || p?.cid || "")}</span>
      <button class="btn small" data-do="acc-load">${t("Refresh")}</button> <button class="btn small" data-do="acc-out">${t("Sign out")}</button>
      <div class="dim" style="font-size:12.5px;margin-top:6px">${t("SimBrief, VATSIM, IVAO and Hoppie come from your profile on the dashboard.")} <a href="${DASH}" target="_blank" rel="noopener">${t("Edit profile")} ↗</a></div>${ACC.err ? `<div class="bad" style="font-size:12.5px;margin-top:6px">${esc(ACC.err)}</div>` : ""}`;
  }
  if (!cfgAsked) { cfgAsked = true; accConfig(); }
  const c = ACC.cfg || {}, err = ACC.err ? `<div class="bad" style="font-size:12.5px;margin-top:6px">${esc(ACC.err)}</div>` : "";
  const vatsim = c.connect ? `<button class="btn small pri" data-do="acc-connect">${t("Sign in with VATSIM")}</button>
    <div class="dim" style="font-size:12.5px;margin-top:6px">${t("You sign in on VATSIM's own page – your password never reaches the pad.")}</div>` : "";
  const pin = c.pinLogin === false ? "" : `<div class="acc-in"${c.connect ? ' style="margin-top:8px"' : ""}><input data-acc="cid" inputmode="numeric" placeholder="VATSIM CID" autocomplete="username" style="width:130px"> <input data-acc="pin" type="password" inputmode="numeric" placeholder="PIN" autocomplete="current-password" style="width:100px">
    <button class="btn small${c.connect ? "" : " pri"}" data-do="acc-in">${t("Sign in")}</button></div>
    <div class="dim" style="font-size:12.5px;margin-top:6px">${t("No account yet? Sign in once on the dashboard and choose your PIN there.")} <a href="${DASH}" target="_blank" rel="noopener">${DASH.replace("https://", "")} ↗</a></div>`;
  return vatsim + pin + err;
}

function page() {
  const st = S.ofp ? `<span class="pill ok">${t("loaded")}: ${esc(S.ofp.callsign)} ${esc(S.ofp.dep.icao)}–${esc(S.ofp.dest.icao)}</span>`
    : S.ofpErr === "notasl" ? `<span class="pill warn">${t("Your newest SimBrief plan ({cs}) is not an Air Serbia flight. Only callsigns starting with ASL are loaded.", { cs: esc(S.ofpErrMsg) })}</span>`
    : S.ofpErr === "user" ? `<span class="pill bad">${t("SimBrief user not found.")}</span>` : S.ofpErr === "noofp" ? `<span class="pill warn">${t("No OFP found at SimBrief.")}</span>`
    : S.ofpErr === "net" ? `<span class="pill bad">${t("SimBrief not reachable.")}</span>${S.ofpErrMsg ? `<div class="dim" style="font-size:12px;margin-top:4px">${esc(S.ofpErrMsg)}</div>` : ""}`
    : S.ofpErr === "parse" ? `<span class="pill bad">${t("The OFP could not be read.")}</span><div class="dim" style="font-size:12px;margin-top:4px">${esc(S.ofpErrMsg || "")}</div>` : "";
  const vat = settings.demo ? "" : S.pilot ? `<span class="pill ok">${t("online")}: ${esc(S.pilot.callsign)}</span>` : S.feedOk ? `<span class="pill">${t("not online")}</span>` : S.feedOk === false ? `<span class="pill bad">${t("VATSIM not reachable")}</span>` : "";
  return `<div style="max-width:860px;margin:0 auto">
    <div class="card"><div class="lbl" style="margin-bottom:4px">${t("Flight")}</div>
      ${row(t("SimBrief"), t("Username or pilot ID. Your latest OFP is loaded."), `<input data-k="simbrief" value="${esc(settings.simbrief)}" placeholder="${t("e.g. 123456")}" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:240px"> ${st}`)}
      ${row(t("VATSIM CID"), t("Finds your aircraft on the network. Without it the callsign of the OFP is used."), `<input data-k="cid" value="${esc(settings.cid)}" inputmode="numeric" placeholder="1234567" autocomplete="off" style="width:160px"> ${vat}`)}
      ${row(t("IVAO VID"), t("Marks your own aircraft in the IVAO Radar."), `<input data-k="ivao" value="${esc(settings.ivao || "")}" inputmode="numeric" placeholder="123456" autocomplete="off" style="width:160px">`)}
      ${row(t("Hoppie ACARS"), (ACC.token ? t("Your personal logon code from hoppie.nl. For ACARS and CPDLC in ASL Fly. Comes from your profile on the dashboard.") : t("Your personal logon code from hoppie.nl. For ACARS and CPDLC in ASL Fly. Stays on this device.")), `<input data-k="hoppie" class="masked" value="${esc(settings.hoppie || "")}" data-lpignore="true" data-1p-ignore data-bwignore placeholder="${t("logon code")}" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:200px"> <a class="btn small" href="https://www.hoppie.nl/acars/system/register.html" target="_blank" rel="noopener">${t("Get a code")}</a>`)}
      ${row(t("Simulator bridge"), t("Live data from MSFS, GSX and the Fenix through the VDGS bridge on the simulator PC. Opened from the bridge (…:8770/pad/) it connects by itself."), `<input data-k="bridge" value="${esc(settings.bridge || "")}" placeholder="192.168.1.20:8770" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:200px">`)}
      ${row(t("Air Serbia Virtual account"), t("Sign in with your VATSIM CID and the PIN of the pilot dashboard: your SimBrief, VATSIM, IVAO and Hoppie settings and your bookings come into the pad."), accRow())}
    </div>
    <div class="card"><div class="lbl" style="margin-bottom:4px">${t("Display")}</div>
      ${row(t("Language"), "", seg("lang", Object.entries(LANGS), getLang()))}
      ${row(t("Weights"), t("Fuel and weights in"), seg("unit", [["kg", "kg"], ["t", t("tonnes")], ["lb", "lb"]], settings.unit))}
      ${row(t("Look"), "", seg("theme", [["dark", t("Dark")], ["light", t("Light")]], settings.theme))}
      ${wallRow()}
      ${row(t("Home screen"), t("Cards on the home screen. Tap to show or hide."), `<div class="seg">${HOME_CARDS.map(([k, l]) => `<button data-hc="${k}" class="${(settings.homeHide || []).includes(k) ? "" : "on"}">${esc(t(l))}</button>`).join("")}</div>`)}
      ${row(t("Order of the cards"), t("Which card comes first on the home screen."), `<div class="hc-order">${boardOrder().map((k, i, a) => `<div><span>${esc(t(HOME_CARDS.find((c) => c[0] === k)?.[1] || k))}</span>
        <button class="btn small" data-hco="${k}" data-dir="-1" ${i ? "" : "disabled"} aria-label="up">▲</button><button class="btn small" data-hco="${k}" data-dir="1" ${i < a.length - 1 ? "" : "disabled"} aria-label="down">▼</button></div>`).join("")}</div>`)}
      ${row(t("Device frame"), t("On a computer the pad lies as a tablet on a desk, with your crew card next to it. Auto: only when the window is big enough."), seg("frame", [["auto", t("Auto")], ["on", t("On")], ["off", t("Off")]], settings.frame || "auto"))}
      ${row(t("Keep screen on"), WAKE.supported ? (WAKE.on ? t("The screen stays on while the pad is open.") : t("Stays on while the pad is open (after the first touch).")) : t("This browser cannot keep the screen on – on the iPad from iOS 16.4."), seg("awake", [["1", t("On")], ["0", t("Off")]], settings.awake === false ? "0" : "1"))}
      ${row(t("Sounds"), t("CPDLC and ACARS messages, a new ATIS and changes of TSAT, CTOT or off-block time shortly before departure."), seg("sound", [["1", t("On")], ["0", t("Off")]], settings.sound === false ? "0" : "1")
        + `<div class="snd-test">${[["cpdlc", "CPDLC"], ["atis", "ATIS"], ["slot", "TSAT/Slot"], ["msg", "ACARS"]].map(([k, l]) => `<button class="btn small" data-snd="${k}">▶ ${l}</button>`).join("")}</div>`)}
      ${row(t("Auto-lock"), t("Locks the pad after this time without a touch."), seg("lock", [[0, t("Never")], [5, "5 min"], [10, "10 min"], [30, "30 min"]], settings.lock))}
    </div>
    <div class="card"><div class="lbl" style="margin-bottom:4px">${t("Data")}</div>
      ${row(t("Flight data"), t("Times, track and fuel checks of your flights on this device."), `<button class="btn small" data-do="clearflights">${t("Delete flight data")}</button>`)}
      ${row(t("Logbook"), t("Make a backup in the logbook before you delete it."), `<button class="btn small" data-do="clearlog">${t("Delete logbook")}</button>`)}
      ${row(t("Install"), t("In Safari: Share → Add to Home Screen. The pad then opens full screen."), "")}
    </div>
    <div class="card"><div class="lbl" style="margin-bottom:8px">${t("About")}</div>
      <p style="margin:0 0 8px"><b>ASL Pad ${VERSION}</b> · ${t("Crew pad for virtual Air Serbia flights in the flight simulator.")} <button class="btn small" data-do="whatsnew" style="margin-left:6px">${t("What's new")}</button> <a class="btn small" href="privacy.html" target="_blank" rel="noopener">${t("Privacy")}</a></p>
      <p class="dim" style="font-size:13px;margin:0 0 8px">${t("Unofficial fan project. Not affiliated with or endorsed by Air Serbia. The Air Serbia name and logo belong to Air Serbia; the logo is loaded from a public logo service and is not part of this project. For flight simulation only – not for real-world navigation.")}</p>
      <p class="dim" style="font-size:12.5px;margin:0">${t("Data")}: SimBrief (Navigraph), VATSIM, vIFF CDM, OpenStreetMap (ODbL), OurAirports, CARTO. ${t("Software")}: Leaflet (BSD-2), Roboto / Roboto Condensed (Apache 2.0), B612 Mono (OFL).</p></div>
  </div>`;
}

// wallpaper of the lock and home screen: built-in skies and a photo from the device
function wallRow() {
  const photo = !!getPhoto(), cur = settings.wall === "photo" && photo ? "photo" : settings.wall === "auto" || WALLS[settings.wall] ? settings.wall : "night";
  const tile = (id, name, bg) => `<button class="wtile${cur === id ? " on" : ""}" data-wp="${id}"><i style="${bg}"></i><span>${esc(name)}</span></button>`;
  const tiles = [tile("auto", t("Sky where you are"), "background:linear-gradient(180deg,#04163a 0%,#3a2160 42%,#c85a3e 60%,#0b4fa8 100%)")]
    .concat(Object.entries(WALLS).map(([id, w]) => tile(id, t(w.name), "background:" + esc(w[settings.theme === "light" ? "light" : "dark"]))));
  tiles.push(photo ? tile("photo", t("My photo"), "background-image:var(--wall-img)")
    : `<label class="wtile"><i class="add">+</i><span>${t("My photo")}</span><input type="file" accept="image/*" data-file="wall" hidden></label>`);
  const btns = photo ? `<div class="wall-btns"><label class="btn small">${t("Choose another photo")}<input type="file" accept="image/*" data-file="wall" hidden></label>
      <button class="btn small" data-do="delphoto">${t("Remove photo")}</button>
      ${cur === "photo" ? `<span class="dim" style="font-size:13px;margin-left:6px">${t("Dim photo")}</span>${seg("wallDim", [[0, t("Off")], [0.3, t("Low")], [0.55, t("High")]], settings.wallDim)}` : ""}</div>` : "";
  return `<div class="wall-row"><div class="h" style="font-weight:600">${t("Wallpaper")}<small class="dim" style="display:block;font-weight:400;font-size:12px">${t("Background of the lock and home screen. A photo stays on this device only.")}</small></div>
    <div class="walls">${tiles.join("")}</div>${btns}</div>`;
}
async function onPhoto(input) {
  const f = input.files?.[0]; if (!f) return;
  let ok = false;
  try { ok = await savePhoto(f); } catch {}
  input.value = "";
  if (!ok) { C.toast({ lv: "red", ic: "warn", title: t("Photo not saved"), text: t("The photo could not be read or the storage of the browser is full.") }); return; }
  saveSettings({ wall: "photo" });
  C.toast({ lv: "ok", ic: "check", title: t("Wallpaper changed"), text: "" });
  C.changed("theme");
}

function onInput(e) {
  if (e.target.matches("input[data-file=wall]")) { onPhoto(e.target); return; }
  const k = e.target.dataset.k; if (!k) return;
  const v = e.target.value.trim();
  if (settings[k] === v) return;
  saveSettings({ [k]: v });
  C.changed("data");
}
let sure = null;
function onClick(e) {
  const ho = e.target.closest("[data-hco]");
  if (ho) { const l = boardOrder(), i = l.indexOf(ho.dataset.hco), j = i + Number(ho.dataset.dir); if (j >= 0 && j < l.length) { [l[i], l[j]] = [l[j], l[i]]; saveSettings({ homeOrder: l }); C.changed("view"); } return; }
  const hc = e.target.closest("[data-hc]");
  if (hc) { const k = hc.dataset.hc, h = new Set(settings.homeHide || []); h.has(k) ? h.delete(k) : h.add(k); saveSettings({ homeHide: [...h] }); C.changed("view"); return; }
  const w = e.target.closest("[data-wp]"); // not [data-wall]: <html> carries data-wall
  if (w) { saveSettings({ wall: w.dataset.wp }); C.changed("theme"); return; }
  const s = e.target.closest("[data-seg]");
  if (s) {
    const k = s.dataset.seg, v = s.dataset.v;
    if (k === "lang") { setLang(v); C.changed("lang"); return; }
    if (k === "awake" || k === "sound") { saveSettings({ [k]: v === "1" }); C.changed("view"); return; }
    if (k === "lock" || k === "wallDim") saveSettings({ [k]: +v });
    else saveSettings({ [k]: v });
    C.changed(k === "theme" || k === "wallDim" ? "theme" : "view");
    return;
  }
  const snd = e.target.closest("[data-snd]"); if (snd) { play(snd.dataset.snd, true); return; }
  const b = e.target.closest("[data-do]"); if (!b) return;
  if (b.dataset.do === "whatsnew") { window.ASL.showWhatsNew(); return; }
  if (b.dataset.do === "acc-in") { const r = b.closest(".set-row"), cid = r?.querySelector("[data-acc=cid]")?.value || "", pin = r?.querySelector("[data-acc=pin]")?.value || ""; b.disabled = true;
    accSignIn(cid, pin).then(() => C.toast({ lv: "ok", ic: "check", title: t("Signed in"), text: t("Profile taken over from the dashboard.") })).catch((e) => { ACC.err = e.message; b.disabled = false; C.changed("view"); }); return; }
  if (b.dataset.do === "acc-out") { accSignOut(); C.changed("view"); return; }
  if (b.dataset.do === "acc-connect") { accConnect(); return; }
  if (b.dataset.do === "acc-load") { accLoad(true); return; }
  if (b.dataset.do === "delphoto") { delPhoto(); if (settings.wall === "photo") saveSettings({ wall: "night" }); C.changed("theme"); return; }
  if (sure !== b.dataset.do) { sure = b.dataset.do; b.textContent = t("Tap again to delete"); b.classList.add("pri"); setTimeout(() => { if (sure === b.dataset.do) { sure = null; C.changed("view"); } }, 3500); return; }
  sure = null;
  if (b.dataset.do === "clearflights") store.keys("asl.flight.").forEach((k) => store.del(k));
  if (b.dataset.do === "clearlog") { store.del("asl.logbook"); store.del("asl.logbook.demo"); }
  C.toast({ lv: "ok", ic: "check", title: t("Deleted"), text: "" });
  C.changed("data");
}
