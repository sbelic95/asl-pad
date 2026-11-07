// Logbook: every flight that reached on-block, plus flights added by hand. Stats, details with a route map, export and import.
import { S, logbook, saveLogbook, addToLogbook } from "../data.js";
import { t, nf, dateShort, LOCALE } from "../i18n.js";
import { esc, hhmmz, dur, distNm, greatCircle } from "../util.js";
import { aptDb } from "../tz.js";
import { sheet } from "../sheet.js";

export const name = "Logbook";
export const tabs = [];

let C = null;
export function render(body, ctx) {
  C = ctx;
  if (!body._log) { body._log = true; body.addEventListener("click", onClick); }
  const list = logbook();
  body.innerHTML = hero(list) + toolbar() + (list.length ? months(list) : `<div class="empty">${t("No flights yet. Flights are added when you reach the gate.")}</div>`);
}
export function summary() {
  const l = logbook();
  return [t("Logbook"), `${t(l.length === 1 ? "{n} flight" : "{n} flights", { n: l.length })}\n${t("{t} block time", { t: dur(l.reduce((s, e) => s + blockOf(e), 0)) })}${l[0] ? `\n${t("Last")}: ${l[0].flightNo} ${l[0].dep}–${l[0].arr}` : ""}`];
}

const blockOf = (e) => (e.onBlock && e.offBlock ? e.onBlock - e.offBlock : e.schedIn && e.schedOut ? e.schedIn - e.schedOut : 0);
const airOf = (e) => (e.landing && e.takeoff ? e.landing - e.takeoff : 0);

function hero(list) {
  const block = list.reduce((s, e) => s + blockOf(e), 0), dist = list.reduce((s, e) => s + (e.distNm || 0), 0);
  const apts = new Set(list.flatMap((e) => [e.dep, e.arr]));
  const types = {}; list.forEach((e) => (types[e.type] = (types[e.type] || 0) + 1));
  const top = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
  const c = (l, v, s) => `<div><div class="lbl">${l}</div><div class="big">${v}</div>${s ? `<div class="dim" style="font-size:12px">${s}</div>` : ""}</div>`;
  return `<div class="log-hero"><div><div class="ttl">${t("Logbook")}</div><div class="dim" style="font-size:13px">${t("Your flights with ASL Pad")}</div></div>
    ${c(t("Flights"), nf(list.length))}${c(t("Block time"), dur(block))}${c(t("Distance"), nf(dist) + '<small style="font-size:14px" class="dim"> NM</small>')}
    ${c(t("Airports"), nf(apts.size), top ? t("mostly {type}", { type: top[0] }) : "")}</div>`;
}
const toolbar = () => `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 4px"><button class="btn small pri" data-do="add">${t("Add flight")}</button>
  <span style="flex:1"></span><button class="btn small" data-do="csv">CSV</button><button class="btn small" data-do="json">${t("Backup")}</button><button class="btn small" data-do="import">${t("Import")}</button></div>`;

function months(list) {
  const fmt = new Intl.DateTimeFormat(LOCALE(), { month: "long", year: "numeric", timeZone: "UTC" });
  const wd = new Intl.DateTimeFormat(LOCALE(), { weekday: "short", timeZone: "UTC" });
  let cur = "", out = "";
  list.forEach((e, i) => {
    const m = fmt.format(e.date);
    if (m !== cur) { out += `${cur ? "</div>" : ""}<div class="month">${esc(m)}</div><div>`; cur = m; }
    out += `<div class="log-row" data-i="${i}"><div class="d">${esc(wd.format(e.date))}<b>${new Date(e.date).getUTCDate()}</b></div>
      <div class="rt">${esc(e.dep)} – ${esc(e.arr)}<small>${esc(e.depName || "")}${e.arrName ? " → " + esc(e.arrName) : ""}</small></div>
      <div><div class="v">${esc(e.flightNo)}</div><div class="s">${esc(e.type || "")}${e.reg ? " · " + esc(e.reg) : ""}</div></div>
      <div><div class="v">${dur(blockOf(e))}</div><div class="s">${hhmmz(e.offBlock || e.schedOut)} – ${hhmmz(e.onBlock || e.schedIn)}</div></div>
      <div><div class="v">${nf(e.distNm)}</div><div class="s">NM</div></div></div>`;
  });
  return `<div class="log-list">${out}</div></div>`;
}

