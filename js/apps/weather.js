// Weather: METAR and TAF for the Air Serbia network only (va/routes.json) plus the airports of the current flight.
// Each airport as a scene built from the live report (sky, cloud, rain, snow, fog, day or night); the raw report one tap below.
// METAR from VATSIM (one request for all), TAF from aviationweather.gov via the wx branch; refreshed every 10 minutes.
import { S, API } from "../data.js";
import { t, nf, LOCALE } from "../i18n.js";
import { esc, getText, getJSON } from "../util.js";
import { decodeMetar } from "../wx.js";
import { tzOf, cityOf } from "../tz.js";

export const name = "Weather";
export const tabs = [];
const W = { metar: {}, taf: {}, at: 0, busy: false };
let C = null, open = null;

// the list: the flight's airports first, then Belgrade, then the network by name
export function weatherAirports() {
  const o = S.ofp, net = S.routes?.airports || {};
  const first = [o?.dep?.icao, o?.dest?.icao, ...(o?.altns || []).map((a) => a.icao)].filter(Boolean);
  const rest = Object.keys(net).filter((k) => !first.includes(k)).sort((a, b) => (a === (S.routes?.base || "LYBE") ? -1 : b === (S.routes?.base || "LYBE") ? 1 : (net[a].name || a).localeCompare(net[b].name || b)));
  return [...new Set([...first, ...rest])];
}
export async function loadWeather(force) {
  if (W.busy || (!force && Date.now() - W.at < 10 * 60e3)) return;
  const ids = weatherAirports(); if (!ids.length) return;
  W.busy = true;
  try {
    const txt = await getText("https://metar.vatsim.net/metar.php?id=" + ids.join(","), 20000);
    for (const line of txt.split("\n")) { const m = line.trim().match(/^([A-Z]{4})\s/); if (m) W.metar[m[1]] = line.trim(); }
  } catch {}
  try { const d = await getJSON(API.taf, 20000); Object.assign(W.taf, d?.taf || {}); } catch {} // aviationweather.gov via the wx branch (no CORS there)
  for (const a of [S.ofp?.dep, S.ofp?.dest, ...(S.ofp?.altns || [])]) if (a?.taf && !W.taf[a.icao]) W.taf[a.icao] = a.taf; // the OFP's TAFs
  for (const id of ids) if (!W.metar[id] && S.metar[id]) W.metar[id] = S.metar[id].raw; // the pad's own METARs as a fall-back
  W.at = Date.now(); W.busy = false; C?.changed("view");
}
export const metarFor = (icao) => W.metar[icao] || S.metar[icao]?.raw || "";

