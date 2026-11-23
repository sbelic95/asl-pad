// The Air Serbia Virtual account (the pilot dashboard on Cloudflare): sign in with the VATSIM CID and the own PIN, then the
// pad takes over the profile kept there – SimBrief ID, VATSIM CID, IVAO VID and the Hoppie logon code – and the bookings.
// The dashboard runs on another web address, so the pad keeps a token instead of a cookie (asl.account). Nothing else is sent.
import { settings, saveSettings, emit } from "./data.js";
import { store } from "./util.js";

// on the developer's own machine (localhost) a local dashboard can be set for tests (asl.dash); the real pad always uses the live one
const LOCAL = typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname);
export const DASH = (LOCAL && store.get("asl.dash", "")) || "https://airserbia-virtual.pages.dev";
export const ACC = { ...store.get("asl.account", {}), profile: null, me: null, bookings: [], err: "", at: 0 };
export const signedIn = () => !!ACC.token;
// the pad's PIN on the lock screen: the pilot ID = the VATSIM CID (none without the account)
export const pinCode = () => { const d = String(ACC.cid || "").replace(/\D/g, ""); return d.length >= 3 ? d : ""; };
// the pilot as the pad shows it (crew card, roster, calendar, home): name, CID, VATSIM rating and the bookings – null when signed out
export function pilot() {
  if (!ACC.token) return null;
  const p = ACC.profile || {}, me = ACC.me || {}, name = p.name || (me.name && !/^VATSIM \d+$/.test(me.name) ? me.name : "");
  return { name, first: name.split(/\s+/)[0] || "", pilotId: ACC.cid || p.cid || "", rank: me.rank || "",
    bookings: (ACC.bookings || []).map((b) => ({ id: b.id, dep: b.dep, arr: b.arr, callsign: b.callsign || "", number: b.flight_number || "", at: Date.parse(b.departure_time || "") || null, reg: b.aircraft || "", type: b.type || "" })) };
}
const call = async (path, opts = {}) => {
  const r = await fetch(DASH + "/api/" + path, { ...opts, headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(ACC.token ? { Authorization: "Bearer " + ACC.token } : {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "HTTP " + r.status), { status: r.status });
  return d;
};
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
  } catch (e) {
    ACC.err = e.message;
    if (e.status === 401) { ACC.token = ""; store.del("asl.account"); } // signed out on the dashboard
  }
  emit();
}
