// App Store: every app of the pad by group; the pilot installs or removes the optional ones (the core apps stay).
// Removing only hides the app on the home screen – its data stays on the device.
import { settings, saveSettings } from "../data.js";
import { t } from "../i18n.js";
import { esc } from "../util.js";
import { APP_ICONS } from "../icons.js";
import { HOME_APPS, GROUPS, installed } from "../home.js";

export const name = "App Store";
export const tabs = [];
const ABOUT = {
  fly: "Your flight from the OFP: overview, radio and ACARS, times, plan, map, weather, fuel and performance.",
  ops: "Duty, roster, check-in, crew desk and the report after the flight.", apt: "Ground map with taxi routes, briefing and stands.",
  log: "Every flight with its track and profile.", kneeboard: "Clearance, ATIS, notes and a scratchpad for the flight.",
  manuals: "The airline's documents as links, with search.", calendar: "Flights, VATSIM events and your own entries with reminders.",
  cabin: "The passenger screen: flight map, destination, connections.", simbrief: "Opens SimBrief to plan a flight.",
  radar: "All VATSIM flights and stations on one map.", ivao: "All IVAO flights and stations on one map.",
  weather: "METAR and TAF for every Air Serbia destination.", clock: "Zulu, world clock, stopwatch, timer and alarms.",
  mail: "Your company inbox: notices of the airline and a monthly summary of your flying.", messages: "Notifications and ACARS messages as conversations.",
  academy: "Short courses with questions, and Serbian for the crew.", news: "Flight-sim headlines from public news sites, every hour.",
  photos: "Your screenshots, sorted by month and flight – only on this device.", scenery: "Swipe through the network and find sceneries for the airports you like.",
  reference: "Alphabet, unit converter, transponder codes, light signals and METAR.", browser: "The crew services one tap away.",
  turnaround: "GSX Pro on the pad: every ground service with its state, called with one tap (needs the VDGS bridge).",
  fenix: "Opens the Fenix EFB and compares fuel and weight with your plan (needs the VDGS bridge).",
  checklist: "The Air Serbia Virtual normal checklists per aircraft type to tick off, with fuel and QNH filled in.",
  landing: "Wind component calculator for every type and the airline's landing data: wind limits, autobrake and Vapp.",
  calc: "A simple calculator.", downloads: "Liveries, ACARS and tools for the airline.", store: "Install and remove apps.", settings: "SimBrief, VATSIM, account, look and home screen.",
};
let C = null;
export function render(body, ctx) {
  C = ctx;
  if (!body._st) { body._st = true; body.addEventListener("click", (e) => { const b = e.target.closest("[data-inst]"); if (!b) return; const id = b.dataset.inst, off = new Set(settings.appsOff || []);
    off.has(id) ? off.delete(id) : off.add(id); saveSettings({ appsOff: [...off] }); C.toast({ lv: "ok", ic: "check", title: off.has(id) ? t("Removed from the home screen") : t("Installed"), text: t(HOME_APPS.find((a) => a.id === id).name) }); C.changed("view"); }); }
  body.innerHTML = `<div class="as-hero"><h2>${t("Apps for your flight deck")}</h2><p class="dim">${t("Removed apps keep their data. Install them again any time.")}</p></div>` + GROUPS.map(([g, gl]) => `<div class="card"><div class="lbl" style="margin-bottom:10px">${esc(t(gl))}</div><div class="as-list">${HOME_APPS.filter((a) => a.g === g).map((a) => `<div class="as-i"><div class="ico">${APP_ICONS[a.icon] || ""}</div><div><b>${esc(t(a.name))}</b><small>${esc(t(ABOUT[a.id] || ""))}</small></div>
    ${a.core ? `<span class="dim" style="font-size:12px">${t("Built in")}</span>` : `<button class="btn small${installed(a.id) ? "" : " pri"}" data-inst="${a.id}">${installed(a.id) ? t("Remove") : t("Install")}</button>`}</div>`).join("")}</div></div>`).join("");
}
export function summary() { return [t("App Store"), t("{n} apps installed", { n: HOME_APPS.filter((a) => installed(a.id)).length })]; }
