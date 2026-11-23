// Landing: the Air Serbia Virtual wind component calculator (from the VA's spreadsheet) for every aircraft type, and the
// landing data per type from va/landing.json (kept by the VA – today the Embraer E190/E195 from the VA's "Landing Data &
// Performance Tables"): wind limits, autobrake/reverse/flap by runway condition, Vapp wind correction. Wind and runway come
// from the destination's METAR and the runway data; the pilot can type their own. Take-off and landing performance for
// every type is in ASL Fly → Performance (SimBrief runway analysis). For flight simulation only.
import { S, wxOf, runwayOf } from "../data.js";
import { t } from "../i18n.js";
import { esc, store } from "../util.js";
import { runwaysAt } from "../wx.js";
import { vaFile, pickedType, pickType, blockFor, typePicker, FLEET_TYPES } from "../fleet.js";

export const name = "Landing";
export const tabs = [["wind", "Wind component"], ["data", "Landing data"]];
let F = store.get("asl.landing", { rwy: "", hdg: "", wdir: "", wspd: "", gust: "", vref: "", cond: "", auto: true });
const save = () => store.set("asl.landing", F);
const num = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);
// the same maths as the VA spreadsheet, with the wind side taken over the shortest angle (also across 360°)
export function windComp(hdg, wdir, wspd) {
  if (hdg == null || wdir == null || wspd == null) return null;
  const d = ((((wdir - hdg) % 360) + 540) % 360) - 180, a = (d * Math.PI) / 180;
  return { head: Math.round(Math.cos(a) * wspd * 10) / 10, cross: Math.round(Math.abs(Math.sin(a) * wspd) * 10) / 10, side: d > 0 ? "R" : d < 0 ? "L" : "" };
}
function auto() { // destination runway and wind from the METAR
  const icao = S.ofp?.dest?.icao; if (!icao) return {};
  const w = wxOf(icao), r = runwayOf(icao, "arr"), ends = runwaysAt(icao), end = ends.find((e) => e.id === r?.rwy) || null;
  return { icao, rwy: end?.id || r?.rwy || "", hdg: end?.hdg ?? null, lenM: end ? Math.round(end.lenFt * 0.3048) : null, wdir: w?.wdir ?? null, wspd: w?.wspd ?? null, gust: w?.gust ?? null,
    wet: /(RA|DZ|SN|SG|PL|GR|GS|TS)/.test(w?.wx || ""), raw: w?.raw || "", ends };
}
const cur = () => { const A = auto(); return F.auto ? { rwy: A.rwy, hdg: A.hdg, wdir: A.wdir, wspd: A.wspd, gust: A.gust, A } : { rwy: F.rwy, hdg: num(F.hdg), wdir: num(F.wdir), wspd: num(F.wspd), gust: num(F.gust), A }; };
const field = (k, l, v, ph) => `<label class="ld-f"><span class="lbl">${l}</span><input data-lf="${k}" inputmode="numeric" value="${esc(v ?? "")}" placeholder="${esc(ph ?? "")}"></label>`;

