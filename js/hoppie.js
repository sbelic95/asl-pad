// ACARS and CPDLC over the Hoppie network (www.hoppie.nl, CORS open). The pilot enters the personal logon code in
// Settings; it stays on the device. Messages are read with "peek" (does not take them away from an ACARS in the aircraft),
// sent as telex, CPDLC (logon, answers) or information requests (METAR, TAF, ATIS).
import { S, settings, emit } from "./data.js";
import { notify } from "./notify.js";
import { store } from "./util.js";
import { play } from "./sound.js";

const URL = "https://www.hoppie.nl/acars/system/connect.html";
export const A = { msgs: [], sent: store.get("asl.acars.sent", []), err: "", maxId: null, seen: new Map(), freq: null, station: store.get("asl.acars.station", ""), at: 0 };
const cs = () => S.ofp?.callsign || "";
export const acarsReady = () => !!(settings.hoppie && cs() && !settings.demo);

async function call(type, to, packet) {
  const body = new URLSearchParams({ logon: settings.hoppie, from: cs(), to, type, packet });
  const txt = (await (await fetch(URL, { method: "POST", body, cache: "no-store" })).text()).trim();
  if (!txt.startsWith("ok")) throw new Error(/logon/i.test(txt) ? "logon" : txt.slice(0, 120));
  return txt;
}
// "{id from type {packet}}" → messages; CPDLC packets "/data2/<min>/<mrn>/<answer>/<text>"
function parse(txt) {
  const out = [];
  for (const m of txt.matchAll(/\{(\d+)\s+(\S+)\s+(\S+)\s+\{([^}]*)\}\}/g)) {
    let text = m[4], min = null, mrn = null, ra = "";
    const d = text.match(/^\/data2\/(\d*)\/(\d*)\/([^/]*)\/(.*)$/s);
    if (d) { min = d[1] ? +d[1] : null; mrn = d[2] ? +d[2] : null; ra = d[3]; text = d[4]; }
    out.push({ id: +m[1], from: m[2], type: m[3].toLowerCase(), text: text.replace(/@/g, "").replace(/\s+/g, " ").trim(), min, mrn, ra });
  }
  return out;
}

export async function pollAcars() {
  if (settings.demo) { demoAcars(); return; }
  if (!acarsReady()) return;
  try {
    const msgs = parse(await call("peek", "SERVER", "")).sort((a, b) => b.id - a.id);
    A.err = "";
    const first = A.maxId == null, fresh = first ? [] : msgs.filter((x) => x.id > A.maxId);
    for (const x of msgs) if (!A.seen.has(x.id)) A.seen.set(x.id, first ? null : Date.now());
    A.maxId = msgs.length ? msgs[0].id : (A.maxId ?? 0);
    A.msgs = msgs.slice(0, 30);
    for (const x of fresh.reverse()) {
      const f = x.text.match(/\b(CONTACT|MONITOR)\s+(\S+(?:\s+\S+)?)\s+(\d{3}\.\d{1,3})/i);
      if (f) A.freq = { verb: f[1].toUpperCase(), station: f[2], mhz: f[3], from: x.from, at: Date.now() };
      if (x.type === "cpdlc" && /LOGON ACCEPTED|CURRENT ATC UNIT/i.test(x.text)) { A.station = x.from; store.set("asl.acars.station", x.from); }
      play(x.type === "cpdlc" ? "cpdlc" : "msg"); // the ATC message chime for CPDLC uplinks
      notify({ app: "fly", tab: "radio", ic: "radio", lv: x.type === "cpdlc" ? "attn" : "info", title: `ACARS · ${x.from}`, text: x.text.slice(0, 120) });
    }
  } catch (e) { A.err = e.message === "logon" ? "logon" : "net"; }
  A.at = Date.now();
  emit();
}
export const unread = (now = Date.now()) => A.msgs.filter((x) => { const t = A.seen.get(x.id); return t && now - t < 10 * 60e3 && !A.read?.has(x.id); });
export function markRead() { A.read = new Set(A.msgs.map((x) => x.id)); }

