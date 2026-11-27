// Checklist: the normal checklists of Air Serbia Virtual per aircraft type (va/checklists.json, kept by the VA – today the
// A320 family from the VA's card of February 2022). Items stay in English as on the card. Where the pad knows the value it
// shows it next to the item (fuel from the OFP, QNH from the METAR); the pilot still checks it in the aircraft.
// Ticks are kept per flight and type on this device.
import { S, wxOf } from "../data.js";
import { t } from "../i18n.js";
import { esc, store } from "../util.js";
import { vaFile, pickedType, pickType, blockFor, typePicker, FLEET_TYPES } from "../fleet.js";

export const name = "Checklist";
export const tabs = [];
let sec = null, lastType = "";
const key = (ty) => "asl.chk." + ty + "." + (S.ofp ? `${S.ofp.callsign}.${S.ofp.dep?.icao}.${S.ofp.dest?.icao}.${new Date(S.ofp.times?.out || Date.now()).toISOString().slice(0, 10)}` : "free");
function hint(kind) {
  const o = S.ofp;
  if (kind === "fuel" && o?.fuel?.block) return `${Math.round(o.fuel.block).toLocaleString()} ${(o.units || "kg").toUpperCase()} ${t("(block fuel, OFP)")}`;
  if (kind === "qnhDep" || kind === "qnhArr") { const icao = kind === "qnhDep" ? o?.dep?.icao : o?.dest?.icao, w = icao && wxOf(icao); return w?.qnh ? `Q${w.qnh} · ${icao}` : ""; }
  return "";
}
export function render(body, ctx) {
  if (!body._ck) { body._ck = true; body.addEventListener("click", (e) => {
    const ty = e.target.closest("[data-efbtype]"); if (ty) { pickType("checklist", ty.dataset.efbtype); sec = null; ctx.changed("view"); return; }
    const s = e.target.closest("[data-sec]"); if (s) { sec = +s.dataset.sec; ctx.changed("view"); return; }
    const it = e.target.closest("[data-item]"); if (it) { const k = key(pickedType("checklist")), d = store.get(k, {}); d[it.dataset.item] = !d[it.dataset.item]; store.set(k, d); ctx.changed("view"); return; }
    if (e.target.closest("[data-do=ck-reset]")) { store.del(key(pickedType("checklist"))); sec = 0; ctx.changed("view"); }
  }); }
  const data = vaFile("checklists", () => ctx.changed("view")), ty = pickedType("checklist");
  if (ty !== lastType) { lastType = ty; sec = null; }
  const pick = typePicker("checklist", FLEET_TYPES.some(([k]) => k === ty) ? ty : "");
  if (!data) { body.innerHTML = pick + `<div class="dim">${t("Loading…")}</div>`; return; }
  const cl = blockFor(data, ty);
  if (!cl) { body.innerHTML = pick + `<div class="card ck-none"><h2>${esc(ty)}</h2><p class="dim">${t("Air Serbia Virtual has not published a checklist for this type in the pad yet. Use the checklist of your aircraft.")}</p></div>`; return; }
  const done = store.get(key(ty), {}), list = cl.sections;
  const secDone = (i) => list[i][1].every((_, j) => done[`${i}.${j}`]);
  if (sec == null || sec >= list.length) { sec = list.findIndex((_, i) => !secDone(i) && !list[i][2]); if (sec < 0) sec = 0; }
  const [title, items, optional] = list[sec];
  body.innerHTML = pick + `<div class="ck"><div class="ck-nav">${list.map(([n, , opt], i) => `<button data-sec="${i}" class="${i === sec ? "on" : ""} ${secDone(i) ? "done" : ""}">${secDone(i) ? "✓ " : ""}${esc(n.toUpperCase())}${opt ? ` <small>${t("if needed")}</small>` : ""}</button>`).join("")}
      <button class="btn small" data-do="ck-reset">${t("Reset checklist")}</button></div>
    <div class="ck-card"><div class="ck-h"><span class="lbl">${esc(cl.name)} · ${t("Normal checklist")}${S.ofp ? " · " + esc(S.ofp.callsign) : ""}</span><h2>${esc(title.toUpperCase())}</h2>${optional ? `<span class="dim">${t("Only when the departure changes")}</span>` : ""}</div>
      ${items.map(([item, resp, kind, memo], j) => { const id = `${sec}.${j}`, h = kind ? hint(kind) : ""; return `<button class="ck-i ${done[id] ? "ok" : ""}" data-item="${id}"><span class="ck-box">${done[id] ? "✓" : ""}</span>
        <span class="ck-t">${esc(item.toUpperCase())}</span><span class="ck-dots"></span><span class="ck-r">${esc(resp)}</span>${h ? `<span class="ck-hint">${esc(h)}</span>` : ""}
        ${memo ? `<span class="ck-memo">${memo.map((m) => `– ${esc(m)}`).join("<br>")}</span>` : ""}</button>`; }).join("")}
      <div class="ck-foot">${secDone(sec) ? `<b class="ok">${t("{s} complete", { s: title.toUpperCase() })}</b>` : `<span class="dim">${t("Tap an item when it is done.")}</span>`}
        ${sec < list.length - 1 ? `<button class="btn${secDone(sec) ? " pri" : ""}" data-sec="${sec + 1}">${t("Next")}: ${esc(list[sec + 1][0].toUpperCase())}</button>` : ""}</div></div>
    <p class="dim ck-src">${esc(cl.issue || "")} · ${t("For flight simulation only.")}</p></div>`;
}
export function summary() { return [t("Checklist"), pickedType("checklist")]; }
