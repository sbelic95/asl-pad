// METAR decoding, flight categories and the runway in use.
import { getJSON } from "./util.js";

// wind in kt, visibility in m, ceiling in ft (lowest BKN/OVC/VV)
export function decodeMetar(raw) {
  const t = " " + String(raw || "").replace(/\s+/g, " ") + " ";
  const o = { raw: String(raw || "").trim() };
  let m = t.match(/ (M?\d{2})\/(M?\d{2})? /);
  if (m) { o.temp = +m[1].replace("M", "-"); if (m[2]) o.dew = +m[2].replace("M", "-"); }
  m = t.match(/ (\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS) /);
  if (m) { const k = m[4] === "MPS" ? 1.944 : 1; o.wdir = m[1] === "VRB" ? null : +m[1]; o.vrb = m[1] === "VRB"; o.wspd = Math.round(+m[2] * k); if (m[3]) o.gust = Math.round(+m[3] * k); }
  if (/ CAVOK /.test(t)) { o.vis = 10000; o.cavok = true; }
  else if ((m = t.match(/ (\d{4})(?:NDV)? /))) o.vis = +m[1] >= 9999 ? 10000 : +m[1];
  else if ((m = t.match(/ (?:(\d+) )?(\d+)(?:\/(\d+))?SM /))) o.vis = Math.min(10000, Math.round(((m[1] ? +m[1] : 0) + (m[3] ? +m[2] / +m[3] : +m[2])) * 1609));
  if ((m = t.match(/ Q(\d{4}) /))) o.qnh = +m[1];
  else if ((m = t.match(/ A(\d{4}) /))) { o.alt = +m[1] / 100; o.qnh = Math.round(o.alt * 33.8639); }
  o.clouds = [...t.matchAll(/ (FEW|SCT|BKN|OVC|VV)(\d{3})/g)].map((c) => ({ cov: c[1], ft: +c[2] * 100 }));
  const ceil = o.clouds.filter((c) => /BKN|OVC|VV/.test(c.cov)).map((c) => c.ft);
  o.ceil = ceil.length ? Math.min(...ceil) : null;
  o.wx = (t.match(/ (?:[-+]|VC)?(?:MI|BC|PR|DR|BL|SH|TS|FZ)?(?:DZ|RA|SN|SG|PL|GR|GS|FG|BR|HZ|FU|SA|DU)+ /g) || []).map((s) => s.trim()).join(" ");
  o.cat = flightCategory(o.vis, o.ceil);
  return o;
}

// FAA-style categories, as airline crews read them on the flight overview
export function flightCategory(vis, ceil) {
  if (vis == null && ceil == null) return "";
  const v = vis ?? 99999, c = ceil ?? 99999;
  if (c < 500 || v < 1600) return "LIFR";
  if (c < 1000 || v < 4800) return "IFR";
  if (c <= 3000 || v <= 8000) return "MVFR";
  return "VFR";
}

// ATIS letter and runway(s) from the ATIS text
export function atisInfo(lines) {
  const txt = (Array.isArray(lines) ? lines.join(" ") : String(lines || "")).toUpperCase().replace(/\s+/g, " ");
  const o = {};
  let m = txt.match(/INFORMATION ([A-Z])\b/) || txt.match(/\bINFO ([A-Z])\b/) || txt.match(/\bATIS ([A-Z])\b/);
  if (m) o.letter = m[1];
  const rw = (re) => { const x = txt.match(re); return x ? x[1].replace(/\s/g, "").replace(/LEFT/, "L").replace(/RIGHT/, "R").replace(/CENTER|CENTRE/, "C") : ""; };
  o.arrRwy = rw(/(?:LANDING|ARRIVAL|ARR)\s+(?:RUNWAYS?|RWYS?)\s*(\d{2}\s?(?:[LRC]|LEFT|RIGHT|CENTER|CENTRE)?)/) || rw(/(?:RUNWAYS?|RWYS?) (?:IN USE )?(\d{2}\s?(?:[LRC]|LEFT|RIGHT|CENTER|CENTRE)?)\s+(?:FOR )?(?:LANDING|ARRIVAL)/);
  o.depRwy = rw(/(?:DEPARTURE|DEPARTING|TAKE-?OFF|DEP)\s+(?:RUNWAYS?|RWYS?)\s*(\d{2}\s?(?:[LRC]|LEFT|RIGHT|CENTER|CENTRE)?)/) || rw(/(?:RUNWAYS?|RWYS?) (?:IN USE )?(\d{2}\s?(?:[LRC]|LEFT|RIGHT|CENTER|CENTRE)?)\s+(?:FOR )?(?:DEPARTURE|TAKE-?OFF)/);
  const any = rw(/(?:RUNWAYS? IN USE|RWYS? IN USE|ACTIVE RUNWAYS?|RUNWAY|RWY)\s*(\d{2}\s?(?:[LRC]|LEFT|RIGHT|CENTER|CENTRE)?)/);
  o.arrRwy = o.arrRwy || any; o.depRwy = o.depRwy || any;
  return o;
}

// runways (OurAirports, prepared daily by the VDGS ATC job): {ICAO: [[le_ident, le_hdg, he_ident, he_hdg, len_ft], ...]}
let RUNWAYS = null, rwyReq = null;
export function loadRunways() {
  if (!rwyReq) rwyReq = getJSON("https://raw.githubusercontent.com/sbelic95/vdgs-slot-board/atc/runways.json", 30000)
    .then((d) => { RUNWAYS = d || {}; return RUNWAYS; }).catch(() => { rwyReq = null; return {}; });
  return rwyReq;
}
// runway with the most headwind (from 5 kt), else the longest
export function runwayFromWind(icao, w) {
  const list = RUNWAYS?.[icao]; if (!list?.length) return "";
  const ends = list.flatMap((r) => [[r[0], r[1], r[4]], [r[2], r[3], r[4]]]).filter((e) => e[1] != null);
  if (!ends.length) return "";
  if (w && w.wdir != null && w.wspd >= 5) {
    const hw = (h) => Math.cos(((w.wdir - h) * Math.PI) / 180) * w.wspd;
    ends.sort((a, b) => hw(b[1]) - hw(a[1]) || b[2] - a[2]);
  } else ends.sort((a, b) => b[2] - a[2]);
  return ends[0][0];
}