function onClick(e) {
  const r = e.target.closest(".log-row");
  if (r) { detail(logbook()[+r.dataset.i]); return; }
  const b = e.target.closest("[data-do]"); if (!b) return;
  const l = logbook();
  if (b.dataset.do === "add") addFlight();
  if (b.dataset.do === "csv") download("asl-logbook.csv", "text/csv", csv(l));
  if (b.dataset.do === "json") download("asl-logbook.json", "application/json", JSON.stringify(l, null, 1));
  if (b.dataset.do === "import") importFile();
}

// ---------- detail ----------
function detail(e) {
  if (!e) return;
  const delay = e.onBlock && e.schedIn ? e.onBlock - e.schedIn : null;
  const c = (l, v, s) => `<div><div class="lbl">${l}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;
  sheet(`<div style="display:flex;align-items:baseline;gap:12px"><h2>${esc(e.flightNo)} · ${esc(e.dep)} – ${esc(e.arr)}</h2><span class="dim">${esc(dateShort(e.date))}</span>
      <button class="btn small" style="margin-left:auto" data-close>${t("Close")}</button></div>
    <div class="dim" style="font-size:13px">${esc(e.depName || "")} → ${esc(e.arrName || "")} · ${esc(e.callsign || "")}</div>
    ${minimap(e)}
    <div class="kv">${c(t("Off block"), hhmmz(e.offBlock), t("plan") + " " + hhmmz(e.schedOut))}${c(t("Take-off"), hhmmz(e.takeoff))}${c(t("Landing"), hhmmz(e.landing))}${c(t("On block"), hhmmz(e.onBlock), t("plan") + " " + hhmmz(e.schedIn))}
      ${c(t("Block time"), dur(blockOf(e)))}${c(t("Flight time"), airOf(e) ? dur(airOf(e)) : "—")}${c(t("Delay"), delay == null ? "—" : `<span class="${delay > 15 * 60e3 ? "bad" : delay > 0 ? "warn" : "ok"}">${dur(delay, true)}</span>`)}
      ${c(t("Distance"), nf(e.distNm) + "<small>NM</small>")}${c(t("Aircraft"), esc(e.type || "—"), esc(e.reg || ""))}${c(t("Passengers"), e.pax != null ? nf(e.pax) : "—")}
      ${c(t("Fuel checks"), nf(e.checks || 0))}${c(t("Landing fuel"), e.landingFuel != null ? nf(e.landingFuel) + `<small>${esc(e.units || "kg")}</small>` : "—", t("expected"))}</div>
    ${e.route ? `<div class="lbl" style="margin-top:14px">${t("Route")}</div><div class="wx-raw">${esc(e.route)}</div>` : ""}
    <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn small" data-del>${t("Delete flight")}</button></div>`,
  (ev, close) => {
    const d = ev.target.closest("[data-del]"); if (!d) return;
    if (!d.dataset.sure) { d.dataset.sure = "1"; d.textContent = t("Tap again to delete"); d.classList.add("pri"); return; }
    saveLogbook(logbook().filter((x) => x.id !== e.id)); close();
  });
}

