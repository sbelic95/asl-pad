// ASL Fly map: planned route, flown track, the aircraft, airports, fix details and the vertical profile.
import { S, settings } from "../data.js";
import { t, nf } from "../i18n.js";
import { esc, hhmmz, greatCircle, store, distNm, bearing, dur } from "../util.js";
import { activeSigmets, hazardOf, levels } from "../sigmet.js";
import { fmtW } from "../units.js";
import { tocTod, planAt, project } from "../flight.js";

const L = window.L;
let M = null;
const pref = { follow: true, labels: true, rings: false, sigmet: true, ...store.get("asl.map", {}) };
const savePref = () => store.set("asl.map", { follow: pref.follow, labels: pref.labels, rings: pref.rings, sigmet: pref.sigmet });
const RINGS = [25, 50, 100, 200]; // NM

window.addEventListener("resize", () => M?.map.invalidateSize());
export function dropMap() { if (M) { try { M.map.remove(); } catch {} M = null; } }

// keep longitudes continuous across the date line, so a route over the Pacific draws as one line
function unwrap(pts) {
  const out = []; let off = 0, prev = null;
  for (const [la, lo] of pts) {
    let x = lo + off;
    if (prev != null) { while (x - prev > 180) { off -= 360; x -= 360; } while (x - prev < -180) { off += 360; x += 360; } }
    out.push([la, x]); prev = x;
  }
  return out;
}
const nearLon = (lo, ref) => { while (lo - ref > 180) lo -= 360; while (lo - ref < -180) lo += 360; return lo; };

function routePoints(nl) {
  const pts = [];
  for (let i = 0; i < nl.length - 1; i++) {
    const n = Math.max(2, Math.min(40, Math.round((nl[i + 1].legNm || 0) / 40)));
    const seg = greatCircle(nl[i].pos, nl[i + 1].pos, n);
    pts.push(...(i ? seg.slice(1) : seg));
  }
  return pts.length ? pts : nl.map((x) => x.pos);
}

const tiles = () => (settings.theme === "light" ? "light_all" : "dark_all");
const planeSvg = (hdg) => `<svg viewBox="0 0 24 24" width="30" height="30" style="transform:rotate(${hdg || 0}deg)"><path fill="currentColor" stroke="#002e5d" stroke-width=".8" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>`;

export function renderMap(body, o, d) {
  const key = o.id + o.callsign + settings.theme;
  if (!M || M.key !== key || !body.contains(M.el)) build(body, o, key);
  update(o, d);
}