let minNo = store.get("asl.acars.min", 1);
const nextMin = () => { minNo = (minNo % 63) + 1; store.set("asl.acars.min", minNo); return minNo; };
function remember(m) { A.sent = [{ ...m, at: Date.now() }, ...A.sent].slice(0, 20); store.set("asl.acars.sent", A.sent); }

// information request: the answer comes back at once
export async function inforeq(kind, icao) {
  const txt = await call("inforeq", "SERVER", `${kind} ${icao}`);
  const body = (txt.match(/\{[^{]*\{([^}]*)\}\}/) || [])[1] || txt.replace(/^ok\s*/, "");
  const m = { id: -Date.now(), from: icao, type: "info", text: body.replace(/\s+/g, " ").trim() || "—", own: kind.toUpperCase() };
  A.msgs = [m, ...A.msgs].slice(0, 30); A.seen.set(m.id, Date.now()); remember({ to: "SERVER", type: "inforeq", text: `${kind.toUpperCase()} ${icao}` });
  emit(); return m;
}
export async function telex(to, text) { await call("telex", to.toUpperCase(), text.toUpperCase()); remember({ to: to.toUpperCase(), type: "telex", text: text.toUpperCase() }); emit(); }
export async function cpdlcLogon(station) {
  const st = station.toUpperCase(); await call("cpdlc", st, `/data2/${nextMin()}//Y/REQUEST LOGON`);
  A.station = st; store.set("asl.acars.station", st); remember({ to: st, type: "cpdlc", text: "REQUEST LOGON" }); emit();
}
export async function cpdlcLogoff() {
  if (!A.station) return; const st = A.station; await call("cpdlc", st, `/data2/${nextMin()}//N/LOGOFF`);
  remember({ to: st, type: "cpdlc", text: "LOGOFF" }); A.station = ""; store.set("asl.acars.station", ""); emit();
}
// answer to an uplink (WILCO, UNABLE, STANDBY, ROGER, AFFIRM, NEGATIVE)
export async function cpdlcAnswer(msg, word) {
  await call("cpdlc", msg.from, `/data2/${nextMin()}/${msg.min ?? ""}/N/${word}`);
  (A.answered ||= new Map()).set(msg.id, word); remember({ to: msg.from, type: "cpdlc", text: word }); emit();
}
// which answers an uplink wants (response attribute)
export const answersFor = (m) => m.type !== "cpdlc" || A.answered?.has(m.id) ? [] : ({ WU: ["WILCO", "UNABLE", "STANDBY"], AN: ["AFFIRM", "NEGATIVE", "STANDBY"], R: ["ROGER", "UNABLE", "STANDBY"] })[String(m.ra).toUpperCase()] || [];

// a pre-departure clearance request as a telex to the departure airport (the usual form on VATSIM)
export function pdcText(o, stand, atis) {
  return `REQUEST PREDEP CLEARANCE ${o.callsign} ${o.type} TO ${o.dest.icao} AT ${o.dep.icao}${stand ? " STAND " + stand : ""}${atis ? " ATIS " + atis : ""}`;
}

function demoAcars() {
  if (A.msgs.length) return;
  const now = Date.now();
  A.msgs = [
    { id: 3, from: "LYBE", type: "cpdlc", text: "CLD 1715 251120 LYBE PDC 001 ASL500 CLRD TO KJFK OFF 30L VIA OSTOV1D SQUAWK 4521 ADT MDI NEXT FREQ 118.100", min: 2, mrn: null, ra: "WU" },
    { id: 2, from: "LYBE", type: "telex", text: "ATIS LYBE INFO C 1650Z RWY 30L IN USE TL 110", min: null, mrn: null, ra: "" },
  ];
  A.seen.set(3, now - 2 * 60e3); A.seen.set(2, now - 9 * 60e3); A.maxId = 3; A.at = now;
}
