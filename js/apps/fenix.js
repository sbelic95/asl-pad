// Fenix EFB: the Fenix A319/A320/A321 runs its own EFB as a web page on the simulator PC (port 8083). The pad shows
// whether the Fenix is running (through the bridge), opens that EFB, and compares the simulator's fuel and weight with
// the SimBrief plan. The EFB belongs to Fenix Simulations; the pad only links to it.
import { S } from "../data.js";
import { t } from "../i18n.js";
import { esc } from "../util.js";
import { SIM } from "../sim.js";

export const name = "Fenix EFB";
export const tabs = [];
const efbUrl = () => { try { const u = new URL(SIM.base); return `${u.protocol}//${u.hostname === "localhost" ? "localhost" : u.hostname}:8083/`; } catch { return ""; } };

export function render(body, ctx) {
  if (!body._fx) { body._fx = true; body.addEventListener("click", (e) => { if (e.target.closest("[data-do=fx-settings]")) ctx.open("settings"); }); }
  const f = SIM.d?.fenix, url = efbUrl(), o = S.ofp, d = SIM.d;
  if (!SIM.base || !d) {
    body.innerHTML = `<div class="card fx-card"><h2>${t("Fenix EFB")}</h2><p class="dim">${t("Open the pad from the VDGS bridge on the simulator PC to see the Fenix here. The Fenix EFB itself runs on that PC on port 8083.")}</p>
      <button class="btn small" data-do="fx-settings">${t("Bridge address in Settings")}</button></div>`;
    return;
  }
  const row = (k, v, plan) => `<div class="fx-row"><span>${k}</span><b class="num">${v}</b><span class="dim">${plan || ""}</span></div>`;
  const kg = (v) => (v == null ? "—" : Math.round(v).toLocaleString() + " kg");
  body.innerHTML = `<div class="fx-grid"><div class="card fx-card"><div class="fx-h"><span class="fx-dot ${f?.running ? "on" : ""}"></span><h2>${t("Fenix EFB")}</h2></div>
      <p class="dim">${f?.running ? t("The Fenix app is running on the simulator PC.") : t("The Fenix app is not running on the simulator PC (port 8083 does not answer).")}</p>
      ${f?.running && url ? `<a class="btn pri" href="${esc(url)}" target="_blank" rel="noopener">${t("Open the Fenix EFB")} ↗</a>` : ""}
      ${f?.refs ? `<div class="fx-refs">${Object.entries(f.refs).map(([k, v]) => `<div><span class="dim">${esc(k.replace(/^fenix\./, ""))}</span><b>${esc(String(v))}</b></div>`).join("")}</div>` : ""}
      <small class="dim">${t("The EFB belongs to Fenix Simulations – the pad only opens it.")}</small></div>
    <div class="card fx-card"><div class="lbl">${t("Simulator and plan")}</div>
      ${row(t("Aircraft"), esc(d.title || "—"), o ? esc(`${o.type} ${o.reg || ""}`) : "")}
      ${row(t("Fuel on board"), kg(d.fuelKg), o?.fuel?.block ? t("Plan {n}", { n: kg(o.fuel.block) }) : "")}
      ${row(t("Weight"), kg(d.weightKg), o?.weights?.tow ? t("Planned TOW {n}", { n: kg(o.weights.tow) }) : "")}
      ${row("COM1", d.com1 ? d.com1.toFixed(3) : "—", "")}
      ${row(t("Squawk"), esc(d.squawk || "—"), "")}
      ${d.fuelKg != null && o?.fuel?.block ? (() => { const diff = d.fuelKg - o.fuel.block; return `<div class="fx-diff ${Math.abs(diff) > 300 ? "warn" : "ok"}">${diff >= 0 ? "+" : ""}${Math.round(diff).toLocaleString()} kg ${t("against the plan")}</div>`; })() : ""}</div></div>`;
}
export function summary() { const f = SIM.d?.fenix; return [t("Fenix EFB"), f?.running ? t("Fenix running") : SIM.base ? t("Fenix not running") : t("Not connected")]; }