function build(body, o, key) {
  dropMap();
  body.innerHTML = `<div class="mapbox"></div>
    <div class="map-ctrl"><div class="grp"><button data-m="follow">${t("FOLLOW")}</button><button data-m="route">${t("ROUTE")}</button></div>
      <div class="grp"><button data-m="labels">${t("LABELS")}</button><button data-m="sigmet">SIGMET</button></div>
      <div class="grp"><button data-m="measure">${t("MEASURE")}</button><button data-m="rings">${t("RINGS")}</button></div></div>
    <div class="measure-info" hidden></div>
    <div class="fixpop" hidden></div><div class="profile"></div>`;
  const el = body.querySelector(".mapbox");
  const map = L.map(el, { zoomControl: false, attributionControl: true, worldCopyJump: false, minZoom: 2, zoomSnap: 0.5 });
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/${tiles()}/{z}/{x}/{y}{r}.png`, {
    subdomains: "abcd", maxZoom: 13, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  const nl = o.navlog;
  const fixPts = unwrap(nl.map((x) => x.pos));
  const line = unwrap(routePoints(nl));
  const routeCol = getComputedStyle(document.documentElement).getPropertyValue("--route").trim() || "#4da3ff";
  const route = L.polyline(line, { color: routeCol, weight: 3, opacity: 0.9, interactive: false }).addTo(map);
  const flown = L.polyline([], { color: settings.theme === "light" ? "#002e5d" : "#ffffff", weight: 3, opacity: 0.95, interactive: false }).addTo(map);
  const labels = L.layerGroup(), dots = L.layerGroup().addTo(map);
  nl.forEach((x, k) => {
    if (k === 0 || k === nl.length - 1) return;
    const p = fixPts[k];
    L.circleMarker(p, { radius: 3.5, color: "#ffd27a", weight: 1.5, fillColor: "#0b2348", fillOpacity: 1 }).on("click", () => showFix(k)).addTo(dots);
    L.marker(p, { icon: L.divIcon({ className: "fix-lbl", html: esc(x.ident), iconSize: [70, 14], iconAnchor: [-7, 7] }), interactive: true }).on("click", () => showFix(k)).addTo(labels);
  });
  if (pref.labels) labels.addTo(map);
  // airports: departure, destination, alternates, EDTO
  const ref = fixPts[Math.floor(fixPts.length / 2)]?.[1] ?? 0;
  const apt = (a, cls) => {
    if (!a?.pos) return;
    const p = [a.pos[0], nearLon(a.pos[1], ref)];
    const col = cls === "altn" ? "#c8a8ff" : cls === "edto" ? "#6fe3e3" : "#7dffb4";
    L.circleMarker(p, { radius: 5, color: col, weight: 2, fillColor: col, fillOpacity: 0.35 }).addTo(map);
    L.marker(p, { icon: L.divIcon({ className: "apt-lbl " + cls, html: esc(a.icao), iconSize: [50, 14], iconAnchor: [-8, 7] }), interactive: false }).addTo(map);
  };
  apt(o.dep, ""); apt(o.dest, ""); o.altns.forEach((a) => apt(a, "altn")); (o.edto?.airports || []).forEach((a) => apt(a, "edto"));

  const ac = L.marker(fixPts[0], { icon: L.divIcon({ className: "ac-ic", html: planeSvg(0), iconSize: [30, 30], iconAnchor: [15, 15] }), zIndexOffset: 1000 });
  // tools: measure, range rings, direct to, SIGMETs
  const tools = L.layerGroup().addTo(map), rings = L.layerGroup(), dct = L.layerGroup().addTo(map), sig = L.layerGroup();
  M = { key, el, body, map, route, flown, labels, ac, fixPts, line, ref, acOn: false, sel: null, prof: { n: -1, pts: [] },
    tools, rings, dct, sig, measure: false, mpts: [], dctTo: null, sigKey: "" };
  map.on("click", (e) => { if (M.measure) measureAt(e.latlng); });
  if (pref.rings) rings.addTo(map);
  if (pref.sigmet) sig.addTo(map);
  map.fitBounds(route.getBounds(), { padding: [40, 40] });
  map.on("dragstart", () => { if (pref.follow) { pref.follow = false; savePref(); ctrlState(); } });
  body.querySelector(".map-ctrl").addEventListener("click", (e) => {
    const b = e.target.closest("[data-m]"); if (!b) return;
    if (b.dataset.m === "follow") { pref.follow = !pref.follow; savePref(); if (pref.follow && M.acOn) map.setView(ac.getLatLng(), Math.max(map.getZoom(), 6)); }
    if (b.dataset.m === "route") { pref.follow = false; savePref(); map.fitBounds(route.getBounds(), { padding: [40, 40] }); }
    if (b.dataset.m === "labels") { pref.labels = !pref.labels; savePref(); pref.labels ? labels.addTo(map) : labels.remove(); }
    if (b.dataset.m === "sigmet") { pref.sigmet = !pref.sigmet; savePref(); pref.sigmet ? M.sig.addTo(map) : M.sig.remove(); }
    if (b.dataset.m === "rings") { pref.rings = !pref.rings; savePref(); pref.rings ? M.rings.addTo(map) : M.rings.remove(); drawRings(); }
    if (b.dataset.m === "measure") { M.measure = !M.measure; M.mpts = []; M.tools.clearLayers(); measureInfo(); el.classList.toggle("measuring", M.measure); }
    ctrlState();
  });
  body.querySelector(".fixpop").addEventListener("click", (e) => {
    if (e.target.closest(".x")) { M.sel = null; e.currentTarget.hidden = true; return; }
    const d = e.target.closest("[data-dct]"); if (d) { M.dctTo = M.dctTo === +d.dataset.dct ? null : +d.dataset.dct; drawDct(); showFix(M.sel); }
  });
  ctrlState();
  setTimeout(() => map.invalidateSize(), 60); setTimeout(() => map.invalidateSize(), 450);
}
function ctrlState() {
  if (!M) return;
  M.body.querySelector('[data-m="follow"]').classList.toggle("on", pref.follow);
  M.body.querySelector('[data-m="labels"]').classList.toggle("on", pref.labels);
  M.body.querySelector('[data-m="sigmet"]').classList.toggle("on", pref.sigmet);
  M.body.querySelector('[data-m="rings"]').classList.toggle("on", pref.rings);
  M.body.querySelector('[data-m="measure"]').classList.toggle("on", M.measure);
}

// ---------- measure: tap two points ----------
function measureAt(ll) {
  if (M.mpts.length >= 2) { M.mpts = []; M.tools.clearLayers(); }
  M.mpts.push([ll.lat, ll.lng]);
  L.circleMarker(ll, { radius: 4, color: "#fff", weight: 2, fillColor: "#ffb21f", fillOpacity: 1 }).addTo(M.tools);
  if (M.mpts.length === 2) {
    const [a, b] = M.mpts;
    L.polyline(greatCircle(a, b, 24), { color: "#ffb21f", weight: 2.5, dashArray: "6 6" }).addTo(M.tools);
  }
  measureInfo();
}
function measureInfo() {
  const box = M.body.querySelector(".measure-info");
  if (!M.measure) { box.hidden = true; return; }
  box.hidden = false;
  if (M.mpts.length < 2) { box.innerHTML = t("Tap two points on the map."); return; }
  const [a, b] = M.mpts, nm = distNm(a, b), gs = S.pilot?.groundspeed;
  box.innerHTML = `<b>${nf(nm, nm < 10 ? 1 : 0)} NM</b> · ${String(Math.round(bearing(a, b))).padStart(3, "0")}°T${gs > 50 ? ` · ${t("at {gs} kt", { gs })} ${dur((nm / gs) * 36e5)}` : ""}`;
}

// ---------- range rings around the aircraft (else the departure airport) ----------
function drawRings() {
  if (!M || !pref.rings) return;
  const pl = S.pilot, o = S.ofp, c = pl ? [pl.latitude, nearLon(pl.longitude, M.ref)] : o?.dep?.pos;
  if (!c) return;
  const k = c.map((x) => x.toFixed(2)).join();
  if (M.ringKey === k) return;
  M.ringKey = k; M.rings.clearLayers();
  for (const nm of RINGS) {
    L.circle(c, { radius: nm * 1852, color: "#9cc4ff", weight: 1, opacity: 0.7, fill: false, dashArray: "4 6", interactive: false }).addTo(M.rings);
    L.marker([c[0] + nm / 60, c[1]], { icon: L.divIcon({ className: "ring-lbl", html: nm + " NM", iconSize: [60, 14], iconAnchor: [30, 7] }), interactive: false }).addTo(M.rings);
  }
}

// ---------- direct to a fix of the route ----------
function dctInfo(k) {
  const o = S.ofp, pl = S.pilot, x = o.navlog[k];
  if (!pl) return null;
  const from = [pl.latitude, pl.longitude], nm = distNm(from, x.pos);
  const along = S.pr ? x.cumNm - S.pr.along : null; // via the route
  return { nm, crs: bearing(from, x.pos), ete: pl.groundspeed > 50 ? (nm / pl.groundspeed) * 36e5 : null, save: along != null && along > nm ? along - nm : null };
}
function drawDct() {
  M.dct.clearLayers();
  if (M.dctTo == null || !S.pilot) return;
  const x = S.ofp.navlog[M.dctTo];
  L.polyline(greatCircle([S.pilot.latitude, S.pilot.longitude], x.pos, 24).map(([a, b]) => [a, nearLon(b, M.ref)]), { color: "#ff4fd8", weight: 3, dashArray: "8 6", interactive: false }).addTo(M.dct);
}

// ---------- SIGMETs ----------
function drawSigmets() {
  const list = activeSigmets(), k = list.length + ":" + (S.sigmets?.[0]?.raw || "").slice(0, 20);
  if (M.sigKey === k) return;
  M.sigKey = k; M.sig.clearLayers();
  for (const s of list) {
    const [col, name] = hazardOf(s), poly = s.poly.map(([la, lo]) => [la, nearLon(lo, M.ref)]);
    L.polygon(poly, { color: col, weight: 1.5, fillColor: col, fillOpacity: 0.16 })
      .on("click", (e) => { if (M.measure) { measureAt(e.latlng); setTimeout(() => M.map.closePopup(), 0); } })
      .bindPopup(`<b>${esc(t(name))}</b> ${esc(s.qual || "")} ${esc(levels(s))}<br><span style="font-size:11px">${esc(s.fir)} · ${s.to ? t("valid until {t}", { t: hhmmz(Date.parse(s.to)) }) : ""}</span><div class="wx-raw" style="margin-top:6px">${esc(s.raw || "")}</div>`, { maxWidth: 360 })
      .addTo(M.sig);
  }
}

function update(o, d) {
  const st = S.st, pl = S.pilot;
  // flown track (ours), then the aircraft
  const tr = unwrap(st.track.map((x) => [x[0], x[1]]));
  if (tr.length) { const shift = nearLon(tr[0][1], M.ref) - tr[0][1]; M.flown.setLatLngs(tr.map((p) => [p[0], p[1] + shift])); }
  if (pl && !st.onBlock) {
    const p = [pl.latitude, nearLon(pl.longitude, tr.length ? M.flown.getLatLngs().at(-1).lng : M.ref)];
    M.ac.setLatLng(p).setIcon(L.divIcon({ className: "ac-ic", html: planeSvg(pl.heading), iconSize: [30, 30], iconAnchor: [15, 15] }));
    if (!M.acOn) { M.ac.addTo(M.map); M.acOn = true; if (pref.follow && st.takeoff) M.map.setView(p, 6); }
    else if (pref.follow) M.map.panTo(p, { animate: true, duration: 0.6 });
  } else if (M.acOn) { M.ac.remove(); M.acOn = false; }
  if (M.sel != null) showFix(M.sel);
  drawRings(); drawDct(); drawSigmets(); measureInfo();
  profile(o, d);
}

function showFix(k) {
  const o = S.ofp, x = o.navlog[k], st = S.st, pr = S.pr, box = M.body.querySelector(".fixpop");
  M.sel = k;
  const air = st.takeoff && !st.landing;
  const ata = st.fixTimes[k + ":" + x.ident];
  const tPos = air && pr ? planAt(o.navlog, pr, "t") ?? 0 : 0;
  const eta = (air ? Date.now() - tPos * 1000 : (st.takeoff || o.times.off)) + (x.t || 0) * 1000;
  const total = o.navlog.at(-1).cumNm;
  const cell = (l, v) => `<div><div class="lbl">${l}</div><div class="v">${v}</div></div>`;
  box.innerHTML = `<button class="x" aria-label="${t("Close")}">×</button><h3>${esc(x.ident)} <span class="dim" style="font:500 13px var(--f-ui)">${esc(x.name && x.name !== x.ident ? x.name : "")}</span><small>${esc(x.airway || "")}</small></h3>
    <div class="kv">${cell(t("Alt"), (x.alt >= 10000 ? "FL" + Math.round(x.alt / 100) : nf(x.alt) + " ft"))}${cell(t("Wind"), x.wind?.[1] != null ? String(x.wind[0]).padStart(3, "0") + "/" + x.wind[1] : "—")}
      ${cell("OAT / ISA", x.oat != null ? `${x.oat}° / ${x.isa > 0 ? "+" : ""}${x.isa ?? 0}` : "—")}${cell("MORA", x.mora != null ? nf(x.mora) + " ft" : "—")}
      ${cell(t("From dep."), nf(x.cumNm) + " NM")}${cell(t("To go"), nf(total - x.cumNm) + " NM")}
      ${cell(ata ? "ATA" : "ETA", hhmmz(ata || eta))}${cell("FOB", fmtW(x.fob, o) + `<small> ${t("min")} ${fmtW(x.fobMin, o, { bare: true })}</small>`)}</div>
    ${(() => { const D = air && !ata ? dctInfo(k) : null; if (!D) return "";
      return `<div class="dct-row"><button class="btn small ${M.dctTo === k ? "pri" : ""}" data-dct="${k}">${t("Direct to")} ${esc(x.ident)}</button>
        <span><b>${String(Math.round(D.crs)).padStart(3, "0")}°T</b> · ${nf(D.nm)} NM${D.ete ? " · " + dur(D.ete) : ""}${D.save ? ` · <span class="ok">${t("{n} NM shorter", { n: nf(D.save) })}</span>` : ""}</span></div>`; })()}`;
  box.hidden = false;
}

// vertical profile: planned altitude, terrain, flown altitude and the aircraft
function profile(o, d) {
  const box = M.body.querySelector(".profile"); if (!box) return;
  const W = Math.max(300, box.clientWidth - 28), H = Math.max(100, box.clientHeight - 62);
  const nl = o.navlog, total = d.total || nl.at(-1).cumNm || 1;
  const top = Math.max(o.cruise || 0, ...nl.map((x) => x.alt || 0)) + 4000;
  const X = (nm) => 38 + (nm / total) * (W - 46), Y = (ft) => 6 + (1 - Math.max(0, ft) / top) * (H - 18);
  const plan = nl.map((x) => `${X(x.cumNm).toFixed(1)},${Y(x.alt ?? 0).toFixed(1)}`).join(" ");
  const ground = nl.map((x) => `${X(x.cumNm).toFixed(1)},${Y(Math.max(x.ground || 0, 0)).toFixed(1)}`);
  const terr = `${X(0)},${Y(0)} ${ground.join(" ")} ${X(total)},${Y(0)}`;
  // flown altitudes along the route (projected once per new track point)
  const st = S.st;
  if (M.prof.n !== st.track.length) {
    let hint = 0;
    M.prof.pts = st.track.map((p) => { const pr = project(nl, [p[0], p[1]], hint); if (pr) hint = pr.i; return pr ? [pr.along, p[2]] : null; }).filter(Boolean);
    M.prof.n = st.track.length;
  }
  const flown = M.prof.pts.map(([a, alt]) => `${X(a).toFixed(1)},${Y(alt).toFixed(1)}`).join(" ");
  const { toc, tod } = tocTod(o);
  const vline = (nm, l) => (nm == null ? "" : `<line x1="${X(nm)}" x2="${X(nm)}" y1="4" y2="${H - 12}" stroke="var(--faint)" stroke-dasharray="3 4"/><text x="${X(nm) + 4}" y="14" fill="var(--dim)" font-size="10" font-family="var(--f-cond)">${l}</text>`);
  const grid = [10000, 20000, 30000, 40000].filter((f) => f < top).map((f) => `<line x1="38" x2="${W - 8}" y1="${Y(f)}" y2="${Y(f)}" stroke="var(--line)"/><text x="0" y="${Y(f) + 3}" fill="var(--faint)" font-size="10" font-family="var(--f-num)">FL${f / 100}</text>`).join("");
  const stepNm = total > 2500 ? 500 : total > 1000 ? 250 : total > 400 ? 100 : 50;
  const xt = []; for (let n = stepNm; n < total; n += stepNm) xt.push(`<text x="${X(n)}" y="${H}" fill="var(--faint)" font-size="10" text-anchor="middle" font-family="var(--f-num)">${n}</text>`);
  const pl = S.pilot, air = st.takeoff && !st.landing;
  const ac = air && pl ? `<circle cx="${X(d.along)}" cy="${Y(pl.altitude)}" r="5.5" fill="#fff" stroke="var(--accent)" stroke-width="3"/><text x="${X(d.along) + 9}" y="${Y(pl.altitude) - 8}" fill="var(--fg)" font-size="11" font-weight="700" font-family="var(--f-num)">${pl.altitude >= 10000 ? "FL" + Math.round(pl.altitude / 100) : nf(pl.altitude) + " ft"}</text>` : "";
  box.innerHTML = `<div class="pf-h"><span>${t("Vertical profile")}</span><span style="flex:1"></span>${air && d.next ? `<span>${t("Next fix")} <b>${esc(d.next.ident)}</b> ${nf(d.nextIn)} NM · ${hhmmz(d.nextEta)}</span>` : ""}
      <span><b>${nf(d.toGo)}</b> NM ${t("to go")}</span>${d.est?.on ? `<span>ETA <b>${hhmmz(d.est.on)}</b></span>` : ""}</div>
    <svg width="${W}" height="${H + 6}" viewBox="0 0 ${W} ${H + 6}">${grid}
    <polygon points="${terr}" fill="rgba(140,110,70,.35)" stroke="rgba(190,150,90,.6)" stroke-width="1"/>
    ${vline(toc, "TOC")}${vline(tod, "TOD")}
    <polyline points="${plan}" fill="none" stroke="var(--route)" stroke-width="2" stroke-dasharray="6 4"/>
    ${flown ? `<polyline points="${flown}" fill="none" stroke="var(--flown)" stroke-width="2.4"/>` : ""}
    <text x="38" y="${H}" fill="var(--dim)" font-size="10" font-family="var(--f-cond)">${esc(o.dep.icao)}</text><text x="${W - 8}" y="${H}" fill="var(--dim)" font-size="10" text-anchor="end" font-family="var(--f-cond)">${esc(o.dest.icao)}</text>
    ${xt.join("")}${ac}</svg>`;
}
