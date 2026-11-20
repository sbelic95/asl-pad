// Kneeboard: the clearance, ATIS and frequencies the pilot writes down, free notes and a drawing pad – one page per flight.
// Pre-filled from the OFP where the OFP knows it. The page is built once and not rebuilt every 10 s, so typing and
// drawing are never interrupted; everything is saved as you write.
import { S } from "../data.js";
import { t } from "../i18n.js";
import { esc, store } from "../util.js";

export const name = "Kneeboard";
export const tabs = [["notes", "Notes"], ["draw", "Scratchpad"]];
const key = () => { const o = S.ofp; return "asl.kb." + (o ? `${o.callsign}.${o.dep.icao}.${o.dest.icao}` : "free"); };
const get = () => store.get(key(), {});
const put = (k, v) => store.set(key(), { ...get(), [k]: v });
const F = [["clr", [["dest", "Cleared to"], ["sid", "SID"], ["rwy", "Runway"], ["alt", "Initial climb"], ["sq", "Squawk"], ["dep", "Departure freq"]]],
  ["atisD", [["l", "ATIS"], ["q", "QNH"], ["w", "Wind"], ["tl", "Trans. level"]]], ["atisA", [["l", "ATIS"], ["q", "QNH"], ["w", "Wind"], ["rwy", "Runway"], ["app", "Approach"]]]];
function prefill() {
  const o = S.ofp; if (!o) return {};
  const sid = (o.navlog || []).find((x) => x.sidstar && /^[A-Z]{2,5}\d/.test(x.airway))?.airway || "";
  return { clr: { dest: o.dest.icao, sid, rwy: o.dep.rwy || "", alt: "" }, atisD: { tl: "" }, atisA: { rwy: o.dest.rwy || "" } };
}
export function render(body, ctx) {
  const tab = ctx.tab || "notes", k = key() + tab;
  if (body._kb === k) return; body._kb = k;
  const d = get(), pf = prefill();
  const val = (g, f) => d[g]?.[f] ?? pf[g]?.[f] ?? "";
  if (tab === "notes") {
    const o = S.ofp, box = (g, title) => `<div class="card kb-box"><div class="lbl">${title}</div><div class="kb-f">${F.find((x) => x[0] === g)[1].map(([f, l]) => `<label><span>${t(l)}</span><input data-g="${g}" data-f="${f}" value="${esc(val(g, f))}" autocapitalize="characters" spellcheck="false"></label>`).join("")}</div></div>`;
    body.innerHTML = `<div class="kb-head"><b>${o ? esc(`${o.iataNo || o.callsign} · ${o.dep.icao} → ${o.dest.icao}`) : t("No flight loaded")}</b><button class="btn small" data-kb="clear">${t("Clear page")}</button></div>
      <div class="kb-grid">${box("clr", t("Clearance"))}${box("atisD", t("Departure") + " · ATIS")}${box("atisA", t("Arrival") + " · ATIS")}
      <div class="card kb-box kb-notes"><div class="lbl">${t("Notes")}</div><textarea data-g="notes" placeholder="${t("Taxi route, holding, remarks …")}">${esc(d.notes || "")}</textarea></div></div>`;
    body.oninput = (e) => { const el = e.target; if (el.dataset.g === "notes") put("notes", el.value); else if (el.dataset.g) put(el.dataset.g, { ...(get()[el.dataset.g] || {}), [el.dataset.f]: el.value }); };
    body.onclick = (e) => { if (e.target.closest("[data-kb=clear]")) { store.set(key(), {}); body._kb = ""; render(body, ctx); } };
    return;
  }
  body.innerHTML = `<div class="kb-head"><b>${t("Scratchpad")}</b><span class="kb-pens">${["#e8eefc", "#ffd200", "#ff3347", "#3ddc97"].map((c, i) => `<button data-pen="${c}" class="${i ? "" : "on"}" style="background:${c}"></button>`).join("")}<button class="btn small" data-kb="erase">${t("Eraser")}</button></span><button class="btn small" data-kb="wipe">${t("Clear page")}</button></div><canvas class="kb-cv"></canvas>`;
  const cv = body.querySelector(".kb-cv"), r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = Math.max(300, r.width) * dpr; cv.height = Math.max(300, r.height) * dpr;
  const g = cv.getContext("2d"); g.scale(dpr, dpr); g.lineCap = g.lineJoin = "round";
  if (d.ink) { const im = new Image(); im.onload = () => g.drawImage(im, 0, 0, cv.width / dpr, cv.height / dpr); im.src = d.ink; }
  let pen = "#e8eefc", erase = false, last = null, saveT = null;
  const pos = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); last = pos(e); };
  cv.onpointermove = (e) => { if (!last) return; const p = pos(e); g.globalCompositeOperation = erase ? "destination-out" : "source-over"; g.strokeStyle = pen; g.lineWidth = erase ? 22 : e.pressure > 0 && e.pointerType === "pen" ? 1 + e.pressure * 3 : 2.4;
    g.beginPath(); g.moveTo(...last); g.lineTo(...p); g.stroke(); last = p; };
  cv.onpointerup = cv.onpointercancel = () => { last = null; clearTimeout(saveT); saveT = setTimeout(() => put("ink", cv.toDataURL("image/png")), 400); };
  body.onclick = (e) => { const b = e.target.closest("[data-pen],[data-kb]"); if (!b) return;
    if (b.dataset.pen) { pen = b.dataset.pen; erase = false; body.querySelectorAll("[data-pen]").forEach((x) => x.classList.toggle("on", x === b)); }
    if (b.dataset.kb === "erase") { erase = true; body.querySelectorAll("[data-pen]").forEach((x) => x.classList.remove("on")); }
    if (b.dataset.kb === "wipe") { g.clearRect(0, 0, cv.width, cv.height); put("ink", ""); } };
  body.oninput = null;
}
export function summary() { const d = get(); return [t("Kneeboard"), d.clr?.sq ? "SQ " + d.clr.sq : d.notes ? d.notes.slice(0, 60) : ""]; }
