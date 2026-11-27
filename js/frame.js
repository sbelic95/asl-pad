// The device frame: on a big computer screen the pad sits as a tablet on a crew-room desk, with a lock button on the
// top edge and two brightness buttons on the right edge; next to it lies the crew ID card of the signed-in pilot.
// On tablets, phones and as an installed app the pad stays full screen. Setting "frame": auto | on | off.
// Own design in Air Serbia colours. The logo on the card comes from pics.avs.io at runtime, like everywhere in the pad.
import { S, settings } from "./data.js";
import { t } from "./i18n.js";
import { esc } from "./util.js";
import { pilot } from "./account.js";

const RATIO = 1180 / 820, BEZEL = 16;
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const touch = () => matchMedia("(pointer: coarse)").matches && !matchMedia("(pointer: fine)").matches;
export function framed() {
  if (settings.frame === "off") return false;
  if (settings.frame === "on") return innerWidth >= 900 && innerHeight >= 620;
  return innerWidth >= 1400 && innerHeight >= 880 && !standalone() && !touch();
}

let was = null;
export function applyFrame() {
  const on = framed(), root = document.documentElement;
  document.body.classList.toggle("framed", on);
  if (on) {
    const h = Math.min(innerHeight - 64, (innerWidth - 120) / RATIO + 2 * BEZEL), w = (h - 2 * BEZEL) * RATIO + 2 * BEZEL;
    root.style.setProperty("--dw", Math.round(w) + "px"); root.style.setProperty("--dh", Math.round(h) + "px");
    renderCard((innerWidth - w) / 2);
  }
  const changed = was !== null && was !== on;
  was = on; // before the event: the resize listener below calls applyFrame again
  if (changed) dispatchEvent(new Event("resize")); // maps and layouts measure again
}

// the crew ID card on the desk, only where there is room left of the tablet
function renderCard(room) {
  const c = document.getElementById("crewcard");
  if (!c) return;
  c.hidden = room < 250;
  if (c.hidden) return;
  const d = pilot(), o = S.ofp;
  const name = d?.name || t("Crew"), id = d?.pilotId || d?.callsign || "";
  c.innerHTML = `<div class="cc-strap"></div><div class="cc-clip"></div><div class="cc-card">
    <div class="cc-top"><span class="vbrand"><img src="https://pics.avs.io/240/80/JU.png" alt="" referrerpolicy="no-referrer" onerror="this.remove()"><span class="vword">Virtual</span></span><span>${t("Air Serbia Virtual crew")}</span></div>
    <div class="cc-photo">${esc(initials(name))}</div>
    <div class="cc-name">${esc(name)}</div>
    <div class="cc-rank">${esc(d?.rank || "")}</div>
    ${id ? `<div class="cc-row"><span>${t("Pilot ID")}</span><b class="num">${esc(id)}</b></div>` : ""}
    ${o ? `<div class="cc-row"><span>${t("Today")}</span><b class="num">${esc(o.callsign || "")} ${esc(o.dep?.icao || "")}–${esc(o.dest?.icao || "")}</b></div>` : ""}
    <div class="cc-bar"></div></div>`;
}
const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "JU";

export function initFrame({ lock, unlock, isLocked, brighter }) {
  document.querySelector(".dv-power")?.addEventListener("click", () => (isLocked() ? unlock() : lock()));
  document.querySelectorAll(".dv-vol").forEach((b) => b.addEventListener("click", () => brighter(+b.dataset.step)));
  addEventListener("resize", () => { const on = framed(); if (on !== was || on) applyFrame(); });
  applyFrame();
}
