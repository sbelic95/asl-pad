// Turnaround: the GSX Pro ground services on the pad – the board with every service and its state, boarding progress,
// fuel hose and pushback, and buttons that call the service in GSX (through the bridge on the simulator PC).
// The cost overview is our own estimate from the services used, not a real invoice.
import { S } from "../data.js";
import { t } from "../i18n.js";
import { esc } from "../util.js";
import { SIM, GSX_NAMES, gsxCall, gsxMenu, bridgeBase } from "../sim.js";

export const name = "Turnaround";
export const tabs = [["board", "Board"], ["menu", "GSX menu"], ["setup", "Connection"]];
const ORDER = ["deboarding", "cleaning", "catering", "refuel", "water", "lavatory", "boarding", "gpu", "jetway", "stairs", "deice", "pushback"];
const ST = { 0: ["—", ""], 1: ["Ready to call", "call"], 2: ["Not available", "na"], 3: ["Bypassed", "na"], 4: ["Requested", "req"], 5: ["In progress", "act"], 6: ["Completed", "done"], 7: ["Completing", "act"] };
// rough handling prices per service in EUR (own estimate for the overview, varies by airport in reality)
const PRICE = { deboarding: 180, cleaning: 220, catering: 650, refuel: 90, water: 60, lavatory: 70, boarding: 180, gpu: 85, jetway: 120, stairs: 60, deice: 1400, pushback: 240 };
let busy = "";

