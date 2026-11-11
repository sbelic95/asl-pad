// Airport: ground map with taxi routes, briefing and stands – fully for LYBE (va/airports/LYBE.json), map and stands
// for the other airports with ground data (js/ground.js), stands for every airport of the flight.
import { S, settings, departureStand, arrivalStand, loadStandsFor } from "../data.js";
import { t, loc } from "../i18n.js";
import { esc, store, getJSON, distKm } from "../util.js";
import { loadGround, groundOf, GROUND_AIRPORTS, nearestTaxiNode, runwayEnd, runwayJoin, taxiRoute, holdsOn, meetPoint } from "../ground.js";

export const name = "Airport";
export const tabs = [["map", "Ground map"], ["brief", "Briefing"], ["stands", "Stands"]];

const L = window.L;
const HOME = "LYBE";
const SPAN = { A319: 35.8, A320: 35.8, A20N: 35.8, A321: 35.8, A21N: 35.8, A332: 60.3, A333: 60.3, A339: 64, AT75: 27.1, AT76: 27.1, E190: 28.7, E195: 28.7,
  B737: 35.8, B738: 35.8, B38M: 35.9, B739: 35.8, B788: 60.1, B789: 60.1, B77W: 64.8, CRJ9: 24.9, DH8D: 28.4 };
const ui = { icao: null, mode: null, rwy: null, join: null, stand: null, ...store.get("asl.apt", {}) };
const saveUi = () => store.set("asl.apt", { icao: ui.icao, mode: ui.mode, rwy: ui.rwy, join: ui.join, stand: ui.stand });
const briefs = {};
let C = null, M = null, loading = {};

export function summary() { return [t("Airport"), ui.icao || HOME]; }

// ---------- which airport, departure or arrival ----------
function airports() {
  const o = S.ofp, list = [];
  if (o?.dep?.icao) list.push(o.dep.icao);
  if (o?.dest?.icao && o.dest.icao !== o.dep?.icao) list.push(o.dest.icao);
  if (!list.includes(HOME)) list.push(HOME);
  return list;
}
function current() {
  const list = airports(), o = S.ofp;
  if (!ui.icao || !list.includes(ui.icao)) ui.icao = o ? (S.st?.takeoff ? o.dest.icao : o.dep.icao) : HOME;
  const mode = ui.mode || (o && ui.icao === o.dest?.icao && ui.icao !== o.dep?.icao ? "arr" : o && S.st?.takeoff && ui.icao === o.dest?.icao ? "arr" : "dep");
  return { icao: ui.icao, mode };
}
async function brief(icao) {
  if (briefs[icao] !== undefined) return briefs[icao];
  briefs[icao] = null;
  try { briefs[icao] = await getJSON(`va/airports/${icao}.json`, 15000); } catch { briefs[icao] = false; }
  C?.changed("view");
  return briefs[icao];
}
const needLoad = (icao) => {
  if (GROUND_AIRPORTS.includes(icao) && !groundOf(icao) && !loading[icao]) { loading[icao] = loadGround(icao).then(() => C?.changed("view")); }
  if (briefs[icao] === undefined) brief(icao);
  if (!S.stands[icao] && !loading["st" + icao]) loading["st" + icao] = loadStandsFor({ icao }); // stands of the VDGS project (GitHub)
};

export function render(body, ctx) {
  C = ctx;
  if (!body._apt) { body._apt = true; body.addEventListener("click", onClick); body.addEventListener("change", onChange); }
  const { icao, mode } = current(); needLoad(icao);
  const tab = ctx.tab || "map";
  body.classList.toggle("map-body", tab === "map");
  if (tab !== "map") dropMap();
  const head = bar(icao, mode, tab);
  if (tab === "map") return renderMap(body, icao, mode, head);
  body.innerHTML = head + (tab === "brief" ? briefHtml(icao) : standsHtml(icao, mode));
}