// the route on a small map of its own (equirectangular, fitted to the flight)
function minimap(e) {
  let pts = (e.path || []).filter((p) => p && p.length >= 2);
  if (pts.length < 2) { const a = aptDb(e.dep), b = aptDb(e.arr); if (a && b) pts = greatCircle([a[0], a[1]], [b[0], b[1]], 30); }
  if (pts.length < 2) return "";
  let off = 0; pts = pts.map((p, i) => { if (i) { const prev = pts[i - 1][1] + off; while (p[1] + off - prev > 180) off -= 360; while (p[1] + off - prev < -180) off += 360; } return [p[0], p[1] + off]; });
  const la = pts.map((p) => p[0]), lo = pts.map((p) => p[1]);
  const midLat = (Math.max(...la) + Math.min(...la)) / 2, k = Math.cos((midLat * Math.PI) / 180);
  const x0 = Math.min(...lo) * k, x1 = Math.max(...lo) * k, y0 = Math.min(...la), y1 = Math.max(...la);
  const W = 760, H = 220, pad = 34, s = Math.min((W - 2 * pad) / Math.max(0.5, x1 - x0), (H - 2 * pad) / Math.max(0.5, y1 - y0));
  const cx = (W - (x1 - x0) * s) / 2, cy = (H - (y1 - y0) * s) / 2;
  const P = (p) => [cx + (p[1] * k - x0) * s, H - (cy + (p[0] - y0) * s)];
  const xy = pts.map(P), a = xy[0], b = xy.at(-1);
  // graticule every 5 or 10 degrees
  const step = Math.max(x1 - x0, y1 - y0) > 40 ? 10 : 5, grid = [];
  for (let g = Math.ceil(y0 / step) * step - step; g <= y1 + step; g += step) { const y = P([g, 0])[1]; grid.push(`<line x1="0" x2="${W}" y1="${y}" y2="${y}"/>`); }
  for (let g = Math.ceil(Math.min(...lo) / step) * step - step; g <= Math.max(...lo) + step; g += step) { const x = P([0, g])[0]; grid.push(`<line y1="0" y2="${H}" x1="${x}" x2="${x}"/>`); }
  return `<svg class="minimap" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><g stroke="var(--line)" stroke-width="1">${grid.join("")}</g>
    <polyline points="${xy.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="var(--route)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${a[0]}" cy="${a[1]}" r="6" fill="var(--bg2)" stroke="var(--fg)" stroke-width="2.5"/><circle cx="${b[0]}" cy="${b[1]}" r="6" fill="#e3001f"/>
    <text x="${a[0]}" y="${a[1] - 12}" text-anchor="middle" fill="var(--fg)" font-size="14" font-weight="700" font-family="var(--f-cond)">${esc(e.dep)}</text>
    <text x="${b[0]}" y="${b[1] - 12}" text-anchor="middle" fill="var(--fg)" font-size="14" font-weight="700" font-family="var(--f-cond)">${esc(e.arr)}</text></svg>`;
}