export function render(body, ctx) {
  if (!body._ta) { body._ta = true; body.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-gsx]"); if (b) { busy = b.dataset.gsx; ctx.changed("view");
      try { await gsxCall(b.dataset.gsx); ctx.toast({ lv: "ok", ic: "check", title: "GSX", text: t(GSX_NAMES[b.dataset.gsx]) + " · " + t("requested") }); }
      catch (err) { ctx.toast({ lv: "red", ic: "warn", title: "GSX", text: err.message }); }
      setTimeout(() => { busy = ""; ctx.changed("view"); }, 2500); return; }
    const m = e.target.closest("[data-gsxm]"); if (m) { await gsxMenu(m.dataset.gsxm === "open" ? 0 : +m.dataset.gsxm).catch(() => {}); return; }
    if (e.target.closest("[data-do=sim-settings]")) ctx.open("settings");
  }); }
  const g = SIM.d?.gsx;
  if (ctx.tab === "setup" || !SIM.base || !SIM.d) { body.innerHTML = setup(); return; }
  if (!SIM.ok) { body.innerHTML = `<div class="ta-empty"><h2>${t("Simulator not connected")}</h2><p class="dim">${t("The bridge is running, but MSFS is not connected yet. Start a flight – the bridge keeps trying.")}</p></div>`; return; }
  if (!g?.running) { body.innerHTML = `<div class="ta-empty"><h2>${t("GSX is not running")}</h2><p class="dim">${t("Start GSX Pro in the simulator (Couatl). The turnaround board appears by itself.")}</p></div>`; return; }
  if (ctx.tab === "menu") { body.innerHTML = menu(g); return; }
  const sv = g.services || {}, used = ORDER.filter((k) => [5, 6, 7].includes(sv[k]));
  const pax = g.paxTarget ? Math.round(((sv.deboarding === 5 ? g.paxDeboarded : g.paxBoarded) / g.paxTarget) * 100) : 0;
  const o = S.ofp;
  body.innerHTML = `<div class="ta-top">
      <div class="card ta-k"><span class="lbl">${t("Passengers")}</span><b class="num">${g.paxBoarded ?? 0} / ${g.paxTarget ?? "—"}</b><div class="ta-bar"><i style="width:${Math.min(100, pax)}%"></i></div><small class="dim">${sv.deboarding === 5 ? t("deboarding") : t("boarded")}${o?.pax ? " · " + t("OFP {n}", { n: o.pax }) : ""}</small></div>
      <div class="card ta-k"><span class="lbl">${t("Cargo")}</span><b class="num">${g.cargoBoard ?? 0} %</b><div class="ta-bar"><i style="width:${g.cargoBoard || 0}%"></i></div><small class="dim">${t("loaded")}</small></div>
      <div class="card ta-k"><span class="lbl">${t("Fuel")}</span><b class="num">${SIM.d.fuelKg != null ? SIM.d.fuelKg.toLocaleString() + " kg" : "—"}</b><small class="${g.fuelHose ? "ok" : "dim"}">${g.fuelHose ? t("Fuel hose connected") : t("No fuel hose")}</small>${o?.fuel?.block ? `<small class="dim">${t("Planned block fuel {n}", { n: Math.round(o.fuel.block).toLocaleString() + " " + (o.units || "kg") })}</small>` : ""}</div>
      <div class="card ta-k"><span class="lbl">${t("Parking brake")}</span><b>${SIM.d.parkingBrake ? t("Set") : t("Released")}</b><small class="dim">${SIM.d.pushback ? t("Pushback in progress") : SIM.d.onGround ? t("On the ground") : t("In the air")}</small></div>
    </div>
    <div class="ta-board">${ORDER.map((k) => { const v = sv[k] ?? 0, [lbl, cls] = ST[v] || ST[0]; return `<div class="ta-row ${cls}"><span class="ta-dot"></span><b>${esc(t(GSX_NAMES[k]))}</b><span class="ta-st">${esc(t(lbl))}</span>
      ${v === 1 ? `<button class="btn small${k === "boarding" || k === "pushback" ? " pri" : ""}" data-gsx="${k}" ${busy ? "disabled" : ""}>${busy === k ? t("Calling…") : t("Call")}</button>` : "<span></span>"}</div>`; }).join("")}</div>
    <div class="card ta-bill"><div class="lbl">${t("Handling estimate")}</div>${used.length ? `${used.map((k) => `<div><span>${esc(t(GSX_NAMES[k]))}</span><b class="num">€ ${PRICE[k]}</b></div>`).join("")}<div class="tot"><span>${t("Total")}</span><b class="num">€ ${used.reduce((s, k) => s + PRICE[k], 0).toLocaleString()}</b></div>` : `<div class="dim">${t("Nothing used yet.")}</div>`}
      <small class="dim">${t("Own estimate for the services used – not a real invoice.")}</small></div>`;
}
function menu(g) {
  return `<div class="card"><div class="lbl" style="margin-bottom:8px">${t("GSX menu in the simulator")}</div>
    ${g.menuOpen && g.menu?.length ? `<b>${esc(g.menu[0])}</b><div class="ta-menu">${g.menu.slice(1).map((l, i) => `<button class="btn" data-gsxm="${i + 1}">${i + 1}. ${esc(l)}</button>`).join("")}</div>`
      : `<p class="dim">${t("The GSX menu is closed. Open it here to answer questions like the pushback direction or the operator.")}</p>`}
    <button class="btn pri" data-gsxm="open">${t("Open GSX menu")}</button></div>`;
}
function setup() {
  const base = bridgeBase();
  return `<div class="card ta-setup"><h2>${t("Connect the simulator")}</h2>
    <ol><li>${t("Start the VDGS bridge on the simulator PC (VDGS-Setup from flightsim.to, or vdgs_bridge.py).")}</li>
      <li>${t("Open the pad from the bridge: scan the QR code and add /pad/ to the address, e.g. http://192.168.1.20:8770/pad/")}</li>
      <li>${t("Start MSFS with GSX Pro. The board fills itself.")}</li></ol>
    <p class="dim">${base ? t("Bridge: {b}", { b: esc(base) }) + (SIM.d ? " · " + t("connected") : " · " + t("no answer")) : t("This pad is not opened from the bridge. On GitHub Pages the browser may not reach the home network.")}</p>
    <button class="btn small" data-do="sim-settings">${t("Bridge address in Settings")}</button></div>`;
}
export function summary() { const g = SIM.d?.gsx; return [t("Turnaround"), !SIM.base ? t("Not connected") : g?.running ? t("GSX running") : SIM.ok ? t("GSX is not running") : t("Simulator not connected")]; }
