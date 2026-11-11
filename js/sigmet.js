// SIGMETs (from .github/workflows/sigmets.yml): which are valid now, their colour and which ones the route crosses.
import { S } from "./data.js";
import { t, nf } from "./i18n.js";
import { esc, inRing, greatCircle, hhmmz } from "./util.js";

export const HAZARD = { TS: ["#ff5a3c", "Thunderstorms"], TSGR: ["#ff5a3c", "Thunderstorms with hail"], TURB: ["#ffd200", "Turbulence"], ICE: ["#38d6ff", "Icing"],
  VA: ["#c08cff", "Volcanic ash"], TC: ["#ff4fd8", "Tropical cyclone"], MTW: ["#ff9f40", "Mountain waves"], DS: ["#d6a86b", "Dust storm"], SS: ["#d6a86b", "Sand storm"], RDOACT: ["#7dffb4", "Radioactive cloud"] };
export const hazardOf = (s) => HAZARD[s.hazard] || HAZARD[(s.hazard || "").slice(0, 2)] || ["#ffb21f", s.hazard || "SIGMET"];

export function activeSigmets(now = Date.now()) {
  return (S.sigmets || []).filter((s) => (!s.from || Date.parse(s.from) <= now + 3 * 36e5) && (!s.to || Date.parse(s.to) >= now));
}
export const levels = (s) => {
  const f = (v) => (v == null || v === "" ? null : Number(v) >= 1000 ? "FL" + String(Math.round(Number(v) / 100)).padStart(3, "0") : String(v));
  const b = f(s.base), tp = f(s.top);
  return b || tp ? `${b || "SFC"}–${tp || "?"}` : "";
};

// SIGMETs the planned route goes through, with the first fix after which the route is inside
export function routeSigmets(o, now = Date.now()) {
  if (!o?.navlog?.length) return [];
  const pts = [];
  for (let i = 0; i < o.navlog.length - 1; i++) for (const p of greatCircle(o.navlog[i].pos, o.navlog[i + 1].pos, 12)) pts.push([p, i]);
  const out = [];
  for (const s of activeSigmets(now)) {
    const ring = s.poly.map(([la, lo]) => [lo, la]);
    const hit = pts.find(([p]) => inRing(p, ring));
    if (hit) out.push({ s, fix: o.navlog[hit[1]] });
  }
  return out;
}

export function routeSigmetsHtml(o, now) {
  const list = routeSigmets(o, now);
  const rows = list.map(({ s, fix }) => { const [col, name] = hazardOf(s);
    return `<div class="sg-row"><i style="background:${col}"></i><div><b>${esc(t(name))}</b> <span class="dim">${esc(s.qual || "")} ${esc(levels(s))}</span>
      <div class="dim" style="font-size:12.5px">${esc(s.fir)} ${esc(s.name || "")} · ${t("after {fix}", { fix: fix.ident })} · ${t("valid until {t}", { t: s.to ? hhmmz(Date.parse(s.to)) : "—" })}</div></div></div>`; }).join("");
  return `<div class="card sg-card"><div class="lbl" style="margin-bottom:6px">${t("SIGMETs on your route")}</div>
    ${S.sigmets == null ? `<div class="dim">${t("Loading…")}</div>` : list.length ? rows : `<div class="dim">${t("No SIGMET on your route right now.")}</div>`}</div>`;
}
