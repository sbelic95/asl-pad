// Settings: SimBrief and VATSIM, units, language, look, auto-lock, data and the about box.
import { S, settings, saveSettings } from "../data.js";
import { t, LANGS, getLang, setLang } from "../i18n.js";
import { esc, store } from "../util.js";
import { WALLS, getPhoto, delPhoto, savePhoto } from "../wall.js";
import { latest } from "../whatsnew.js";
import { HOME_CARDS } from "../home.js";

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

function page() {
  const st = S.ofp ? `<span class="pill ok">${t("loaded")}: ${esc(S.ofp.callsign)} ${esc(S.ofp.dep.icao)}–${esc(S.ofp.dest.icao)}</span>`
    : S.ofpErr === "user" ? `<span class="pill bad">${t("SimBrief user not found.")}</span>` : S.ofpErr === "noofp" ? `<span class="pill warn">${t("No OFP found at SimBrief.")}</span>`
    : S.ofpErr === "net" ? `<span class="pill bad">${t("SimBrief not reachable.")}</span>` : "";
  const vat = settings.demo ? "" : S.pilot ? `<span class="pill ok">${t("online")}: ${esc(S.pilot.callsign)}</span>` : S.feedOk ? `<span class="pill">${t("not online")}</span>` : S.feedOk === false ? `<span class="pill bad">${t("VATSIM not reachable")}</span>` : "";
  return `<div style="max-width:860px;margin:0 auto">
    <div class="card"><div class="lbl" style="margin-bottom:4px">${t("Flight")}</div>
      ${row(t("SimBrief"), t("Username or pilot ID. Your latest OFP is loaded."), `<input data-k="simbrief" value="${esc(settings.simbrief)}" placeholder="${t("e.g. 123456")}" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:240px"> ${st}`)}
      ${row(t("VATSIM CID"), t("Finds your aircraft on the network. Without it the callsign of the OFP is used."), `<input data-k="cid" value="${esc(settings.cid)}" inputmode="numeric" placeholder="1234567" autocomplete="off" style="width:160px"> ${vat}`)}
    </div>
    <div class="card"><div class="lbl" style="margin-bottom:4px">${t("Display")}</div>
      ${row(t("Language"), "", seg("lang", Object.entries(LANGS), getLang()))}
      ${row(t("Weights"), t("Fuel and weights in"), seg("unit", [["kg", "kg"], ["t", t("tonnes")], ["lb", "lb"]], settings.unit))}
      ${row(t("Look"), "", seg("theme", [["dark", t("Dark")], ["light", t("Light")]], settings.theme))}
      ${wallRow()}
      ${row(t("Home screen"), t("Cards on the home screen. Tap to show or hide."), `<div class="seg">${HOME_CARDS.map(([k, l]) => `<button data-hc="${k}" class="${(settings.homeHide || []).includes(k) ? "" : "on"}">${esc(t(l))}</button>`).join("")}</div>`)}
      ${row(t("Auto-lock"), t("Locks the pad after this time without a touch."), seg("lock", [[0, t("Never")], [5, "5 min"], [10, "10 min"], [30, "30 min"]], settings.lock))}
    </div>
    <div class="card"><div class="lbl" style="margin-bottom:4px">${t("Data")}</div>
      ${row(t("Flight data"), t("Times, track and fuel checks of your flights on this device."), `<button class="btn small" data-do="clearflights">${t("Delete flight data")}</button>`)}
      ${row(t("Logbook"), t("Make a backup in the logbook before you delete it."), `<button class="btn small" data-do="clearlog">${t("Delete logbook")}</button>`)}
      ${row(t("Install"), t("In Safari: Share → Add to Home Screen. The pad then opens full screen."), "")}
    </div>
    <div class="card"><div class="lbl" style="margin-bottom:8px">${t("About")}</div>
      <p style="margin:0 0 8px"><b>ASL Pad ${VERSION}</b> · ${t("Crew pad for virtual Air Serbia flights in the flight simulator.")} <button class="btn small" data-do="whatsnew" style="margin-left:6px">${t("What's new")}</button></p>
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
  const hc = e.target.closest("[data-hc]");
  if (hc) { const k = hc.dataset.hc, h = new Set(settings.homeHide || []); h.has(k) ? h.delete(k) : h.add(k); saveSettings({ homeHide: [...h] }); C.changed("view"); return; }
  const w = e.target.closest("[data-wp]"); // not [data-wall]: <html> carries data-wall
  if (w) { saveSettings({ wall: w.dataset.wp }); C.changed("theme"); return; }
  const s = e.target.closest("[data-seg]");
  if (s) {
    const k = s.dataset.seg, v = s.dataset.v;
    if (k === "lang") { setLang(v); C.changed("lang"); return; }
    if (k === "lock" || k === "wallDim") saveSettings({ [k]: +v });
    else saveSettings({ [k]: v });
    C.changed(k === "theme" || k === "wallDim" ? "theme" : "view");
    return;
  }
  const b = e.target.closest("[data-do]"); if (!b) return;
  if (b.dataset.do === "whatsnew") { window.ASL.showWhatsNew(); return; }
  if (b.dataset.do === "delphoto") { delPhoto(); if (settings.wall === "photo") saveSettings({ wall: "night" }); C.changed("theme"); return; }
  if (sure !== b.dataset.do) { sure = b.dataset.do; b.textContent = t("Tap again to delete"); b.classList.add("pri"); setTimeout(() => { if (sure === b.dataset.do) { sure = null; C.changed("view"); } }, 3500); return; }
  sure = null;
  if (b.dataset.do === "clearflights") store.keys("asl.flight.").forEach((k) => store.del(k));
  if (b.dataset.do === "clearlog") { store.del("asl.logbook"); store.del("asl.logbook.demo"); }
  C.toast({ lv: "ok", ic: "check", title: t("Deleted"), text: "" });
  C.changed("data");
}
