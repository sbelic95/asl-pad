// The Air Serbia Virtual account (the pilot dashboard on Cloudflare): sign in with vAMSYS through the dashboard (or the CID and
// PIN while the airline keeps that on), then the
// pad takes over the profile kept there – SimBrief ID, VATSIM CID, IVAO VID and the Hoppie logon code – and the bookings.
// The dashboard runs on another web address, so the pad keeps a token instead of a cookie (asl.account). Nothing else is sent.
import { settings, saveSettings, emit, logbook, saveLogbook } from "./data.js";
import { aptDb } from "./tz.js";
import { distNm } from "./util.js";
import { store } from "./util.js";

// on the developer's own machine (localhost) a local dashboard can be set for tests (asl.dash); the real pad always uses the live one
const LOCAL = typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname);
export const DASH = (LOCAL && store.get("asl.dash", "")) || "https://airserbia-virtual.pages.dev";
export const ACC = { ...store.get("asl.account", {}), profile: null, me: null, bookings: [], err: "", at: 0 };
export const signedIn = () => !!ACC.token;
// the pilot as the pad shows it (crew card, roster, calendar, home): name, CID, VATSIM rating and the bookings – null when signed out
export function pilot() {
  if (!ACC.token) return null;
  const p = ACC.profile || {}, me = ACC.me || {}, name = p.name || (me.name && !/^VATSIM \d+$/.test(me.name) ? me.name : "");
  return { name, first: name.split(/\s+/)[0] || "", pilotId: me.vamsys || p.vamsys || ACC.cid || p.cid || "", rank: me.rank || "",
    bookings: (ACC.bookings || []).map((b) => ({ id: b.id, dep: b.dep, arr: b.arr, callsign: b.callsign || "", number: b.flight_number || "", at: Date.parse(b.departure_time || "") || null, reg: b.aircraft || "", type: b.type || "" })) };
}
const call = async (path, opts = {}) => {
  const r = await fetch(DASH + "/api/" + path, { ...opts, headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(ACC.token ? { Authorization: "Bearer " + ACC.token } : {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "HTTP " + r.status), { status: r.status });
  return d;
};
// how the dashboard lets pilots sign in: { connect: a sign-in page is set up, provider: "vamsys" or "vatsim", pinLogin: CID + PIN still allowed }
ACC.cfg = store.get("asl.dashcfg", { connect: true, provider: "vamsys", pinLogin: false });
export async function accConfig() {
  try { const c = await call("config"); ACC.cfg = { connect: !!c.connect, provider: c.provider || (c.connect ? "vatsim" : ""), pinLogin: c.pinLogin !== false }; store.set("asl.dashcfg", ACC.cfg); emit(); } catch {}
}
// "Sign in with vAMSYS": the dashboard sends the pilot to vAMSYS and back here with the token after # (never sent to a server)
export function accConnect() {
  location.href = DASH + "/api/auth/connect?client=pad&return=" + encodeURIComponent(location.origin + location.pathname + location.search);
}
function takeTokenFromAddress() {
  const m = typeof location !== "undefined" && location.hash.match(/asv_token=([A-Za-z0-9_.-]+)/); if (!m) return;
  history.replaceState(null, "", location.pathname + location.search); // the token leaves the address bar at once
  let cid = ""; try { cid = String(JSON.parse(atob(m[1].split(".")[0].replace(/-/g, "+").replace(/_/g, "/"))).cid || ""); } catch {}
  if (!/^\d{6,8}$/.test(cid)) cid = ""; // a vAMSYS pilot without a VATSIM ID: no CID
  ACC.token = m[1]; ACC.cid = cid; store.set("asl.account", { token: ACC.token, cid }); ACC.err = "";
  setTimeout(() => accLoad(true), 0);
}
takeTokenFromAddress();
export async function accSignIn(cid, pin) {
  const d = await call("auth/vatsim", { method: "POST", body: JSON.stringify({ cid: String(cid).trim(), pin: String(pin).trim(), client: "pad" }) });
  ACC.token = d.token; ACC.cid = String(cid).trim(); store.set("asl.account", { token: ACC.token, cid: ACC.cid });
  await accLoad(true);
}
export function accSignOut() {
  if (ACC.token) call("auth/logout", { method: "POST" }).catch(() => {});
  ACC.token = ""; ACC.cid = ""; ACC.profile = null; ACC.me = null; ACC.bookings = []; store.del("asl.account"); emit();
}
// the profile wins over what was typed on this device (it is the pilot's own account); empty fields are left alone
export async function accLoad(force) {
  if (!ACC.token || (!force && Date.now() - ACC.at < 5 * 60e3)) return;
  ACC.at = Date.now();
  try {
    const [p, b, me] = await Promise.all([call("profile"), call("bookings").catch(() => []), call("me").catch(() => null)]);
    ACC.profile = p; ACC.me = me; ACC.bookings = Array.isArray(b) ? b : []; ACC.err = "";
    const patch = {};
    if (p.simbrief && p.simbrief !== settings.simbrief) patch.simbrief = p.simbrief;
    if (p.cid && p.cid !== settings.cid) patch.cid = p.cid;
    if (p.hoppie && p.hoppie !== settings.hoppie) patch.hoppie = p.hoppie;
    if (p.ivao && p.ivao !== settings.ivao) patch.ivao = p.ivao;
    if (Object.keys(patch).length) saveSettings(patch);
    call("pireps").then(mergePireps).catch(() => {});
  } catch (e) {
    ACC.err = e.message;
    if (e.status === 401) { ACC.token = ""; store.del("asl.account"); } // signed out on the dashboard
  }
  emit();
}

// the pilot's flights from vAMSYS (PIREPs, as of the last sign-in on the dashboard) go into the logbook, marked "vAMSYS".
// A flight the pad logged itself is not doubled; a vAMSYS flight the pilot deleted here stays deleted (asl.logbook.gone).
const minsOf = (v) => (v == null ? null : v > 2000 ? Math.round(v / 60) : v); // seconds or minutes
function mergePireps(d) {
  const list = Array.isArray(d?.list) ? d.list : []; if (!list.length) return;
  const gone = new Set(store.get("asl.logbook.gone", [])), book = logbook();
  const own = book.filter((e) => e.src !== "vamsys");
  const twin = (x) => own.some((e) => e.dep === x.dep && e.arr === x.arr && Math.abs((e.offBlock || e.date) - x.off) < 3 * 3600e3);
  const keep = book.filter((e) => e.src !== "vamsys" || !list.some((x) => "vamsys:" + x.id === e.id));
  let added = 0;
  for (const x of list) {
    if (!x.off || gone.has("vamsys:" + x.id) || twin(x)) continue;
    const A = aptDb(x.dep), B = aptDb(x.arr), blk = minsOf(x.block), air = minsOf(x.air);
    const on = x.on || (blk ? x.off + blk * 60e3 : null);
    keep.push({ id: "vamsys:" + x.id, src: "vamsys", date: x.off, callsign: x.cs || x.fn, flightNo: x.fn || x.cs, dep: x.dep, arr: x.arr,
      depName: A?.[2]?.replace(/-/g, " ") || "", arrName: B?.[2]?.replace(/-/g, " ") || "", type: "", reg: "", pax: null,
      schedOut: null, schedIn: null, offBlock: x.off, takeoff: null, landing: null, onBlock: on,
      airMin: air, distNm: x.nm || (A && B ? Math.round(distNm([A[0], A[1]], [B[0], B[1]])) : 0), units: "kg", blockFuel: null, landingFuel: null, fuelUsed: x.fuel,
      landingRate: x.lr, points: x.pts, network: x.net, status: x.status, checks: 0, route: "", path: A && B ? [[A[0], A[1]], [B[0], B[1]]] : [] });
    added++;
  }
  if (added || keep.length !== book.length) saveLogbook(keep);
}
