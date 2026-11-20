// Clock: Zulu always in sight, a world clock for the cities of the flight and of Air Serbia, stopwatch, timer and alarms
// (local time or Zulu). Alarms and the timer keep running while the app is closed and come back as notifications.
import { S } from "../data.js";
import { t, LOCALE } from "../i18n.js";
import { esc, store, p2 } from "../util.js";
import { tzOf, cityOf } from "../tz.js";
import { notify } from "../notify.js";
import { sheet } from "../sheet.js";

export const name = "Clock";
export const tabs = [["world", "World clock"], ["alarm", "Alarms"], ["stop", "Stopwatch"], ["timer", "Timer"]];
let C = null;
const sw = store.get("asl.clock.sw", { run: false, t0: 0, acc: 0, laps: [] });
const tm = store.get("asl.clock.timer", { end: 0, len: 600e3 });
const alarms = () => store.get("asl.alarms", []);
const saveSw = () => store.set("asl.clock.sw", sw), saveTm = () => store.set("asl.clock.timer", tm);

// alarms and the timer are checked every few seconds, whatever app is open
setInterval(() => {
  const now = Date.now();
  if (tm.end && now >= tm.end) { tm.end = 0; saveTm(); notify({ app: "clock", ic: "clock", lv: "attn", title: t("Timer done"), text: "" }); }
  const list = alarms(); let changed = false;
  for (const a of list) if (a.on && a.next && now >= a.next) { notify({ app: "clock", ic: "clock", lv: "attn", title: t("Alarm") + " " + a.hm + (a.z ? "z" : ""), text: a.label || "" }); a.next = nextAt(a); changed = true; }
  if (changed) store.set("asl.alarms", list);
}, 5000);
function nextAt(a) {
  const [h, m] = a.hm.split(":").map(Number), now = new Date();
  let d = a.z ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
  if (d <= Date.now()) d += 864e5;
  return d;
}
const fmt = (ms) => { const s = Math.floor(ms / 1000); return `${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}`; };
function cities() {
  const o = S.ofp, list = [{ n: "UTC", tz: "UTC" }, { n: cityOf({ icao: "LYBE" }) || "Belgrade", tz: tzOf({ icao: "LYBE" }) }];
  for (const a of [o?.dep, o?.dest]) if (a && a.icao !== "LYBE") list.push({ n: cityOf(a) || a.icao, tz: tzOf(a) });
  for (const i of ["EGLL", "LTFM", "KJFK", "UUEE"]) if (S.routes?.airports?.[i] && !list.some((x) => x.tz === tzOf({ icao: i }))) list.push({ n: cityOf({ icao: i }) || i, tz: tzOf({ icao: i }) });
  return list;
}
const tf = (tz, opt) => { try { return new Intl.DateTimeFormat(LOCALE(), { timeZone: tz, ...opt }).format(Date.now()); } catch { return "—"; } };
const offset = (tz) => { try { const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(Date.now()).find((x) => x.type === "timeZoneName")?.value || ""; return p.replace("GMT", "UTC"); } catch { return ""; } };
export function render(body, ctx) {
  C = ctx;
  if (!body._clk) { body._clk = true; body.addEventListener("click", onClick); }
  const tab = ctx.tab || "world", now = Date.now();
  if (tab === "world") body.innerHTML = `<div class="clk-z"><span class="lbl">Zulu</span><b class="num">${new Date(now).toISOString().slice(11, 19)}</b><span class="dim">${tf("UTC", { weekday: "long", day: "numeric", month: "long" })}</span></div>
    <div class="clk-grid">${cities().slice(1).map((c) => `<div class="clk-c"><b>${esc(c.n)}</b><span class="num">${tf(c.tz, { hour: "2-digit", minute: "2-digit" })}</span><small>${esc(offset(c.tz))}</small></div>`).join("")}</div>`;
  if (tab === "stop") { const el = sw.acc + (sw.run ? now - sw.t0 : 0);
    body.innerHTML = `<div class="clk-big num">${fmt(el)}.${Math.floor((el % 1000) / 100)}</div><div class="clk-btns"><button class="btn" data-ck="lap" ${sw.run ? "" : "disabled"}>${t("Lap")}</button><button class="btn pri" data-ck="sw">${sw.run ? t("Stop") : t("Start")}</button><button class="btn" data-ck="swreset">${t("Reset")}</button></div>
      <div class="clk-laps">${sw.laps.map((l, i) => `<div><span>${t("Lap")} ${sw.laps.length - i}</span><span class="num">${fmt(l)}</span></div>`).join("")}</div>`; }
  if (tab === "timer") { const left = tm.end ? Math.max(0, tm.end - now) : tm.len;
    body.innerHTML = `<div class="clk-big num">${fmt(left)}</div><div class="clk-btns">${[5, 10, 20, 30, 45, 60].map((m) => `<button class="btn small${tm.len === m * 60e3 && !tm.end ? " pri" : ""}" data-ck="len" data-m="${m}">${m} min</button>`).join("")}</div>
      <div class="clk-btns"><button class="btn pri" data-ck="timer">${tm.end ? t("Cancel") : t("Start")}</button></div>`; }
  if (tab === "alarm") body.innerHTML = `<div class="clk-btns" style="justify-content:flex-start"><button class="btn pri" data-ck="add">${t("New alarm")}</button></div>
    <div class="clk-al">${alarms().map((a, i) => `<div><b class="num">${esc(a.hm)}${a.z ? "z" : ""}</b><span>${esc(a.label || "")}<small>${a.z ? "Zulu" : t("Local time")}</small></span>
      <button class="btn small${a.on ? " pri" : ""}" data-ck="tog" data-i="${i}">${a.on ? t("On") : t("Off")}</button><button class="btn small" data-ck="del" data-i="${i}">×</button></div>`).join("") || `<div class="dim">${t("No alarms.")}</div>`}</div>`;
  if (tab !== "world") clearTimeout(body._tick), body._tick = setTimeout(() => C.tab === tab && render(body, { ...C, tab }), tab === "stop" ? 100 : 1000);
}
function onClick(e) {
  const b = e.target.closest("[data-ck]"); if (!b) return; const k = b.dataset.ck, now = Date.now();
  if (k === "sw") { if (sw.run) { sw.acc += now - sw.t0; sw.run = false; } else { sw.t0 = now; sw.run = true; } saveSw(); }
  if (k === "lap") { sw.laps.unshift(sw.acc + now - sw.t0); saveSw(); }
  if (k === "swreset") { Object.assign(sw, { run: false, t0: 0, acc: 0, laps: [] }); saveSw(); }
  if (k === "len") { tm.len = +b.dataset.m * 60e3; saveTm(); }
  if (k === "timer") { tm.end = tm.end ? 0 : now + tm.len; saveTm(); }
  if (k === "tog") { const l = alarms(); l[+b.dataset.i].on = !l[+b.dataset.i].on; l[+b.dataset.i].next = nextAt(l[+b.dataset.i]); store.set("asl.alarms", l); }
  if (k === "del") { const l = alarms(); l.splice(+b.dataset.i, 1); store.set("asl.alarms", l); }
  if (k === "add") { sheet(`<h2>${t("New alarm")}</h2><label><div class="lbl">${t("Time")}</div><input name="hm" type="time" value="06:00" style="width:100%"></label>
      <label><div class="lbl" style="margin-top:10px">${t("Label")}</div><input name="lb" style="width:100%" placeholder="${t("e.g. report time")}"></label>
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" name="z"> ${t("Zulu (UTC) instead of local time")}</label>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px"><button class="btn" data-close>${t("Cancel")}</button><button class="btn pri" data-save>${t("Save")}</button></div>`,
    (ev, close, el) => { if (!ev.target.closest("[data-save]")) return; const a = { hm: el.querySelector("[name=hm]").value || "06:00", label: el.querySelector("[name=lb]").value.trim(), z: el.querySelector("[name=z]").checked, on: true };
      a.next = nextAt(a); store.set("asl.alarms", [...alarms(), a]); close(); C.changed("view"); }); return; }
  C.changed("view");
}
export function summary() { return [t("Clock"), new Date().toISOString().slice(11, 16) + "z"]; }