let C = null; // the newest render context: the click handlers below must see the current tab
export function render(body, ctx) {
  C = ctx;
  if (!body._ld) { body._ld = true;
    body.addEventListener("input", (e) => { const k = e.target.dataset.lf; if (!k) return; F = { ...F, [k]: e.target.value, ...(k === "vref" ? {} : { auto: false }) }; save(); draw(body); });
    const redraw = () => { body.innerHTML = ""; render(body, C); };
    body.addEventListener("click", (e) => {
      const ty = e.target.closest("[data-efbtype]"); if (ty) { pickType("landing", ty.dataset.efbtype); redraw(); return; }
      const r = e.target.closest("[data-lrwy]"); if (r) { F = { ...F, rwy: r.dataset.lrwy, hdg: r.dataset.hdg, wdir: cur().wdir ?? "", wspd: cur().wspd ?? "", gust: cur().gust ?? "", auto: false }; save(); redraw(); return; }
      if (e.target.closest("[data-do=ld-auto]")) { F = { ...F, auto: true }; save(); redraw(); return; }
      if (e.target.closest("[data-do=ld-perf]")) { C.open("fly", "perf"); return; }
      const c = e.target.closest("[data-cond]"); if (c) { F = { ...F, cond: c.dataset.cond }; save(); redraw(); }
    });
  }
  const data = vaFile("landing", () => { body.innerHTML = ""; render(body, C); });
  const sig = ctx.tab + "|" + pickedType("landing") + "|" + (data ? 1 : 0);
  if (body.dataset.sig !== sig || !body.querySelector(".ld")) { body.dataset.sig = sig; body.innerHTML = ctx.tab === "data" ? dataHtml(data) : windHtml(data); }
  draw(body);
}
function windHtml(data) {
  const c = cur(), A = c.A, ty = pickedType("landing");
  return typePicker("landing", FLEET_TYPES.some(([k]) => k === ty) ? ty : "") + `<div class="ld" data-type="${esc(ty)}"><div class="card"><div class="ld-top"><div class="lbl">${A.icao ? t("Destination {a}", { a: esc(A.icao) }) : t("Runway and wind")}</div>
      ${A.icao ? `<button class="btn small${F.auto ? " pri" : ""}" data-do="ld-auto">${F.auto ? t("From METAR and runway data") : t("Use METAR again")}</button>` : ""}</div>
      ${A.ends?.length ? `<div class="rw-chips">${A.ends.map((e) => `<button data-lrwy="${esc(e.id)}" data-hdg="${e.hdg}" class="${e.id === c.rwy ? "on" : ""}">${esc(e.id)}</button>`).join("")}</div>` : ""}
      <div class="ld-grid">${field("hdg", t("Runway heading (°)"), c.hdg ?? "", "117")}${field("wdir", t("Wind direction (°)"), c.wdir ?? "", "050")}${field("wspd", t("Wind speed (kt)"), c.wspd ?? "", "12")}${field("gust", t("Gust (kt)"), c.gust ?? "", "—")}</div>
      ${A.raw && F.auto ? `<div class="ld-metar num">${esc(A.raw)}</div>` : ""}</div>
    <div class="ld-res"></div>
    <div class="card ld-perf"><span>${t("Take-off and landing performance for every type: SimBrief runway analysis in ASL Fly.")}</span><button class="btn small pri" data-do="ld-perf">${t("Open Performance")}</button></div>
    <p class="dim ld-src">${t("Air Serbia Virtual wind component calculator. Runway headings are true, like the METAR wind.")}</p></div>`;
}
function dataHtml(data) {
  const ty = pickedType("landing"), pick = typePicker("landing", FLEET_TYPES.some(([k]) => k === ty) ? ty : "");
  if (!data) return pick + `<div class="ld"><div class="dim">${t("Loading…")}</div></div>`;
  const L = blockFor(data, ty);
  if (!L) return pick + `<div class="ld"><div class="card"><h2>${esc(ty)}</h2><p class="dim">${t("Air Serbia Virtual has not published landing data for this type in the pad yet. Use the documents of your aircraft and the SimBrief runway analysis.")}</p>
    <button class="btn small pri" data-do="ld-perf">${t("Open Performance")}</button></div></div>`;
  const A = auto(), len = A.lenM, sug = F.cond || (A.wet ? "wet" : len != null ? (len > 1800 ? "dryLong" : "dryShort") : "dryLong"), lim = L.limits || {};
  return pick + `<div class="ld"><div class="card"><div class="lbl" style="margin-bottom:8px">${t("Information for landing")} · ${esc(L.name)}</div>
      ${L.info?.length ? `<ul class="ld-list">${L.info.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <div class="ld-lim">${lim.tailwind != null ? `<div><span class="lbl">${t("Tailwind")}</span><b>${lim.tailwind} kt</b></div>` : ""}${lim.crosswindDry != null ? `<div><span class="lbl">${t("Crosswind – dry")}</span><b>${lim.crosswindDry} kt</b></div>` : ""}${lim.crosswindWet != null ? `<div><span class="lbl">${t("Crosswind – wet")}</span><b>${lim.crosswindWet} kt</b></div>` : ""}</div></div>
    ${L.autobrake?.length ? `<div class="card"><div class="lbl" style="margin-bottom:8px">${t("Autobrake settings")}${A.icao ? ` · ${esc(A.icao)} ${esc(A.rwy || "")}${len ? ` · ${len} m` : ""}${A.wet ? " · " + t("wet") : ""}` : ""}</div>
      <table class="ld-tab"><tr><th>${t("Runway conditions")}</th><th>${t("Brakes")}</th><th>${t("Thrust reverse")}</th><th>${t("Flap")}</th></tr>
      ${L.autobrake.map(([c, b, r, f, k]) => `<tr class="${k === sug ? "on" : ""}" data-cond="${esc(k || "")}"><td>${esc(c)}</td><td><b>${esc(b)}</b></td><td>${esc(r)}</td><td>${esc(f)}</td></tr>`).join("")}</table>
      ${L.notes?.length ? `<ul class="ld-notes">${L.notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>` : ""}
    ${L.vapp ? `<div class="card"><div class="lbl" style="margin-bottom:8px">${t("Vapp wind correction")}</div><div class="dim" style="font-size:13px;margin-bottom:8px">V<sub>APP</sub> = V<sub>REF</sub> + ${t("wind correction")} · ${t("wind correction = ½ steady headwind + the full gust (min 5 kt, max 20 kt)")}</div>
      <div class="ld-grid">${field("vref", "VREF (kt)", F.vref, "128")}</div><div class="ld-vapp"></div></div>` : ""}
    <p class="dim ld-src">${esc(L.source || "")} · ${t("For flight simulation only.")}</p></div>`;
}
function draw(body) {
  const c = cur(), w = windComp(c.hdg, c.wdir, c.wspd), gust = c.gust != null && c.wspd != null ? Math.max(0, c.gust - c.wspd) : 0;
  const res = body.querySelector(".ld-res");
  if (res) {
    const L = blockFor(vaFile("landing"), pickedType("landing")), lim = L?.limits || {};
    if (!w) res.innerHTML = `<div class="card dim">${t("Enter runway heading, wind direction and speed.")}</div>`;
    else {
      const wet = c.A.wet, crossLim = wet ? lim.crosswindWet : lim.crosswindDry;
      const tailOver = lim.tailwind != null && w.head < 0 && -w.head > lim.tailwind, crossOver = crossLim != null && w.cross > crossLim;
      res.innerHTML = `<div class="ld-out"><div class="card ld-big ${w.head < 0 ? "tail" : ""} ${tailOver ? "over" : ""}"><span class="lbl">${w.head < 0 ? t("Tailwind") : t("Headwind")}</span><b class="num">${Math.abs(Math.round(w.head))} kt</b>${gust ? `<small>${t("gusts +{g} kt", { g: gust })}</small>` : ""}</div>
        <div class="card ld-big ${crossOver ? "over" : ""}"><span class="lbl">${t("Crosswind")}</span><b class="num">${w.side} ${Math.round(w.cross)} kt</b><small>${w.side === "R" ? t("from the right") : w.side === "L" ? t("from the left") : ""}</small></div></div>
        ${L && (lim.tailwind != null || crossLim != null) ? `<div class="card ld-chk ${tailOver || crossOver ? "bad" : "ok"}">${tailOver || crossOver ? "⚠ " : "✓ "}${t("Limits {n}: tailwind {t} kt, crosswind {c} kt ({s})", { n: esc(L.name), t: lim.tailwind ?? "—", c: crossLim ?? "—", s: wet ? t("wet") : t("dry") })}</div>`
        : `<div class="card dim">${t("No wind limits from Air Serbia Virtual for this type in the pad yet – check the limits of your aircraft.")}</div>`}`;
    }
  }
  const v = body.querySelector(".ld-vapp");
  if (v) {
    const vref = num(F.vref), corr = w ? Math.min(20, Math.max(5, Math.max(0, w.head) / 2 + gust)) : 5;
    v.innerHTML = vref ? `<div class="ld-out"><div class="card ld-big"><span class="lbl">${t("Wind correction")}</span><b class="num">+${Math.round(corr)} kt</b><small>${w ? t("headwind {h} kt, gust {g} kt", { h: Math.max(0, Math.round(w.head)), g: gust }) : t("no wind entered: minimum 5 kt")}</small></div>
      <div class="card ld-big"><span class="lbl">V<sub>APP</sub></span><b class="num">${Math.round(vref + corr)} kt</b></div></div>` : `<div class="dim">${t("Enter VREF from the aircraft's FMS or EFB.")}</div>`;
  }
}
export function summary() { const c = cur(), w = windComp(c.hdg, c.wdir, c.wspd); return [t("Landing"), w ? `${c.rwy || ""} ${w.head < 0 ? t("Tailwind") : t("Headwind")} ${Math.abs(Math.round(w.head))} · ${w.side} ${Math.round(w.cross)} kt` : t("Wind component")]; }
