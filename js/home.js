// Home screen: widgets on the left, apps and the dock.
import { S, derived } from "./data.js";
import { actions } from "./actions.js";
import { t } from "./i18n.js";
import { esc } from "./util.js";
import { APP_ICONS } from "./icons.js";
import { flightWidget, timesWidget, todayWidget, liveHtml } from "./lock.js";
import { cityOf } from "./tz.js";

export const HOME_APPS = [
  { id: "fly", name: "ASL Fly", icon: "fly" }, { id: "ops", name: "ASL Ops", icon: "ops" }, { id: "log", name: "Logbook", icon: "log" },
  { id: "cabin", name: "Cabin", icon: "cabin" }, { id: "vdgs", name: "VDGS", icon: "vdgs" }, { id: "simbrief", name: "SimBrief", icon: "simbrief" },
  { id: "settings", name: "Settings", icon: "settings" },
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
      <div><p class="hm-greet">${esc(greeting(now))}, ${t("Captain")}</p><div class="hm-sub">${esc(sub)}</div></div>
      ${flightWidget(o, d)}${timesWidget(o, now)}${todayWidget(now)}
    </div>
    <div class="hm-apps">${HOME_APPS.map((a) => icon(a, badges[a.id])).join("")}</div>
    <div class="dock">${DOCK.map((id) => icon(HOME_APPS.find((a) => a.id === id), badges[id])).join("")}</div>`;
}
export { liveHtml };