const cityName = (icao) => S.routes?.airports?.[icao]?.name || cityOf({ icao }) || icao;
const isNight = (icao) => { const z = tzOf({ icao }); try { const h = +new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: z }).format(Date.now()); return h < 6 || h >= 20; } catch { return false; } };
function sceneOf(w, night) {
  const wx = w.wx || "", cov = (w.clouds || []).map((c) => c.cov);
  const kind = /TS/.test(wx) ? "storm" : /SN|SG|PL/.test(wx) ? "snow" : /RA|DZ|SH/.test(wx) ? "rain" : /FG|BR|HZ/.test(wx) || (w.vis != null && w.vis < 3000) ? "fog"
    : cov.includes("OVC") || cov.includes("BKN") ? "cloud" : cov.length ? "few" : "clear";
  return (night ? "night " : "") + kind;
}
const WORD = { storm: "Thunderstorms", snow: "Snow", rain: "Rain", fog: "Fog", cloud: "Cloudy", few: "Partly cloudy", clear: "Clear" };
function card(icao) {
  const raw = metarFor(icao), w = raw ? decodeMetar(raw) : null, night = isNight(icao), sc = w ? sceneOf(w, night) : "none", city = cityName(icao);
  const local = (() => { try { return new Intl.DateTimeFormat(LOCALE(), { hour: "2-digit", minute: "2-digit", timeZone: tzOf({ icao }) }).format(Date.now()); } catch { return ""; } })();
  return `<button class="wx-card ${sc}" data-wx="${icao}"><span class="fx"></span><span class="wx-top"><b>${esc(city)}</b><span>${esc(icao)} · ${local}</span></span>
    <span class="wx-temp">${w?.temp != null ? w.temp + "°" : "—"}</span><span class="wx-word">${w ? esc(t(WORD[sc.replace("night ", "")])) : t("No report")}</span>
    <span class="wx-mini">${w ? `${w.wspd != null ? (w.vrb ? "VRB" : String(w.wdir ?? 0).padStart(3, "0")) + "/" + w.wspd + " kt" : ""}${w.qnh ? " · Q" + w.qnh : ""}${w.cat ? ` · <i class="cat ${w.cat}">${w.cat}</i>` : ""}` : ""}</span></button>`;
}
function detail(icao) {
  const raw = metarFor(icao), w = raw ? decodeMetar(raw) : null, taf = W.taf[icao] || S.ofp && [S.ofp.dep, S.ofp.dest, ...S.ofp.altns].find((a) => a?.icao === icao)?.taf || "";
  const kv = (l, v) => `<div><span class="lbl">${l}</span><b>${v}</b></div>`;
  return `<div class="wx-detail"><button class="btn small" data-wx="">← ${t("All airports")}</button>
    <div class="wx-big ${w ? sceneOf(w, isNight(icao)) : "none"}"><span class="fx"></span><div><h2>${esc(cityName(icao))}</h2><div>${esc(icao)}</div></div><div class="wx-temp">${w?.temp != null ? w.temp + "°" : "—"}</div></div>
    ${w ? `<div class="kv" style="margin:14px 0">${kv(t("Wind"), w.wspd != null ? `${w.vrb ? "VRB" : String(w.wdir ?? 0).padStart(3, "0") + "°"} ${w.wspd} kt${w.gust ? " G" + w.gust : ""}` : "—")}${kv(t("Visibility"), w.vis != null ? (w.vis >= 10000 ? "10 km+" : nf(w.vis) + " m") : "—")}
      ${kv(t("Cloud base"), w.ceil != null ? nf(w.ceil) + " ft" : w.cavok ? "CAVOK" : "—")}${kv("QNH", w.qnh ? w.qnh + " hPa" : "—")}${kv(t("Dew point"), w.dew != null ? w.dew + "°" : "—")}${kv(t("Category"), w.cat || "—")}</div>` : ""}
    <div class="lbl">METAR</div><div class="wx-raw">${esc(raw || t("No report"))}</div>
    <div class="lbl" style="margin-top:12px">TAF</div><div class="wx-raw">${esc(taf || "—")}</div></div>`;
}
export function render(body, ctx) {
  C = ctx; loadWeather();
  if (!body._wx) { body._wx = true; body.addEventListener("click", (e) => { const b = e.target.closest("[data-wx]"); if (b) { open = b.dataset.wx || null; C.changed("view"); } }); }
  if (open) { body.innerHTML = detail(open); return; }
  const ids = weatherAirports();
  body.innerHTML = `<div class="wx-head"><div class="lbl">${t("Air Serbia network")} · ${ids.length} ${t("airports")}</div><span class="dim">${W.at ? t("updated {t}", { t: new Date(W.at).toISOString().slice(11, 16) + "z" }) : t("Loading…")}</span></div>
    <div class="wx-grid">${ids.map(card).join("")}</div>`;
}
export function summary() { const o = S.ofp; const id = o?.dest?.icao || "LYBE", w = metarFor(id) ? decodeMetar(metarFor(id)) : null; return [t("Weather"), `${cityOf({ icao: id }) || id}${w?.temp != null ? " · " + w.temp + "°" : ""}`]; }
// the home widget: departure, destination or Belgrade
export function weatherWidget() {
  loadWeather();
  const o = S.ofp, ids = [o?.dep?.icao, o?.dest?.icao].filter(Boolean); if (!ids.length) ids.push(S.routes?.base || "LYBE");
  return `<div class="wg wg-wx" data-app="weather">${ids.map((id) => { const raw = metarFor(id), w = raw ? decodeMetar(raw) : null;
    return `<div class="${w ? sceneOf(w, isNight(id)) : "none"}"><span class="fx"></span><b>${esc(cityName(id))}</b><span class="t">${w?.temp != null ? w.temp + "°" : "—"}</span><span>${w ? esc(t(WORD[sceneOf(w, false)])) : ""}</span></div>`; }).join("")}</div>`;
}