function bar(icao, mode, tab) {
  return `<div class="apt-bar${tab === "map" ? " on-map" : ""}"><div class="seg">${airports().map((a) => `<button data-apt="${a}" class="${a === icao ? "on" : ""}">${a}</button>`).join("")}</div>
    ${tab !== "brief" ? `<div class="seg">${[["dep", t("Departure")], ["arr", t("Arrival")]].map(([k, l]) => `<button data-mode="${k}" class="${k === mode ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}</div>`;
}

// ---------- stands ----------
function standList(icao) {
  const osm = (S.stands[icao] || groundOf(icao)?.points?.filter((p) => p.k === "parking_position" || p.k === "stand").map((p) => ({ ref: p.ref, lat: p.lat, lon: p.lon })) || []);
  const seen = new Map();
  for (const s of osm) if (s.ref && !seen.has(s.ref)) seen.set(s.ref, s);
  const b = briefs[icao];
  if (b?.stands) for (const ref of Object.keys(b.stands)) if (!seen.has(ref)) seen.set(ref, { ref, lat: null, lon: null });
  const order = (r) => r.replace(/(\d+)/g, (x) => x.padStart(3, "0"));
  return [...seen.values()].sort((a, b2) => order(a.ref).localeCompare(order(b2.ref)));
}
const taken = (icao, s) => s.lat != null && (trafficAt(icao) || []).some((p) => p.gs < 5 && distKm([p.lat, p.lon], [s.lat, s.lon]) < 0.035 && p.callsign !== S.pilot?.callsign);
// aircraft within 8 km of the airport (centre: its runways, else its stands)
function trafficAt(icao) {
  const g = groundOf(icao), st = (S.stands[icao] || []).find((x) => x.lat != null);
  const c = (g && centre(g)) || (st ? [st.lat, st.lon] : null);
  return c ? (S.traffic || []).filter((p) => distKm([p.lat, p.lon], c) < 8) : [];
}
function centre(g) { const r = g.runways[0]; return r ? r.g[Math.floor(r.g.length / 2)] : null; }

function standsHtml(icao, mode) {
  const b = briefs[icao], list = standList(icao), span = SPAN[S.ofp?.type] || null;
  const mine = mode === "dep" ? departureStand() : arrivalStand();
  const myRef = icao === (mode === "dep" ? S.ofp?.dep?.icao : S.ofp?.dest?.icao) ? mine?.ref : null;
  if (!list.length) return `<div class="empty">${t("No stand data for this airport yet.")}</div>`;
  const how = (ref) => !b?.stands?.[ref] ? "" : b.vdgs?.includes(ref) ? `<span class="pill ok">VDGS</span>` : b.selfManoeuvring?.includes(ref) ? `<span class="pill">${t("Self-manoeuvring")}</span>` : `<span class="pill">${t("Push-back")}</span>`;
  const rows = list.map((s) => {
    const w = b?.stands?.[s.ref], fits = span && w ? span <= w : null, occ = taken(icao, s);
    return `<tr class="${s.ref === myRef ? "next" : ""}${fits === false ? " past" : ""}"><td><b>${esc(s.ref)}</b>${s.ref === myRef ? ` <span class="pill warn">${mode === "dep" ? t("You") : t("Forecast")}</span>` : ""}</td>
      <td>${w ? w + " m" : "—"}</td><td>${fits == null ? "" : fits ? `<span class="ok">✓</span>` : `<span class="bad">${t("too small")}</span>`}</td>
      <td>${occ ? `<span class="pill bad">${t("taken")}</span>` : s.lat != null && S.feedOk ? `<span class="dim">${t("free")}</span>` : ""}</td><td>${how(s.ref)}</td>
      <td>${s.lat != null ? `<button class="btn small" data-stand="${esc(s.ref)}">${t("Taxi route")}</button>` : ""}</td></tr>`;
  }).join("");
  return `<div class="card"><div class="lbl" style="margin-bottom:6px">${t("Stands")} · ${esc(icao)}${span ? ` · ${t("your aircraft")} ${esc(S.ofp.type)} ${span} m` : ""}</div>
    <table class="t"><thead><tr><th>${t("Stand")}</th><th>${t("Max wingspan")}</th><th>${t("Fits")}</th><th>VATSIM</th><th>${t("Guidance")}</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    <p class="dim" style="font-size:12.5px;margin:10px 0 0">${t("Taken = an aircraft stands there on VATSIM right now. Stand positions: OpenStreetMap.")}</p></div>`;
}

// ---------- briefing ----------
function briefHtml(icao) {
  const b = briefs[icao];
  if (b == null) return `<div class="empty">${t("Loading…")}</div>`;
  if (!b) return `<div class="empty">${t("No briefing for this airport yet. LYBE has a full one.")}</div>`;
  const rw = b.runways.map((r) => `<tr><td><b>${esc(r.id)}</b></td><td>${r.mag}°</td><td>${r.len} × ${r.wid} m</td><td>${r.tora} m</td><td>${r.lda} m</td><td>${esc(r.lights)}</td><td>${esc(r.cat)}</td></tr>`).join("");
  const to = Object.entries(b.takeoff).map(([r, l]) => `<div class="bf-to"><b>${esc(r)}</b>${l.map(([j, d]) => `<span>${j === "head" ? t("full length") : "TWY " + esc(j)} <b>${d} m</b></span>`).join("")}</div>`).join("");
  const ex = Object.entries(b.exits || {}).map(([r, l]) => `<div class="card"><div class="lbl" style="margin-bottom:6px">${t("Vacating RWY {r}", { r })}</div>${l.map((x) => `<div class="bf-ex"><b>${esc(x.twy)}</b><span>${esc(loc(x))}</span></div>`).join("")}</div>`).join("");
  const sec = b.sections.map((s) => `<div class="card"><div class="lbl" style="margin-bottom:8px">${esc(loc(s.title))}</div><ul class="bf-ul">${s.items.map((i) => `<li>${esc(loc(i))}</li>`).join("")}</ul></div>`).join("");
  const hs = b.hotspots.map((h) => `<div class="bf-ex"><b class="hs">${esc(h.id)}</b><span>${esc(loc(h))} <span class="dim">(${h.twys.map(esc).join(" / ")})</span></span></div>`).join("");
  return `<div class="bf">
    <div class="card bf-head"><div><div class="lbl">${t("Airport briefing")}</div><h3>${esc(b.icao)} · ${esc(b.name)}</h3><div class="dim">${t("Elevation {e} ft", { e: b.elev })}</div></div>
      <div class="bf-freq">${b.freq.map(([n, f]) => `<div><span class="lbl">${esc(n)}</span><b class="num">${esc(f)}</b></div>`).join("")}</div></div>
    <div class="card"><div class="lbl" style="margin-bottom:6px">${t("Runways")}</div><table class="t"><thead><tr><th>RWY</th><th>MAG</th><th>${t("Size")}</th><th>TORA</th><th>LDA</th><th>${t("Lights")}</th><th></th></tr></thead><tbody>${rw}</tbody></table></div>
    <div class="card"><div class="lbl" style="margin-bottom:8px">${t("Take-off run available from intersections")}</div><div class="bf-tos">${to}</div></div>
    <div class="bf-2">${ex}</div>
    <div class="card"><div class="lbl" style="margin-bottom:8px">${t("Hot spots")}</div>${hs}</div>
    ${sec}
    <p class="dim" style="font-size:12.5px;margin:4px 2px 0">${esc(loc(b.source))}</p></div>`;
}

// ---------- map ----------
function dropMap() { if (M) { try { M.map.remove(); } catch {} M = null; } }
window.addEventListener("resize", () => M?.map.invalidateSize());

function renderMap(body, icao, mode, head) {
  const G = groundOf(icao);
  if (!G) { dropMap(); body.innerHTML = head + `<div class="empty" style="padding-top:120px">${GROUND_AIRPORTS.includes(icao) ? t("Loading the ground map…") : t("No ground map for {icao} yet. LYBE, LYNI and LYKV have one.", { icao })}</div>`; return; }
  const key = icao + settings.theme;
  if (!M || M.key !== key || !body.contains(M.el)) build(body, G, key);
  body.querySelector(".apt-bar")?.replaceWith(Object.assign(document.createElement("div"), { innerHTML: head }).firstElementChild);
  update(G, icao, mode);
}

function build(body, G, key) {
  dropMap();
  body.innerHTML = `<div class="apt-bar"></div><div class="gmap"></div><div class="gpanel"></div>`;
  const el = body.querySelector(".gmap");
  const map = L.map(el, { zoomControl: false, attributionControl: true, minZoom: 12, maxZoom: 19, zoomSnap: 0.25 });
  map.attributionControl.addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
  L.control.zoom({ position: "bottomright" }).addTo(map);
  const light = settings.theme === "light";
  const col = light ? { apron: "#dfe6f0", twy: "#8b98ab", rwy: "#26303e", lbl: "#0a2447" } : { apron: "#14284a", twy: "#5d6f8c", rwy: "#05070c", lbl: "#cfe0ff" };
  for (const a of G.areas) if (a.k === "apron") L.polygon(a.g, { color: col.apron, weight: 1, fillColor: col.apron, fillOpacity: 1, interactive: false }).addTo(map);
  for (const w of G.ways) if (w.k === "taxiway" || w.k === "taxilane") L.polyline(w.g, { color: col.twy, weight: w.k === "taxilane" ? 2 : 5, opacity: 0.9, interactive: false }).addTo(map);
  const rwys = L.layerGroup().addTo(map);
  for (const w of G.runways) {
    L.polyline(w.g, { color: col.rwy, weight: 16, opacity: 1, lineCap: "butt", interactive: false }).addTo(rwys);
    L.polyline(w.g, { color: "#ffffff", weight: 1.5, dashArray: "10 12", opacity: 0.8, interactive: false }).addTo(rwys);
    for (const id of w.ref.split("/").map((s) => s.trim())) {
      const R = runwayEnd(G, id); if (!R) continue;
      L.marker(R.thr, { icon: L.divIcon({ className: "rwy-lbl", html: esc(id), iconSize: [44, 22], iconAnchor: [22, 11] }), interactive: false }).addTo(rwys);
    }
  }
  // taxiway names: once per name, in the middle of its longest piece
  const labels = L.layerGroup(), best = {};
  for (const w of G.ways) if ((w.k === "taxiway") && w.ref) { const len = w.g.length; if (!best[w.ref] || len > best[w.ref].g.length) best[w.ref] = w; }
  for (const [ref, w] of Object.entries(best)) L.marker(w.g[Math.floor(w.g.length / 2)], { icon: L.divIcon({ className: "twy-lbl", html: esc(ref), iconSize: [40, 16], iconAnchor: [20, 8] }), interactive: false }).addTo(labels);
  const stands = L.layerGroup();
  for (const p of G.points) if ((p.k === "parking_position" || p.k === "stand") && p.ref) {
    L.circleMarker([p.lat, p.lon], { radius: 3, color: "#ffd27a", weight: 1, fillColor: "#ffd27a", fillOpacity: 0.8 }).on("click", () => pickStand(p.ref)).addTo(stands);
    L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "std-lbl", html: esc(p.ref), iconSize: [44, 14], iconAnchor: [-4, 7] }) }).on("click", () => pickStand(p.ref)).addTo(stands);
  }
  const holds = L.layerGroup().addTo(map);
  for (const p of G.points) if (p.k === "holding_position" || p.k === "stopbar") (p.g ? L.polyline(p.g, { color: "#ff3347", weight: 3, interactive: false }) : L.circleMarker([p.lat, p.lon], { radius: 2, color: "#ff3347", weight: 2, interactive: false })).addTo(holds);
  const hot = L.layerGroup();
  const route = L.polyline([], { color: "#ffb21f", weight: 6, opacity: 0.95, interactive: false }).addTo(map);
  const holdMarks = L.layerGroup().addTo(map), traffic = L.layerGroup().addTo(map);
  const ac = L.marker([0, 0], { icon: L.divIcon({ className: "ac-ic me", html: plane(0, "#ffffff"), iconSize: [28, 28], iconAnchor: [14, 14] }), zIndexOffset: 1000 });
  const all = L.featureGroup(G.runways.map((w) => L.polyline(w.g)));
  map.fitBounds(all.getBounds(), { padding: [30, 30] });
  const zoomed = () => { const z = map.getZoom(); z >= 15 ? labels.addTo(map) : labels.remove(); z >= 16 ? stands.addTo(map) : stands.remove(); };
  map.on("zoomend", zoomed); zoomed();
  M = { key, el, body, map, route, holdMarks, traffic, ac, hot, acOn: false, last: "" };
  setTimeout(() => map.invalidateSize(), 60); setTimeout(() => map.invalidateSize(), 450);
}
const plane = (hdg, color) => `<svg viewBox="0 0 24 24" width="28" height="28" style="transform:rotate(${hdg || 0}deg);color:${color}"><path fill="currentColor" stroke="#002e5d" stroke-width=".8" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>`;

