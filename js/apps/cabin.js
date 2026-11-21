// Cabin: the passenger screen of the flight, like an in-flight entertainment system in the Air Serbia look.
// Flight map (km/h, metres, outside temperature, time to the destination, local times), the destination (local time and
// weather), connecting flights and arrivals there (VATSIM). Runs on its own beside the crew apps; can rotate the screens.
import { S, derived, wxOf, runwayOf, arrivalStand } from "../data.js";
import { t, nf, LOCALE } from "../i18n.js";
import { esc, store, dur, distKm, greatCircle } from "../util.js";
import { tzOf, cityOf } from "../tz.js";
import { IATA } from "../ofp.js";
import { baseLayer } from "./map.js";

export const name = "Cabin";
export const tabs = [["map", "Flight map"], ["dest", "Destination"], ["conn", "Connections"], ["arr", "Arrivals"]];
const L = window.L;
let C = null, M = null, autoT = Date.now();
const ui = { auto: store.get("asl.cabin.auto", false) };

export function summary() {
  const o = S.ofp; if (!o) return [t("Cabin"), t("No flight loaded")];
  const d = derived();
  return [t("Cabin"), `${cityOf(o.dep)} → ${cityOf(o.dest)}\n${d ? t("{t} to go", { t: dur(Math.max(0, d.est.on - Date.now())) }) : ""}`];
}

const AC = { A319: "Airbus A319", A320: "Airbus A320", A20N: "Airbus A320neo", A321: "Airbus A321", A21N: "Airbus A321neo", A332: "Airbus A330-200", A333: "Airbus A330-300",
  AT76: "ATR 72-600", AT75: "ATR 72-500", B738: "Boeing 737-800", B38M: "Boeing 737 MAX 8", B77W: "Boeing 777-300ER", B789: "Boeing 787-9", E195: "Embraer 195" };
const kmh = (kt) => Math.round(kt * 1.852), m = (ft) => Math.round(ft * 0.3048);
const timeIn = (ms, tz) => { try { return new Intl.DateTimeFormat(LOCALE(), { hour: "2-digit", minute: "2-digit", timeZone: tz || undefined }).format(ms); } catch { return "--:--"; } };
const dateIn = (ms, tz) => { try { return new Intl.DateTimeFormat(LOCALE(), { weekday: "long", day: "numeric", month: "long", timeZone: tz || undefined }).format(ms); } catch { return ""; } };
// outside air temperature: from the flight plan near our position, else the standard atmosphere
function oat(o, pos, alt) {
  if (pos && o.navlog.length) {
    let best = null, bd = Infinity; for (const x of o.navlog) { if (x.oat == null) continue; const d = distKm(pos, x.pos); if (d < bd) { bd = d; best = x; } }
    if (best && bd < 300 && Math.abs((best.alt || 0) - alt) < 4000) return best.oat;
  }
  return alt > 36089 ? -56.5 : Math.round(15 - 1.98 * (alt / 1000));
}

export function render(body, ctx) {
  C = ctx;
  if (!body._cab) { body._cab = true; body.addEventListener("click", onClick); }
  body.classList.add("cab-body");
  const o = S.ofp, tab = ctx.tab || "map";
  if (!o) { dropMap(); body.innerHTML = `<div class="cab"><div class="cab-empty">${t("When a flight is loaded, the passenger screen shows it here.")}</div></div>`; return; }
  if (ui.auto && Date.now() - autoT > (tab === "map" ? 40e3 : 20e3)) { autoT = Date.now(); ctx.setTab({ map: "dest", dest: "conn", conn: "arr", arr: "map" }[tab]); return; }
  const head = header(o, tab);
  if (tab === "map") { renderMap(body, o, head); return; }
  dropMap();
  body.innerHTML = `<div class="cab">${head}<div class="cab-page">${tab === "dest" ? destPage(o) : tab === "conn" ? connPage(o) : arrPage(o)}</div>${footer(o)}</div>`;
}

