// Browser: a start page with the services a crew needs, opened in a new browser tab – most of these sites do not allow
// being shown inside another page, so the pad does not pretend to. Plus an address field for any https address.
import { t } from "../i18n.js";
import { esc, store } from "../util.js";

export const name = "Browser";
export const tabs = [];
const LINKS = [
  ["Air Serbia Virtual", "https://airserbiavirtual.online", "The airline's website", "#002e5d"],
  ["vAMSYS", "https://vamsys.io", "Bookings, PIREPs and your pilot profile", "#2b59c3"],
  ["SimBrief", "https://dispatch.simbrief.com/home", "Plan the flight and print the OFP", "#24406b"],
  ["VATSIM", "https://my.vatsim.net", "Your VATSIM account and events", "#1a8a5a"],
  ["IVAO", "https://www.ivao.aero", "The IVAO network", "#0d2c99"],
  ["Navigraph Charts", "https://charts.navigraph.com", "Charts with your Navigraph account", "#16354f"],
  ["Hoppie ACARS", "https://www.hoppie.nl/acars/", "Logon code for ACARS and CPDLC", "#5a4a14"],
  ["Aviation Weather", "https://aviationweather.gov", "METAR, TAF, SIGMET and charts", "#0b6bdf"],
  ["flightsim.to", "https://flightsim.to", "Liveries, sceneries and add-ons", "#7a1fa2"],
];
const hist = () => store.get("asl.browser.hist", []);
function go(u) {
  let x = u.trim(); if (!x) return;
  if (!/^https?:\/\//i.test(x)) x = /\s/.test(x) || !/\./.test(x) ? "https://duckduckgo.com/?q=" + encodeURIComponent(x) : "https://" + x;
  if (!/^https:\/\//i.test(x)) x = x.replace(/^http:/i, "https:");
  store.set("asl.browser.hist", [x, ...hist().filter((h) => h !== x)].slice(0, 8));
  window.open(x, "_blank", "noopener");
}
export function render(body, ctx) {
  if (!body._br) { body._br = true;
    body.addEventListener("submit", (e) => { e.preventDefault(); go(body.querySelector(".br-url").value); ctx.changed("view"); });
    body.addEventListener("click", (e) => { const a = e.target.closest("[data-go]"); if (a) { e.preventDefault(); go(a.dataset.go); ctx.changed("view"); } });
  }
  if (body.querySelector(".br-url") === document.activeElement) return; // keep what the pilot is typing
  body.innerHTML = `<form class="br-bar"><input class="br-url" type="url" inputmode="url" placeholder="${t("Search or enter an address")}" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn pri">${t("Open")}</button></form>
    <div class="lbl" style="margin:18px 0 10px">${t("Crew services")}</div>
    <div class="br-grid">${LINKS.map(([n, u, d, c]) => `<a class="br-tile" href="${u}" data-go="${u}"><span class="br-ic" style="background:${c}">${esc(n[0])}</span><b>${esc(n)}</b><small>${esc(t(d))}</small></a>`).join("")}</div>
    ${hist().length ? `<div class="lbl" style="margin:18px 0 10px">${t("Recently opened")}</div><div class="br-hist">${hist().map((h) => `<a href="${esc(h)}" data-go="${esc(h)}">${esc(h.replace(/^https:\/\//, ""))}</a>`).join("")}</div>` : ""}
    <p class="dim br-note">${t("Pages open in a new browser tab: most services do not allow being shown inside the pad.")}</p>`;
}
export function summary() { return [t("Browser"), t("Crew services")]; }