// ---------- add by hand ----------
function addFlight() {
  const o = S.ofp, day = new Date().toISOString().slice(0, 10);
  const hm = (v) => (v ? new Date(v).toISOString().slice(11, 16) : "");
  const f = (n, l, v = "", ph = "", type = "text") => `<label><div class="lbl">${l}</div><input name="${n}" type="${type}" value="${esc(v)}" placeholder="${esc(ph)}" style="width:100%" autocomplete="off"></label>`;
  sheet(`<h2>${t("Add flight")}</h2><p class="dim" style="font-size:13px">${t("Times in UTC.")}</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px">
      ${f("date", t("Date"), o?.times.out ? new Date(o.times.out).toISOString().slice(0, 10) : day, "", "date")}${f("no", t("Flight number"), o?.iataNo || o?.callsign || "", "JU500")}${f("cs", t("Callsign"), o?.callsign || "", "ASL500")}
      ${f("dep", t("From"), o?.dep?.icao || "", "LYBE")}${f("arr", t("To"), o?.dest?.icao || "", "EDDF")}${f("type", t("Aircraft"), o?.type || "", "A319")}
      ${f("reg", t("Registration"), o?.reg || "", "YU-APA")}${f("out", t("Off block"), hm(o?.times.out), "08:00", "time")}${f("in", t("On block"), hm(o?.times.in), "10:05", "time")}</div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn" data-close>${t("Cancel")}</button><button class="btn pri" data-save>${t("Save")}</button></div>`,
  (e, close, el) => {
    if (!e.target.closest("[data-save]")) return;
    const v = (n) => el.querySelector(`[name=${n}]`).value.trim();
    const dep = v("dep").toUpperCase(), arr = v("arr").toUpperCase(), date = v("date");
    const bad = [["dep", /^[A-Z0-9]{4}$/.test(dep)], ["arr", /^[A-Z0-9]{4}$/.test(arr)], ["date", /^\d{4}-\d\d-\d\d$/.test(date)], ["out", /^\d\d:\d\d$/.test(v("out"))], ["in", /^\d\d:\d\d$/.test(v("in"))]];
    bad.forEach(([n, ok]) => (el.querySelector(`[name=${n}]`).style.borderColor = ok ? "" : "var(--red)"));
    if (bad.some((x) => !x[1])) return;
    const out = Date.parse(date + "T" + v("out") + ":00Z"); let inn = Date.parse(date + "T" + v("in") + ":00Z");
    if (inn <= out) inn += 864e5;
    const A = aptDb(dep), B = aptDb(arr);
    const no = v("no").toUpperCase() || v("cs").toUpperCase();
    addToLogbook({ id: "manual:" + no + dep + arr + out, date: out, callsign: v("cs").toUpperCase() || no, flightNo: no, dep, arr,
      depName: A?.[2]?.replace(/-/g, " ") || "", arrName: B?.[2]?.replace(/-/g, " ") || "", type: v("type").toUpperCase(), reg: v("reg").toUpperCase(), pax: null,
      schedOut: out, schedIn: inn, offBlock: out, takeoff: null, landing: null, onBlock: inn, distNm: A && B ? Math.round(distNm([A[0], A[1]], [B[0], B[1]])) : 0,
      units: "kg", blockFuel: null, landingFuel: null, checks: 0, route: "", path: A && B ? [[A[0], A[1]], [B[0], B[1]]] : [], manual: true });
    close();
  });
}

// ---------- export / import ----------
function csv(list) {
  const iso = (v) => (v ? new Date(v).toISOString().slice(0, 16).replace("T", " ") : "");
  const cols = [["Date", (e) => new Date(e.date).toISOString().slice(0, 10)], ["Flight", (e) => e.flightNo], ["Callsign", (e) => e.callsign], ["From", (e) => e.dep], ["To", (e) => e.arr],
    ["Aircraft", (e) => e.type], ["Registration", (e) => e.reg], ["Off block UTC", (e) => iso(e.offBlock)], ["Take-off UTC", (e) => iso(e.takeoff)], ["Landing UTC", (e) => iso(e.landing)],
    ["On block UTC", (e) => iso(e.onBlock)], ["Block time", (e) => dur(blockOf(e))], ["Flight time", (e) => (airOf(e) ? dur(airOf(e)) : "")], ["Distance NM", (e) => e.distNm], ["Pax", (e) => e.pax ?? ""], ["Route", (e) => e.route]];
  const q = (v) => { const s = String(v ?? ""); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.map((c) => c[0]).join(","), ...list.map((e) => cols.map((c) => q(c[1](e))).join(","))].join("\n");
}
function download(name, type, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function importFile() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
  inp.onchange = async () => {
    try {
      const data = JSON.parse(await inp.files[0].text());
      const list = (Array.isArray(data) ? data : data.logbook || []).filter((e) => e && e.id && e.dep && e.arr && e.date);
      const have = new Map(logbook().map((e) => [e.id, e]));
      list.forEach((e) => have.set(e.id, e));
      saveLogbook([...have.values()]);
      C.toast({ lv: "ok", ic: "check", title: t("Logbook imported"), text: t(list.length === 1 ? "{n} flight" : "{n} flights", { n: list.length }) });
    } catch { C.toast({ lv: "red", ic: "warn", title: t("Import failed"), text: t("This is not an ASL Pad logbook file.") }); }
  };
  inp.click();
}