function header(o, tab) {
  const iata = IATA[o.airline] || "";
  return `<div class="cab-head"><div class="cab-badge">${esc(o.iataNo || o.callsign)}</div><div class="cab-route"><b>${esc(cityOf(o.dep))}</b> → <b>${esc(cityOf(o.dest))}</b><span>${esc(AC[o.type] || o.type)}</span></div>
    ${iata ? `<img class="cab-logo" src="https://pics.avs.io/240/80/${esc(iata)}.png" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
    <button class="cab-auto${ui.auto ? " on" : ""}" data-cab="auto">${t("Slideshow")}</button></div>${welcome(o)}`;
}
function welcome(o) {
  const st = S.st || {};
  if (!st.offBlock) return `<div class="cab-wel">${t("Welcome on board")} · ${t("Flight {f} to {city}", { f: o.iataNo || o.callsign, city: cityOf(o.dest) })} · ${t("flight time about {t}", { t: dur((o.times.ete || 0) * 1000) })}</div>`;
  if (st.landing) { const w = wxOf(o.dest.icao); return `<div class="cab-wel">${t("Welcome to {city}", { city: cityOf(o.dest) })} · ${t("local time {t}", { t: timeIn(Date.now(), tzOf(o.dest)) })}${w?.temp != null ? " · " + w.temp + " °C" : ""}</div>`; }
  return "";
}
function footer(o) {
  const d = derived(), pl = S.pilot, alt = pl?.altitude || 0;
  const left = d ? Math.max(0, d.est.on - Date.now()) : null, km = d ? Math.round(d.toGo * 1.852) : null;
  return `<div class="cab-foot"><span>${t("Time to destination")} <b>${left != null && S.st?.takeoff && !S.st?.landing ? dur(left) : "—"}</b></span><span>${t("Distance")} <b>${km != null ? nf(km) + " km" : "—"}</b></span>
    <span>${t("Outside")} <b>${pl ? oat(o, [pl.latitude, pl.longitude], alt) + " °C" : wxOf(o.dep.icao)?.temp != null ? wxOf(o.dep.icao).temp + " °C" : "—"}</b></span><span class="dim">${t("Unofficial · not affiliated with the airline")}</span></div>`;
}

// ---------- flight map ----------
function dropMap() { if (M) { try { M.map.remove(); } catch {} M = null; } }
function renderMap(body, o, head) {
  const key = o.id + o.callsign;
  if (!M || M.key !== key || !body.contains(M.el)) {
    dropMap();
    body.innerHTML = `<div class="cab cab-mapv"><div class="cab-top">${head}</div><div class="cab-map"></div><div class="cab-info"></div><div class="cab-footw">${footer(o)}</div></div>`;
    const el = body.querySelector(".cab-map");
    const map = L.map(el, { zoomControl: false, attributionControl: true, minZoom: 2, zoomSnap: 0.25, worldCopyJump: false });
    baseLayer(map, { dark: false, max: 9, look: "cabin" });
    const pts = o.navlog.map((x) => x.pos);
    const unwrap = (l) => { const out = []; let off = 0; l.forEach((p, i) => { if (i) { const dl = p[1] + off - out[i - 1][1]; if (dl > 180) off -= 360; else if (dl < -180) off += 360; } out.push([p[0], p[1] + off]); }); return out; };
    const route = unwrap(pts.length > 1 ? pts : greatCircle(o.dep.pos, o.dest.pos));
    L.polyline(route, { color: "#0059c2", weight: 3, opacity: 0.55, dashArray: "6 8", interactive: false }).addTo(map);
    const flown = L.polyline([], { color: "#e3001f", weight: 4, opacity: 0.95, interactive: false }).addTo(map);
    const city = (a, p) => L.marker(p, { interactive: false, icon: L.divIcon({ className: "cab-city", html: `<i></i><b>${esc(cityOf(a))}</b><span class="t"></span>`, iconSize: [12, 12], iconAnchor: [6, 6] }) }).addTo(map);
    const cDep = city(o.dep, route[0]), cArr = city(o.dest, route[route.length - 1]);
    const plane = L.marker(route[0], { interactive: false, zIndexOffset: 1000, icon: L.divIcon({ className: "cab-plane", html: "", iconSize: [40, 40], iconAnchor: [20, 20] }) }).addTo(map);
    map.fitBounds(L.polyline(route).getBounds(), { paddingTopLeft: [50, 50], paddingBottomRight: [310, 50] });
    M = { key, el, body, map, flown, plane, cDep, cArr, unwrap };
    setTimeout(() => map.invalidateSize(), 80);
  } else { body.querySelector(".cab-top").innerHTML = head; body.querySelector(".cab-footw").innerHTML = footer(o); }
  update(o);
}
function update(o) {
  const pl = S.pilot, d = derived();
  const tr = (S.st?.track || []).map((x) => [x[0], x[1]]);
  if (tr.length) M.flown.setLatLngs(M.unwrap(tr));
  const pos = pl ? [pl.latitude, pl.longitude] : tr.at(-1) || o.dep.pos;
  M.plane.setLatLng(pos);
  const el = M.plane.getElement(); if (el) el.innerHTML = `<svg viewBox="0 0 24 24" width="40" height="40" style="transform:rotate(${pl?.heading || 0}deg)"><path fill="#e3001f" stroke="#fff" stroke-width=".9" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>`;
  for (const [mk, a] of [[M.cDep, o.dep], [M.cArr, o.dest]]) { const t2 = mk.getElement()?.querySelector(".t"); if (t2) t2.textContent = timeIn(Date.now(), tzOf(a)); }
  const alt = pl?.altitude || 0, gs = pl?.groundspeed || 0, st = S.st || {};
  const phase = !st.offBlock ? t("At the gate") : !st.takeoff ? t("Taxiing") : st.onBlock ? t("Arrived") : st.landing ? t("Landed") : d?.phase === "climb" ? t("Climbing") : d?.phase === "descent" || d?.phase === "approach" ? t("Descending") : t("Cruising");
  const eta = d?.est.on, cell = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
  M.body.querySelector(".cab-info").innerHTML = `<div class="cab-phase">${esc(phase)}</div>
    ${cell(t("Ground speed"), pl ? nf(kmh(gs)) + " km/h" : "—")}${cell(t("Altitude"), pl ? nf(m(alt)) + " m" : "—")}${cell(t("Outside temperature"), pl ? oat(o, pos, alt) + " °C" : "—")}
    ${cell(t("Distance to destination"), d ? nf(Math.round(d.toGo * 1.852)) + " km" : "—")}${cell(t("Arrival (local time)"), eta ? timeIn(eta, tzOf(o.dest)) : "—")}
    ${cell(t("Local time in {city}", { city: cityOf(o.dest) }), timeIn(Date.now(), tzOf(o.dest)))}`;
}

// ---------- destination ----------
const SKY = [[/TS/, "Thunderstorms"], [/SN|SG|PL/, "Snow"], [/FZ/, "Freezing"], [/RA|DZ|SH/, "Rain"], [/FG/, "Fog"], [/BR|HZ/, "Mist"]];
function weatherWord(w) {
  for (const [re, k] of SKY) if (re.test(w.wx || "")) return t(k);
  if (w.cavok || !w.clouds?.length) return t("Clear");
  const c = w.clouds.map((x) => x.cov); return c.includes("OVC") ? t("Overcast") : c.includes("BKN") ? t("Cloudy") : t("Partly cloudy");
}
function destPage(o) {
  const tz = tzOf(o.dest), w = wxOf(o.dest.icao), r = runwayOf(o.dest.icao, "arr"), s = arrivalStand();
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return `<div class="cab-dest"><div class="cab-dest-l"><span class="lbl">${t("Local time in {city}", { city: cityOf(o.dest) })}</span><div class="cab-clock">${timeIn(Date.now(), tz)}</div><div class="dim">${esc(dateIn(Date.now(), tz))}</div></div>
    <div class="cab-dest-r">${w ? `<div class="cab-temp">${w.temp != null ? w.temp + "°" : "—"}<span>${esc(weatherWord(w))}</span></div>
      <div class="cab-kv"><div><span>${t("Wind")}</span><b>${w.wspd != null ? kmh(w.wspd) + " km/h" + (w.wdir != null ? " " + dirs[Math.round(w.wdir / 45) % 8] : "") : "—"}</b></div>
      <div><span>${t("Visibility")}</span><b>${w.vis != null ? (w.vis >= 10000 ? t("over 10 km") : nf(Math.round(w.vis / 100) / 10) + " km") : "—"}</b></div>
      <div><span>${t("Air pressure")}</span><b>${w.qnh ? w.qnh + " hPa" : "—"}</b></div>
      <div><span>${t("Landing runway")}</span><b>${esc(r?.rwy || "—")}</b></div>${s?.ref ? `<div><span>${s.gate ? t("Gate") : t("Stand")}</span><b>${esc(s.ref)}</b></div>` : ""}</div>` : `<div class="dim">${t("Weather at the destination is loading…")}</div>`}</div></div>`;
}

// ---------- connecting flights and arrivals (VATSIM) ----------
const toMs = (hhmm) => { if (!/^\d{4}$/.test(hhmm || "")) return null; const n = new Date(); const v = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), +hhmm.slice(0, 2), +hhmm.slice(2)); return v < Date.now() - 12 * 36e5 ? v + 864e5 : v; };
const flightNo = (cs) => { const m = /^([A-Z]{3})(\d+[A-Z]?)$/.exec(cs); return m && IATA[m[1]] ? IATA[m[1]] + " " + m[2] : cs; };
const STATUS = { boarding: "Boarding", taxi: "Taxiing", departed: "Departed", scheduled: "Scheduled", enroute: "En route", approach: "On approach", landed: "Landed", stand: "At the gate", planned: "Scheduled" };
function connPage(o) {
  const B = S.board, tz = tzOf(o.dest), myArr = derived()?.est.in;
  const list = (B?.dep || []).map((x) => ({ ...x, at: toMs(x.dep) })).filter((x) => x.at == null || (x.at > Date.now() - 90 * 60e3 && x.at < Date.now() + 12 * 36e5)).sort((a, b) => (a.at || 9e15) - (b.at || 9e15)).slice(0, 14);
  if (!list.length) return `<div class="cab-empty">${t("No connecting flights from {city} on VATSIM right now.", { city: cityOf(o.dest) })}</div>`;
  return `<div class="cab-board"><div class="cab-bh"><span>${t("Time")}</span><span>${t("Flight")}</span><span>${t("To")}</span><span>${t("Status")}</span></div>
    ${list.map((x) => `<div class="${myArr && x.at && x.at < myArr ? "gone" : ""}"><span class="num">${x.at ? timeIn(x.at, tz) : "—"}</span><span><b>${esc(flightNo(x.cs))}</b> <small>${esc(x.type)}</small></span>
      <span>${esc(cityOf({ icao: x.to }) || x.to)} <small>${esc(x.to)}</small></span><span class="st ${x.st}">${esc(t(STATUS[x.st] || x.st))}</span></div>`).join("")}
    <p class="dim" style="margin:10px 0 0;font-size:13px">${t("Departures from {city} on VATSIM, in local time. Greyed out: before your arrival.", { city: cityOf(o.dest) })}</p></div>`;
}
function arrPage(o) {
  const B = S.board, tz = tzOf(o.dest), me = o.callsign;
  const list = [...(B?.arr || [])].sort((a, b) => (a.st === "stand") - (b.st === "stand") || (a.eta || 0) - (b.eta || 0) || (a.km ?? 1e9) - (b.km ?? 1e9)).slice(0, 14);
  const inbound = list.filter((x) => x.st === "enroute" || x.st === "approach"), pos = inbound.findIndex((x) => x.cs === me);
  if (!list.length) return `<div class="cab-empty">${t("No arrivals to {city} on VATSIM right now.", { city: cityOf(o.dest) })}</div>`;
  return `<div class="cab-board">${pos >= 0 ? `<div class="cab-pos">${t("Your flight is number {n} of {m} arrivals", { n: pos + 1, m: inbound.length })}</div>` : ""}
    <div class="cab-bh"><span>${t("Time")}</span><span>${t("Flight")}</span><span>${t("From")}</span><span>${t("Status")}</span></div>
    ${list.map((x) => `<div class="${x.cs === me ? "me" : ""}"><span class="num">${x.eta ? timeIn(x.eta, tz) : "—"}</span><span><b>${esc(flightNo(x.cs))}</b> <small>${esc(x.type)}</small></span>
      <span>${esc(cityOf({ icao: x.from }) || x.from)} <small>${esc(x.from)}</small></span><span class="st ${x.st}">${esc(t(STATUS[x.st] || x.st))}</span></div>`).join("")}</div>`;
}

function onClick(e) {
  const b = e.target.closest("[data-cab]"); if (!b) return;
  if (b.dataset.cab === "auto") { ui.auto = !ui.auto; store.set("asl.cabin.auto", ui.auto); autoT = Date.now(); C.changed("view"); }
}
window.addEventListener("resize", () => M?.map.invalidateSize());
