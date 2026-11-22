// Live data from the simulator PC: the VDGS bridge (vdgs-slot-board/bridge) reads MSFS, GSX Pro and the Fenix and serves
// the pad at http://<PC>:8770/pad/. Opened that way the pad talks to the bridge on the same address. A browser page on
// https (GitHub Pages) may not call an address in the home network, so there the bridge is only used when the pilot
// enters it in Settings and the browser allows it (e.g. localhost on the same PC).
import { settings } from "./data.js";
import { notify } from "./notify.js";

export const SIM = { base: "", ok: false, at: 0, d: null, err: "" };
const listeners = new Set();
export const onSim = (fn) => listeners.add(fn);
export function bridgeBase() {
  if (typeof location !== "undefined" && /^\/pad(\/|$)/.test(location.pathname)) return location.origin; // served by the bridge
  const s = (settings.bridge || "").trim().replace(/\/+$/, "");
  return s ? (/^https?:\/\//.test(s) ? s : "http://" + s) : "";
}
let timer = null, last = {};
async function poll() {
  SIM.base = bridgeBase();
  if (!SIM.base) { if (SIM.ok || SIM.d) { SIM.ok = false; SIM.d = null; listeners.forEach((f) => f()); } return; }
  try {
    const r = await fetch(SIM.base + "/sim", { cache: "no-store" });
    const d = await r.json();
    SIM.d = d; SIM.ok = !!d.connected; SIM.err = d.error || ""; SIM.at = Date.now();
    watchGsx(d.gsx);
  } catch (e) { SIM.ok = false; SIM.err = "bridge"; SIM.d = null; }
  listeners.forEach((f) => { try { f(); } catch {} });
}
export function startSim() { clearInterval(timer); poll(); timer = setInterval(poll, 2000); }

// GSX: a notification when a service starts or is done (only on changes, not on the first reading)
export const GSX_NAMES = { deboarding: "Deboarding", catering: "Catering", refuel: "Refuel", boarding: "Boarding", pushback: "Pushback", jetway: "Jetway",
  stairs: "Stairs", gpu: "Ground power", deice: "De-icing", lavatory: "Lavatory service", water: "Water service", cleaning: "Cleaning" };
function watchGsx(g) {
  if (!g?.running) { last = {}; return; }
  for (const [k, v] of Object.entries(g.services || {})) {
    const was = last[k];
    if (was != null && was !== v && (v === 5 || v === 6) && !["jetway", "stairs"].includes(k))
      notify({ app: "turnaround", ic: v === 6 ? "check" : "plane", lv: "info", title: "GSX", text: GSX_NAMES[k] + (v === 6 ? " · completed" : " · started"), tag: "gsx-" + k });
    last[k] = v;
  }
}
export async function gsxCall(service) {
  const r = await fetch(SIM.base + "/gsx/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service }) });
  const d = await r.json(); if (!d.ok) throw new Error(d.error || "GSX");
}
export async function gsxMenu(choice) {
  await fetch(SIM.base + "/gsx/menu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(choice ? { choice } : { open: true }) });
}
