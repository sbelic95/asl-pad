// ASL Fly · Performance: SimBrief's runway analysis (TLR) for take-off and landing,
// shown for the runway in use (ATIS, CDM, wind) and checked against the weather now.
import { S, wxOf, runwayOf } from "../data.js";
import { t, nf } from "../i18n.js";
import { esc, rad, clamp } from "../util.js";
import { fmtW } from "../units.js";
import { coldHtml } from "../cold.js";

export const sel = { key: "", to: "", ldg: "" }; // runway the pilot picked, per flight

const norm = (id) => String(id || "").toUpperCase().replace(/^0(\d)/, "$1");
const find = (list, id) => (id ? list.find((r) => norm(r.id) === norm(id)) : null);
const M_FT = 3.28084;
const len = (m) => (m == null ? "—" : `${nf(m)}<small>m</small>`);
const lenS = (m) => (m == null ? "" : nf(Math.round(m * M_FT / 10) * 10) + " ft");
const tile = (l, v, cls = "") => `<div class="vs ${cls}"><div class="lbl">${esc(l)}</div><div class="vv">${v == null ? "—" : v}</div></div>`;
const cell = (l, v, s, cls = "") => `<div><div class="lbl">${esc(l)}</div><div class="v ${cls}">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
// head- and crosswind of the wind now on a runway (METAR wind is true, so is the course)
function comp(w, course) {
  if (!w || w.wspd == null || course == null) return null;
  if (w.vrb || w.wdir == null) return { hw: -w.wspd, xw: 0, gust: w.gust ? w.gust - w.wspd : 0, vrb: true }; // variable: count it as tailwind
  const a = rad(w.wdir - course);
  return { hw: Math.round(Math.cos(a) * w.wspd), xw: Math.round(Math.sin(a) * w.wspd), gust: w.gust ? w.gust - w.wspd : 0 };
}
const windTxt = (c) => (!c ? "—" : `${c.hw >= 0 ? t("head") + " " + c.hw : t("tail") + " " + -c.hw} · ${t("cross")} ${Math.abs(c.xw)}${c.xw ? (c.xw > 0 ? " R" : " L") : ""}`);
const isWet = (w) => !!w && /(RA|DZ|SN|SG|PL|GR|GS|TS|UP)/.test(w.wx || "");

function chips(side, list, pick, tags) {
  return `<div class="rw-chips">${list.map((r) => `<button data-do="rwy" data-side="${side}" data-id="${esc(r.id)}" class="${r === pick ? "on" : ""}">${esc(r.id)}${tags[norm(r.id)] ? `<small>${esc(tags[norm(r.id)])}</small>` : ""}</button>`).join("")}</div>`;
}
function tagsFor(icao, side, planned) {
  const tags = {}, r = runwayOf(icao, side);
  if (planned) tags[norm(planned)] = t("plan");
  if (r?.rwy) tags[norm(r.rwy)] = r.src === "ATIS" ? "ATIS" : r.src === "wind" ? t("wind") : t("plan");
  if (side === "dep" && S.cdm?.rwy) tags[norm(S.cdm.rwy)] = "CDM";
  return tags;
}

// runway chosen for take-off and landing: the pilot's pick, else CDM / ATIS / wind, else SimBrief's plan
const mine = (o, side) => (sel.key === o.id + o.callsign ? sel[side] : "");
export function toPick(o) {
  const T = o.tlr?.to; if (!T?.rwys?.length) return null;
  return find(T.rwys, mine(o, "to")) || find(T.rwys, S.cdm?.rwy) || find(T.rwys, runwayOf(o.dep.icao, "dep")?.rwy) || find(T.rwys, T.cond.rwy) || T.rwys[0];
}
export function ldgPick(o) {
  const L = o.tlr?.ldg; if (!L || (!L.dry && !L.wet)) return null;
  const r = find(L.rwys, mine(o, "ldg")) || find(L.rwys, runwayOf(o.dest.icao, "arr")?.rwy) || find(L.rwys, L.cond.rwy) || L.rwys[0] || {};
  const w = wxOf(o.dest.icao), now = comp(w, r.course), wet = isWet(w) || L.cond.surface === "wet";
  const D = wet && L.wet ? L.wet : L.dry || L.wet;
  // approach speed: Airbus VLS + 1/3 headwind (5 to 15 kt); others Vref + half the headwind + gust (5 to 20 kt)
  const airbus = /^A(19|2|3)/.test(o.type);
  const hw = Math.max(0, now?.hw ?? L.cond.wspd ?? 0), gust = now?.gust || 0;
  const add = D?.vref != null ? Math.round(airbus ? clamp(hw / 3, 5, 15) : clamp(hw / 2 + gust, 5, 20)) : null;
  return { r, w, now, wet, D, airbus, add, vapp: add != null ? D.vref + add : null };
}

export function perfView(o) {
  const T = o.tlr;
  if (!T || (!T.to?.rwys?.length && !T.ldg?.rwys?.length && !T.ldg?.dry)) return noTlr() + coldHtml(o);
  const k = o.id + o.callsign;
  if (sel.key !== k) { sel.key = k; sel.to = ""; sel.ldg = ""; }
  return `${T.to?.rwys?.length ? takeoff(o, T.to) : ""}${T.ldg ? landing(o, T.ldg) : ""}${coldHtml(o)}
    <p class="dim" style="font-size:12px;margin:14px 2px 0">${t("Values from SimBrief's runway analysis for your OFP. Check them against your aircraft (for example the EFB of the Fenix) before you use them – for flight simulation only.")}</p>`;
}

function noTlr() {
  return `<div class="card" style="max-width:640px;margin:6vh auto;padding:26px">
    <h2 style="margin:0 0 8px;font:700 24px var(--f-cond)">${t("No take-off and landing data in this OFP")}</h2>
    <p class="dim" style="margin:0 0 10px">${t("SimBrief calculates V1, VR, V2, flaps, FLEX and the landing distance when the runway analysis is switched on.")}</p>
    <ol style="margin:0;padding-left:20px;line-height:1.7">
      <li>${t("In SimBrief, open the new flight plan.")}</li><li>${t("Switch on the runway analysis (take-off and landing performance).")}</li>
      <li>${t("Generate the OFP again – ASL Pad loads it within five minutes, or tap refresh.")}</li></ol>
    <p class="dim" style="font-size:12.5px;margin:12px 0 0">${t("Not every aircraft profile in SimBrief has performance data.")}</p></div>`;
}

function takeoff(o, T) {
  const icao = o.dep.icao, tags = tagsFor(icao, "dep", T.cond.rwy);
  const r = toPick(o), w = wxOf(icao), now = comp(w, r.course);
  const tow = T.cond.w ?? o.weights.tow;
  const warn = [];
  if (r.maxW != null && tow != null && tow > r.maxW) warn.push(["bad", t("Take-off weight above the limit of this runway.")]);
  if (w?.temp != null && r.maxTemp != null && w.temp > r.maxTemp) warn.push(["bad", t("OAT {o}° is above the maximum temperature {m}° for this runway.", { o: w.temp, m: r.maxTemp })]);
  else if (w?.temp != null && r.flex != null && w.temp >= r.flex) warn.push(["bad", t("OAT {o}° is not below FLEX {f}° – use TOGA or calculate again.", { o: w.temp, f: r.flex })]);
  if (now && r.hw != null && now.hw < -5 && now.hw < r.hw - 3) warn.push(["warn", t("Tailwind {n} kt now – SimBrief calculated with {c} kt. Calculate again.", { n: -now.hw, c: r.hw })]);
  else if (now && r.hw != null && now.hw < r.hw - 10) warn.push(["warn", t("Wind now is much less favourable than calculated.")]);
  if (T.cond.surface === "dry" && isWet(w)) warn.push(["warn", t("Precipitation now – SimBrief calculated a dry runway.")]);
  const thrust = /flex|d-?to|derate/i.test(r.thrust) && r.flex != null ? `${esc(r.thrust)} ${r.flex}°` : esc(r.thrust || "—");
  return `<div class="card perf"><div class="perf-h"><div><div class="lbl">${t("Take-off")}</div><div class="perf-apt">${esc(icao)} <span>RWY ${esc(r.id)}</span></div></div>${chips("to", T.rwys, r, tags)}</div>
    <div class="vrow">${tile("V1", r.v1)}${tile("VR", r.vr)}${tile("V2", r.v2)}${r.other != null ? tile(r.otherId || t("Other"), r.other, "sm") : ""}
      ${tile(t("Flaps"), esc(r.flaps || "—"), "txt")}${tile(t("Thrust"), thrust, "txt")}</div>
    ${warn.map(([c, x]) => `<div class="perf-w ${c}">${esc(x)}</div>`).join("")}
    <div class="kv" style="margin-top:14px">
      ${cell("TOW", fmtW(tow, o), r.maxW != null ? t("max {m}", { m: fmtW(r.maxW, o, { bare: true }) }) + (r.limit ? " · " + t("limit {c}", { c: esc(r.limit) }) : "") : "", r.maxW != null && tow > r.maxW ? "bad" : "")}
      ${cell("TORA", len(r.tora ?? r.len), lenS(r.tora ?? r.len))}${cell(t("Bleed / anti-ice"), `${esc(r.bleed || "—")} / ${esc(r.antiIce || "—")}`)}
      ${cell(t("Wind (calculated)"), r.hw != null ? windTxt({ hw: r.hw, xw: r.xw ?? 0 }) : "—")}
      ${cell(t("Wind now"), windTxt(now), w?.wspd != null ? `${w.vrb ? "VRB" : String(w.wdir).padStart(3, "0")}/${w.wspd}${w.gust ? "G" + w.gust : ""} kt` : "", now && r.hw != null && now.hw < r.hw - 5 ? "warn" : "")}
      ${cell("OAT", w?.temp != null ? w.temp + "°C" : "—", t("calculated {t}°", { t: T.cond.temp ?? "—" }) + (r.maxTemp != null ? " · " + t("max {m}", { m: r.maxTemp + "°" }) : ""), w?.temp != null && r.flex != null && w.temp >= r.flex ? "bad" : "")}
    </div>
    <div class="dim" style="font-size:12px;margin-top:10px">${t("Calculated for")}: ${T.cond.wdir != null ? String(T.cond.wdir).padStart(3, "0") + "/" + T.cond.wspd + " kt · " : ""}${T.cond.temp != null ? T.cond.temp + "°C · " : ""}${T.cond.alt ? (T.cond.alt > 100 ? "Q" + Math.round(T.cond.alt) : "A" + T.cond.alt.toFixed(2)) + " · " : ""}${esc(t(T.cond.surface || "dry"))}${r.elev != null ? " · " + t("elevation {e} ft", { e: nf(r.elev) }) : ""}</div></div>`;
}

function landing(o, L) {
  const icao = o.dest.icao, tags = tagsFor(icao, "arr", L.cond.rwy);
  const { r, w, now, wet, D, airbus, add } = ldgPick(o) || { r: L.rwys[0] || {}, w: wxOf(icao), now: null, wet: false, D: null, airbus: false, add: null };
  const ldw = L.cond.w ?? o.weights.ldw;
  const lda = r.lda ?? r.len;
  const row = (lbl, d, on) => {
    if (!d) return "";
    const m = lda != null && d.factored != null ? lda - d.factored : null;
    return `<tr class="${on ? "next" : ""}"><td class="id">${lbl}</td><td>${esc(d.flaps || "—")}</td><td>${esc(d.brake || "—")}</td><td class="r">${d.vref ?? "—"}</td>
      <td class="r">${nf(d.actual)} m</td><td class="r"><b>${nf(d.factored)} m</b></td><td class="r ${m == null ? "" : m < 0 ? "bad" : m < 300 ? "warn" : "ok"}">${m == null ? "—" : (m > 0 ? "+" : "") + nf(m) + " m"}</td></tr>`;
  };
  const maxW = wet ? r.maxWWet ?? r.maxWDry : r.maxWDry ?? r.maxWWet;
  const warn = [];
  if (maxW != null && ldw != null && ldw > maxW) warn.push(["bad", t("Landing weight above the limit of this runway.")]);
  if (lda != null && D?.factored != null && D.factored > lda) warn.push(["bad", t("Factored landing distance is longer than the runway.")]);
  if (now && now.hw < -10) warn.push(["warn", t("Tailwind {n} kt on this runway.", { n: -now.hw })]);
  if (now && Math.abs(now.xw) > 25) warn.push(["warn", t("Crosswind {n} kt.", { n: Math.abs(now.xw) })]);
  return `<div class="card perf"><div class="perf-h"><div><div class="lbl">${t("Landing")}</div><div class="perf-apt">${esc(icao)} <span>${r.id ? "RWY " + esc(r.id) : ""}</span></div></div>${L.rwys.length ? chips("ldg", L.rwys, r, tags) : ""}</div>
    <div class="vrow">${tile("VREF", D?.vref)}${add != null ? tile("VAPP", D.vref + add, "acc") : ""}${tile(t("Flaps"), esc(D?.flaps || L.cond.flaps || "—"), "txt")}${tile(t("Autobrake"), esc(D?.brake || "—"), "txt")}
      ${r.ils ? tile("ILS", esc(r.ils), "txt") : ""}</div>
    ${add != null ? `<div class="dim" style="font-size:12px;margin-top:6px">${airbus ? t("VAPP ≈ VLS + {a} kt (a third of the headwind, 5–15 kt).", { a: add }) : t("VAPP ≈ VREF + {a} kt (half the headwind plus gust, 5–20 kt).", { a: add })}</div>` : ""}
    ${warn.map(([c, x]) => `<div class="perf-w ${c}">${esc(x)}</div>`).join("")}
    <table class="t" style="margin-top:12px"><thead><tr><th>${t("Runway")}</th><th>${t("Flaps")}</th><th>${t("Autobrake")}</th><th class="r">VREF</th><th class="r">${t("Actual")}</th><th class="r">${t("Factored")}</th><th class="r">${t("Margin")}</th></tr></thead>
      <tbody>${row(t("dry"), L.dry, !wet)}${row(t("wet"), L.wet, wet)}</tbody></table>
    <div class="kv" style="margin-top:14px">
      ${cell("LDW", fmtW(ldw, o), maxW != null ? t("max {m}", { m: fmtW(maxW, o, { bare: true }) }) : "", maxW != null && ldw > maxW ? "bad" : "")}
      ${cell("LDA", len(lda), lenS(lda))}${cell(t("Reverser credit"), esc(D?.rev || "—"))}
      ${cell(t("Wind now"), windTxt(now), w?.wspd != null ? `${w.vrb ? "VRB" : String(w.wdir).padStart(3, "0")}/${w.wspd}${w.gust ? "G" + w.gust : ""} kt` : "", now && now.hw < -5 ? "warn" : "")}
      ${cell(t("Runway condition"), wet ? `<span class="warn">${t("wet")}</span>` : t("dry"), isWet(w) ? esc(w.wx) : "")}</div></div>`;
}