// the runway and entry / exit to use
function plan(G, icao, mode) {
  const b = briefs[icao], o = S.ofp;
  const rwyIds = G.runways.flatMap((w) => w.ref.split("/").map((s) => s.trim())).filter(Boolean);
  const planned = o && icao === o.dep?.icao && mode === "dep" ? o.dep.rwy : o && icao === o.dest?.icao && mode === "arr" ? o.dest.rwy : null;
  let rwy = ui.rwy && rwyIds.includes(ui.rwy) ? ui.rwy : rwyIds.includes(planned) ? planned : rwyIds[0];
  const joins = mode === "dep" ? (b?.takeoff?.[rwy]?.map(([j]) => j) || ["head"]) : (b?.exits?.[rwy]?.map((x) => x.twy) || []);
  const join = joins.includes(ui.join) ? ui.join : joins[0] || "head";
  return { rwyIds, rwy, joins, join };
}

function update(G, icao, mode) {
  const { map, route, holdMarks, traffic, ac } = M;
  const P = plan(G, icao, mode);
  // own aircraft, on the ground near this airport
  const me = S.pilot && distKm([S.pilot.latitude, S.pilot.longitude], centre(G) || [0, 0]) < 8 ? S.pilot : null;
  if (me) { ac.setLatLng([me.latitude, me.longitude]).setIcon(L.divIcon({ className: "ac-ic me", html: plane(me.heading, "#ffffff"), iconSize: [28, 28], iconAnchor: [14, 14] })); if (!M.acOn) { ac.addTo(map); M.acOn = true; } }
  else if (M.acOn) { ac.remove(); M.acOn = false; }
  // other aircraft; ours (ASL) in red
  traffic.clearLayers();
  for (const p of trafficAt(icao)) if (p.callsign !== S.pilot?.callsign) {
    const ours = /^ASL\d/.test(p.callsign);
    L.marker([p.lat, p.lon], { icon: L.divIcon({ className: "ac-ic tr" + (ours ? " ours" : ""), html: plane(p.hdg, ours ? "#ff3347" : "#9cb0cf") + `<span>${esc(p.callsign)}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(traffic);
  }
  // stand: the one picked, else where you are / the forecast
  const stands = standList(icao), byRef = (r) => stands.find((s) => s.ref === r && s.lat != null);
  const auto = mode === "dep" ? departureStand()?.ref : arrivalStand()?.ref;
  const stand = byRef(ui.stand) || byRef(auto) || null;
  // route
  const rNode = runwayJoin(G, P.rwy, P.join);
  let R = null, from = null;
  if (mode === "dep") from = me && me.groundspeed < 40 ? nearestTaxiNode(G, [me.latitude, me.longitude]) : stand ? nearestTaxiNode(G, [stand.lat, stand.lon]) : null;
  if (mode === "dep" && from != null && rNode != null) R = taxiRoute(G, from, rNode);
  if (mode === "arr" && rNode != null && stand) R = taxiRoute(G, rNode, nearestTaxiNode(G, [stand.lat, stand.lon]));
  route.setLatLngs(R ? R.pts : []);
  holdMarks.clearLayers();
  const holds = holdsOn(G, R);
  for (const h of holds) L.marker([h.lat, h.lon], { icon: L.divIcon({ className: "hold-lbl", html: `<b>${t("HOLD")}</b>${h.ref ? " " + esc(h.ref) : ""}`, iconSize: [80, 18], iconAnchor: [-6, 9] }), interactive: false }).addTo(holdMarks);
  // hot spots from the briefing
  const b = briefs[icao];
  if (b?.hotspots && !M.hotDone) {
    for (const h of b.hotspots) { const p = meetPoint(G, h.twys[0], h.twys[1]); if (!p) continue;
      L.circle(p, { radius: 70, color: "#d64dff", weight: 2, fill: false, interactive: false }).addTo(M.hot);
      L.marker(p, { icon: L.divIcon({ className: "hs-lbl", html: esc(h.id), iconSize: [40, 16], iconAnchor: [20, -40] }), interactive: false }).addTo(M.hot); }
    M.hot.addTo(map); M.hotDone = true;
  }
  const sig = [icao, mode, P.rwy, P.join, stand?.ref].join("|");
  if (R && sig !== M.last) { map.fitBounds(L.polyline(R.pts).getBounds(), { padding: [70, 70], maxZoom: 17 }); }
  M.last = sig;
  // the panel
  const pick = (k, list, cur, lbl) => `<div class="gp-row"><span class="lbl">${lbl}</span><div class="seg">${list.map((v) => `<button data-${k}="${esc(v)}" class="${v === cur ? "on" : ""}">${v === "head" ? t("full") : esc(v)}</button>`).join("")}</div></div>`;
  const len = R ? Math.round(R.len) : 0;
  M.body.querySelector(".gpanel").innerHTML = `
    ${pick("rwy", P.rwyIds, P.rwy, "RWY")}
    ${P.joins.length ? pick("join", P.joins, P.join, mode === "dep" ? t("Entry") : t("Exit")) : ""}
    <div class="gp-row"><span class="lbl">${t("Stand")}</span><select data-k="stand"><option value="">${mode === "dep" && me ? t("where you are") : "—"}</option>${stands.filter((s) => s.lat != null).map((s) => `<option ${s.ref === stand?.ref ? "selected" : ""}>${esc(s.ref)}</option>`).join("")}</select></div>
    ${R ? `<div class="gp-route"><div class="lbl">${t("Taxi route")} · ${len.toLocaleString()} m · ~${Math.max(1, Math.round(len / 1000 / 25 * 60))} min</div><b>${R.names.map(esc).join(" → ") || "—"}</b>
      ${holds.length ? `<div class="gp-hold">${t("Hold short")}: ${holds.map((h) => esc(h.ref || "●")).join(", ")}</div>` : ""}</div>`
      : `<div class="gp-route dim">${mode === "dep" ? t("Pick your stand, or connect to VATSIM, for a taxi route.") : t("Pick a stand for a taxi route from your exit.")}</div>`}
    <p class="gp-note">${t("Suggested route along the taxiways – always follow the instructions of ATC.")}</p>`;
}

function pickStand(ref) { ui.stand = ref; saveUi(); C?.changed("view"); }

function onClick(e) {
  const b = e.target.closest("[data-apt],[data-mode],[data-rwy],[data-join],[data-stand]"); if (!b) return;
  if (b.dataset.apt) { ui.icao = b.dataset.apt; ui.rwy = ui.join = ui.stand = null; }
  if (b.dataset.mode) { ui.mode = b.dataset.mode; ui.join = null; }
  if (b.dataset.rwy) { ui.rwy = b.dataset.rwy; ui.join = null; }
  if (b.dataset.join) ui.join = b.dataset.join;
  if (b.dataset.stand) { ui.stand = b.dataset.stand; saveUi(); C.setTab("map"); return; }
  saveUi(); C.changed("view");
}
function onChange(e) { if (e.target.matches("select[data-k=stand]")) { ui.stand = e.target.value || null; saveUi(); C.changed("view"); } }
