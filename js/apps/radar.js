// VATSIM Radar and IVAO Radar: the whole network on a map the pad draws itself (Leaflet, open basemap, canvas dots).
// Every flight and staffed station, search by callsign / airport / ID, Air Serbia in red, your own flight with a ring.
// VATSIM comes from the pad's feed (every 20 s); IVAO from its public tracker while the app is open (every 15 s).
import { S, settings } from "../data.js";
import { t, nf } from "../i18n.js";
import { esc, getJSON, greatCircle } from "../util.js";
import { aptDb } from "../tz.js";
import { drawWorld } from "./map.js";

const L = window.L;
const FAC = { 1: "FSS", 2: "DEL", 3: "GND", 4: "TWR", 5: "APP", 6: "CTR" };
const IVAO_URL = "https://api.ivao.aero/v2/tracker/whazzup";

function make(net) {
  let C = null, M = null, q = "", sel = null, ivao = null, ivaoAt = 0, ivaoErr = "";
  const data = () => (net === "vatsim" ? S.net : ivao);
  async function pollIvao() {
    if (net !== "ivao" || Date.now() - ivaoAt < 15e3) return; ivaoAt = Date.now();
    try {
      const d = await getJSON(IVAO_URL, 20000), cl = d.clients || {};
      ivao = { at: Date.now(),
        pilots: (cl.pilots || []).filter((p) => p.lastTrack).map((p) => ({ cs: p.callsign, cid: p.userId, lat: p.lastTrack.latitude, lon: p.lastTrack.longitude, alt: p.lastTrack.altitude, gs: p.lastTrack.groundSpeed,
          hdg: p.lastTrack.heading, dep: p.flightPlan?.departureId || "", arr: p.flightPlan?.arrivalId || "", type: p.flightPlan?.aircraftId || "", route: p.flightPlan?.route || "", name: "" })),
        ctrl: (cl.atcs || []).map((c) => ({ cs: c.callsign, f: String(c.atcSession?.frequency || ""), fac: /_CTR$/.test(c.callsign) ? 6 : /_APP|_DEP/.test(c.callsign) ? 5 : /_TWR/.test(c.callsign) ? 4 : /_GND/.test(c.callsign) ? 3 : /_DEL/.test(c.callsign) ? 2 : 1, name: "", cid: c.userId,
          lat: c.lastTrack?.latitude, lon: c.lastTrack?.longitude })) };
      ivaoErr = "";
    } catch { ivaoErr = t("IVAO data not reachable right now."); }
    C?.changed("view");
  }
  const mine = (p) => (net === "vatsim" ? (settings.cid && +settings.cid === +p.cid) || (S.ofp && p.cs === S.ofp.callsign) : (settings.ivao && +settings.ivao === +p.cid) || (S.ofp && p.cs === S.ofp.callsign));

  function build(body) {
    if (M) { try { M.map.remove(); } catch {} }
    body.innerHTML = `<div class="rad"><div class="rad-map"></div><div class="rad-bar"><input class="rad-q" placeholder="${t("Callsign, airport or ID")}" autocapitalize="characters" spellcheck="false"><span class="rad-n"></span></div><div class="rad-pop" hidden></div></div>`;
    const el = body.querySelector(".rad-map");
    const map = L.map(el, { zoomControl: false, minZoom: 2, zoomSnap: 0.5, worldCopyJump: true, preferCanvas: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 12,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a> · Natural Earth' }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    drawWorld(map, false);
    const r = L.canvas({ padding: 0.3 }), dots = L.layerGroup().addTo(map), atc = L.layerGroup().addTo(map), route = L.layerGroup().addTo(map);
    map.setView(S.pilot ? [S.pilot.latitude, S.pilot.longitude] : [46, 15], S.pilot ? 6 : 4);
    M = { map, el, body, r, dots, atc, route, key: "" };
    body.querySelector(".rad-q").addEventListener("input", (e) => { q = e.target.value.trim().toUpperCase(); draw(); });
    body.querySelector(".rad-q").addEventListener("keydown", (e) => { if (e.key === "Enter") { const hit = match()[0]; if (hit) pick(hit, true); } });
    setTimeout(() => map.invalidateSize(), 80);
  }
  const match = () => { const d = data(); if (!d || !q) return []; return d.pilots.filter((p) => p.cs.includes(q) || p.dep === q || p.arr === q || String(p.cid) === q); };
  function pick(p, fly) {
    sel = p.cs; draw();
    if (fly) M.map.setView([p.lat, p.lon], Math.max(M.map.getZoom(), 6));
  }
  function draw() {
    const d = data(); if (!M) return;
    M.dots.clearLayers(); M.atc.clearLayers(); M.route.clearLayers();
    if (!d) { M.body.querySelector(".rad-n").textContent = ivaoErr || t("Loading…"); return; }
    const hits = new Set(match().map((p) => p.cs));
    for (const p of d.pilots) {
      const ours = /^ASL\d/.test(p.cs), me = mine(p), hit = hits.has(p.cs), isSel = p.cs === sel;
      const c = L.circleMarker([p.lat, p.lon], { renderer: M.r, radius: me ? 6 : ours || hit || isSel ? 4.5 : 2.6, weight: me ? 3 : 1, color: me ? "#fff" : ours ? "#ff3347" : hit ? "#ffd200" : net === "ivao" ? "#7fb2ff" : "#9fe8c4",
        fillColor: me ? "#e3001f" : ours ? "#e3001f" : hit ? "#ffd200" : net === "ivao" ? "#7fb2ff" : "#9fe8c4", fillOpacity: p.gs < 40 ? 0.45 : 0.95 }).on("click", () => pick(p)).addTo(M.dots);
      if (me) L.circleMarker([p.lat, p.lon], { renderer: M.r, radius: 14, weight: 2, color: "#e3001f", fill: false, interactive: false }).addTo(M.dots);
      if (ours || me || isSel) L.marker([p.lat, p.lon], { interactive: false, icon: L.divIcon({ className: "rad-lbl" + (ours ? " asl" : ""), html: esc(p.cs), iconSize: [80, 14], iconAnchor: [-8, 7] }) }).addTo(M.dots);
      if (isSel || me) { const a = aptDb(p.dep), b = aptDb(p.arr);
        if (a) L.polyline(greatCircle([a[0], a[1]], [p.lat, p.lon], 24), { color: "#ffffff", weight: 1.5, opacity: 0.5, interactive: false }).addTo(M.route);
        if (b) L.polyline(greatCircle([p.lat, p.lon], [b[0], b[1]], 32), { color: "#ffd200", weight: 1.5, opacity: 0.8, dashArray: "5 6", interactive: false }).addTo(M.route); }
    }
    // staffed airports (position from the airport list) – one label with the letters of the stations
    const byApt = new Map();
    for (const c of d.ctrl) {
      const pre = c.cs.split("_")[0], ap = c.lat != null ? [c.lat, c.lon] : aptDb(pre) || aptDb("K" + pre);
      if (!ap || c.fac === 6 || c.fac === 1) continue;
      const k = pre; if (!byApt.has(k)) byApt.set(k, { pos: [ap[0], ap[1]], st: new Set(), list: [] });
      byApt.get(k).st.add(FAC[c.fac] || ""); byApt.get(k).list.push(c);
    }
    for (const [k, a] of byApt) L.marker(a.pos, { icon: L.divIcon({ className: "rad-apt", html: `<b>${esc(k)}</b><span>${[...a.st].filter(Boolean).map((x) => x[0]).join("")}</span>`, iconSize: [60, 16], iconAnchor: [30, 8] }) })
      .on("click", () => { sel = null; showApt(k, a.list); }).addTo(M.atc);
    M.body.querySelector(".rad-n").textContent = `${nf(d.pilots.length)} ${t("flights")} · ${nf(d.ctrl.length)} ATC${q ? ` · ${hits.size} ${t("found")}` : ""}${ivaoErr ? " · " + ivaoErr : ""}`;
    const s = d.pilots.find((p) => p.cs === sel);
    if (s) showPilot(s);
  }
  function showPilot(p) {
    const pop = M.body.querySelector(".rad-pop"); pop.hidden = false;
    pop.innerHTML = `<button class="rad-x" data-rad="x">×</button><div class="lbl">${net === "vatsim" ? "VATSIM" : "IVAO"} · ${esc(String(p.cid || ""))}</div><h3>${esc(p.cs)}</h3>
      <div class="rad-kv"><div><span>${t("Route")}</span><b>${esc(p.dep || "—")} → ${esc(p.arr || "—")}</b></div><div><span>${t("Type")}</span><b>${esc(p.type || "—")}</b></div>
      <div><span>${t("Altitude")}</span><b>${p.alt > 10500 ? "FL" + Math.round(p.alt / 100) : nf(p.alt) + " ft"}</b></div><div><span>GS</span><b>${p.gs} kt</b></div></div>${p.route ? `<div class="rad-rte">${esc(p.route.slice(0, 300))}</div>` : ""}`;
  }
  function showApt(k, list) {
    const pop = M.body.querySelector(".rad-pop"); pop.hidden = false;
    pop.innerHTML = `<button class="rad-x" data-rad="x">×</button><div class="lbl">ATC</div><h3>${esc(k)}</h3>${list.sort((a, b) => b.fac - a.fac).map((c) => `<div class="rad-row"><b>${esc(c.cs)}</b><span class="num">${esc(c.f)}</span></div>`).join("")}`;
  }
  return {
    name: net === "vatsim" ? "VATSIM Radar" : "IVAO Radar", tabs: [],
    summary: () => [net === "vatsim" ? "VATSIM Radar" : "IVAO Radar", data() ? `${nf(data().pilots.length)} ${t("flights")}` : t("Loading…")],
    render(body, ctx) {
      C = ctx; body.classList.add("map-body");
      if (!body._rad) { body._rad = true; body.addEventListener("click", (e) => { if (e.target.closest("[data-rad=x]")) { sel = null; e.target.closest(".rad-pop").hidden = true; draw(); } }); }
      if (!M || !body.contains(M.el)) build(body);
      pollIvao();
      const d = data(), key = d?.at + q + sel;
      if (key !== M.key) { M.key = key; draw(); }
    },
  };
}
export const Vatsim = make("vatsim");
export const Ivao = make("ivao");
