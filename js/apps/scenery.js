// Scenery: a swipe deck through the airports of the Air Serbia network (va/routes.json). Swipe right = I want to fly
// there, left = skip, up = I already have scenery for it. Your choices stay on this device (asl.scenery) and are listed
// with a link to search sceneries for that airport on flightsim.to.
import { S, wxOf } from "../data.js";
import { t } from "../i18n.js";
import { esc, store } from "../util.js";

export const name = "Scenery";
export const tabs = [["deck", "Discover"], ["mine", "My airports"]];
const V = () => store.get("asl.scenery", {}); // icao → "like" | "skip" | "have"
const vote = (icao, v) => { const x = V(); x[icao] = v; store.set("asl.scenery", x); };
const airports = () => Object.entries(S.routes?.airports || {}).map(([icao, a]) => ({ icao, ...a })).filter((a) => a.icao !== (S.routes?.base || "LYBE"));
const find = (icao) => `https://flightsim.to/search/${encodeURIComponent(icao)}`;

export function render(body, ctx) {
  if (!body._sc) { body._sc = true;
    body.addEventListener("click", (e) => { const b = e.target.closest("[data-vote]"); if (b) { vote(b.dataset.icao, b.dataset.vote); ctx.changed("view"); return; }
      if (e.target.closest("[data-reset]")) { store.set("asl.scenery", {}); ctx.changed("view"); } });
    let x0 = null, y0 = null;
    body.addEventListener("pointerdown", (e) => { if (e.target.closest(".sc-card")) { x0 = e.clientX; y0 = e.clientY; } });
    body.addEventListener("pointerup", (e) => { if (x0 == null) return; const dx = e.clientX - x0, dy = e.clientY - y0, card = body.querySelector(".sc-card"); x0 = null;
      if (!card) return; const v = dy < -80 && Math.abs(dy) > Math.abs(dx) ? "have" : dx > 80 ? "like" : dx < -80 ? "skip" : null; if (v) { vote(card.dataset.icao, v); ctx.changed("view"); } });
  }
  const all = airports(), v = V();
  if (!all.length) { body.innerHTML = `<div class="empty">${t("Loading…")}</div>`; return; }
  if (ctx.tab === "mine") {
    const row = (kind, label) => { const l = all.filter((a) => v[a.icao] === kind); return `<div class="card"><div class="lbl" style="margin-bottom:8px">${label} · ${l.length}</div>${l.map((a) => `<div class="sc-row"><b class="num">${a.icao}</b><span>${esc(a.name)}</span><span class="sp"></span><a class="btn small" href="${find(a.icao)}" target="_blank" rel="noopener">${t("Find scenery")} ↗</a></div>`).join("") || `<div class="dim">—</div>`}</div>`; };
    body.innerHTML = row("like", t("Want to fly")) + row("have", t("Scenery installed")) + `<button class="btn small" data-reset>${t("Start over")}</button>`;
    return;
  }
  const next = all.find((a) => !v[a.icao]);
  if (!next) { body.innerHTML = `<div class="sc-done"><h2>${t("You have seen every airport of the network.")}</h2><p class="dim">${t("Your list is under “My airports”.")}</p><button class="btn" data-reset>${t("Start over")}</button></div>`; return; }
  const w = wxOf(next.icao), left = all.filter((a) => !v[a.icao]).length;
  body.innerHTML = `<div class="sc-deck"><div class="sc-card" data-icao="${next.icao}"><span class="sc-icao num">${next.icao}</span><h2>${esc(next.name)}</h2>
      ${w?.raw ? `<div class="sc-wx num">${esc(w.raw)}</div>` : ""}<a class="btn small" href="${find(next.icao)}" target="_blank" rel="noopener">${t("Find scenery")} ↗</a>
      <small class="dim">${t("{n} airports left", { n: left })}</small></div>
    <div class="sc-btns"><button class="btn" data-vote="skip" data-icao="${next.icao}">✕ ${t("Skip")}</button><button class="btn" data-vote="have" data-icao="${next.icao}">✓ ${t("Have it")}</button><button class="btn pri" data-vote="like" data-icao="${next.icao}">♥ ${t("Want to fly")}</button></div>
    <p class="dim sc-hint">${t("Swipe right to like, left to skip, up if you already have scenery.")}</p></div>`;
}
export function summary() { const v = V(); return [t("Scenery"), t("{n} airports liked", { n: Object.values(v).filter((x) => x === "like").length })]; }
