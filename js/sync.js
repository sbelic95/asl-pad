// Sync with the ASL Pad server (server/worker.js), only when va/server.json has a url and the pilot is signed in
// with the Air Serbia Virtual account (CID + PIN). Lists are joined, never overwritten: logbook by flight id, calendar entries and alarms by content,
// check-ins by duty. So two devices can be used side by side and nothing a pilot entered gets lost.
import { settings, logbook, saveLogbook } from "./data.js";
import { store, getJSON } from "./util.js";
import { signedIn, ACC } from "./account.js";

let URL_ = null, busy = false;
export const SY = { at: store.get("asl.sync.at", 0), err: "", on: false };
async function cfg() { if (URL_ == null) { try { URL_ = ((await getJSON("va/server.json", 15000)).url || "").replace(/\/$/, ""); } catch { URL_ = ""; } } return URL_; }
const byKey = (a, b, key) => { const m = new Map(); for (const x of [...(a || []), ...(b || [])]) { const k = key(x); const o = m.get(k); m.set(k, o ? { ...o, ...x, reported: o.reported || x.reported } : x); } return [...m.values()]; };
export async function sync() {
  if (busy || settings.demo || !signedIn()) return;
  const url = await cfg(); SY.on = !!url; if (!url) return;
  busy = true;
  try {
    const tok = ACC.token; if (!tok) throw new Error("signed out");
    const h = { Authorization: "Bearer " + tok, "Content-Type": "application/json" };
    const r = await fetch(url + "/sync", { headers: h }); if (!r.ok) throw new Error("server " + r.status);
    const remote = (await r.json())?.data || {};
    const data = {
      logbook: byKey(logbook(), remote.logbook, (e) => e.id),
      cal: byKey(store.get("asl.cal", []), remote.cal, (e) => e.title + "@" + e.at),
      alarms: byKey(store.get("asl.alarms", []), remote.alarms, (e) => e.hm + (e.z ? "z" : "") + e.label),
      checkin: { ...(remote.checkin || {}), ...store.get("asl.checkin", {}) },
    };
    if (data.logbook.length !== logbook().length) saveLogbook(data.logbook);
    store.set("asl.cal", data.cal); store.set("asl.alarms", data.alarms); store.set("asl.checkin", data.checkin);
    const at = Date.now(), w = await fetch(url + "/sync", { method: "PUT", headers: h, body: JSON.stringify({ at, data }) });
    if (!w.ok) throw new Error("server " + w.status);
    SY.at = at; SY.err = ""; store.set("asl.sync.at", at);
  } catch (e) { SY.err = e.message; }
  busy = false;
}
export function startSync() {
  setTimeout(sync, 4000); setInterval(sync, 5 * 60e3);
  document.addEventListener("visibilitychange", () => { if (document.hidden) sync(); });
}
