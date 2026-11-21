// ASL Fly → "VDGS": the stand display the crew looks at through the windscreen, as one panel – slot (vIFF CDM) with the
// start-up countdown, stand, runway and SID, and which frequency to call now and next. Before off-block it is the
// departure board of the stand; while taxiing and airborne the frequency guide; after landing the arrival stand.
// Countdowns run every second through tick() (no full rebuild).
import { S, departureStand, arrivalStand, runwayOf, atisOf, emit } from "../data.js";
import { t } from "../i18n.js";
import { esc, hhmmz, p2 } from "../util.js";
import { freqPlan, loadAtcData, atcReady } from "../atc.js";

const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600); return (h ? h + ":" + p2(Math.floor(s / 60) % 60) : Math.floor(s / 60)) + ":" + p2(s % 60); };
// the state of the start-up slot
export function slotState(now = Date.now()) {
  const c = S.cdm, o = S.ofp, st = S.st;
  if (st?.offBlock) return { k: st.takeoff ? (st.landing ? "arr" : "air") : "taxi" };
  if (!c?.tsat) return { k: "noslot", target: c?.tobt || o?.times?.out, lbl: c?.tobt ? "TOBT" : "STD" };
  const open = c.tsat - 5 * 60e3, close = c.tsat + 5 * 60e3;
  return now < open ? { k: "wait", target: open, open, close } : now <= close ? { k: "go", target: close, open, close } : { k: "late", target: close };
}
function freqBox(now) {
  if (!atcReady()) loadAtcData().then(emit);
  const p = freqPlan();
  if (!p?.cur) return `<div class="vd-freq"><div class="vd-l">${t("FREQUENCY")}</div><div class="vd-v dim">${atcReady() ? "UNICOM 122.800" : t("loading the airspaces…")}</div></div>`;
  const when = p.next ? [p.next.when !== t("now") ? p.next.when : "", p.next.min != null && p.next.km > 0.5 ? t("in about {n} min", { n: p.next.min }) : ""].filter(Boolean).join(" · ") : "";
  return `<div class="vd-freq"><div class="vd-row"><div class="vd-l">${t("CONTACT NOW")}</div><div class="vd-st">${esc(p.cur.st.name)}<small>${esc(p.cur.st.cs)} · ${esc(p.cur.role)}</small></div><b class="vd-mhz">${esc(p.cur.st.mhz)}</b></div>
    ${p.next ? `<div class="vd-row next${p.soon ? " soon" : ""}"><div class="vd-l">${p.soon ? t("CHANGE SOON") : t("NEXT")}</div><div class="vd-st">${esc(p.next.st.name)}<small>${esc(p.next.st.cs)} · ${esc(p.next.role)}${when ? " · " + esc(when) : ""}</small></div><b class="vd-mhz">${esc(p.next.st.mhz)}</b></div>` : ""}</div>`;
}
const cell = (l, v, cls = "") => `<div class="vd-c ${cls}"><span>${l}</span><b>${v}</b></div>`;
export function vdgsView(o, d, now) {
  const c = S.cdm, s = slotState(now), ds = departureStand(), as = arrivalStand();
  const rwyD = c?.rwy || runwayOf(o.dep.icao, "dep")?.rwy || o.dep.rwy || "—", sid = c?.sid || "";
  let stand, msg, sub = "", big = "", cls = s.k;
  if (s.k === "arr") {
    stand = as?.ref || "—";
    msg = as?.state === "parked" ? t("ON STAND") : t("ARRIVAL STAND");
    sub = as?.state === "assigned" ? t("Assigned by {src}", { src: as.src }) : as?.state === "forecast" ? t("forecast") : as?.state === "parked" ? t("Parked at the stand") : "";
    big = S.st.onBlock ? "IN " + hhmmz(S.st.onBlock) : t("LANDED") + " " + hhmmz(S.st.landing);
  } else {
    stand = s.k === "air" ? as?.ref || "—" : ds?.state === "parked" ? ds.ref : "—";
    msg = { noslot: t("NO SLOT"), wait: t("START-UP IN"), go: t("START-UP APPROVED"), late: t("TSAT EXPIRED"), taxi: t("TAXI"), air: t("AIRBORNE") }[s.k];
    sub = { noslot: S.cdmOk === false ? t("vIFF CDM not reachable.") : t("No slot in vIFF CDM for {cs}.", { cs: o.callsign }) + " " + t("File your flight plan and set the TOBT in vIFF."),
      wait: t("Window {a}–{b}", { a: hhmmz(s.open), b: hhmmz(s.close) }), go: t("Request start-up now · closes {t}", { t: hhmmz(s.close) }), late: t("Set a new TOBT or call ATC."),
      taxi: t("Off block {t}", { t: hhmmz(S.st.offBlock) }) + (c?.ttot ? " · TTOT " + hhmmz(c.ttot) : ""), air: t("Airborne {t}", { t: hhmmz(S.st.takeoff) }) }[s.k];
    big = s.k === "wait" || s.k === "go" ? `<span data-cd="${s.target}">${mmss(s.target - now)}</span>` : s.k === "noslot" && s.target ? `${s.lbl} <span data-cd="${s.target}">${s.target > now ? mmss(s.target - now) : "+" + mmss(now - s.target)}</span>` : s.k === "late" ? "TSAT " + hhmmz(c.tsat) : "";
  }
  const arrSide = s.k === "arr" || s.k === "air", standApt = arrSide ? o.dest.icao : o.dep.icao;
  const times = arrSide ? cell("STA", hhmmz(o.times.in)) + cell("ETA", hhmmz(d?.est?.in)) + cell(t("Runway"), esc(runwayOf(o.dest.icao, "arr")?.rwy || o.dest.rwy || "—")) + cell("ATIS", esc(atisOf(o.dest.icao)?.letter || "—"))
    : cell("EOBT", hhmmz(c?.eobt || o.times.out)) + cell("TOBT", hhmmz(c?.tobt)) + cell("TSAT", hhmmz(c?.tsat), s.k === "go" ? "go" : s.k === "late" ? "late" : "") + cell("TTOT", hhmmz(c?.ttot)) + (c?.ctot ? cell("CTOT", hhmmz(c.ctot), "late") : "")
      + cell(t("Runway"), esc(rwyD)) + cell("SID", esc(sid || "—")) + cell("ATIS", esc(atisOf(o.dep.icao)?.depLetter || atisOf(o.dep.icao)?.letter || "—"));
  return `<div class="vd ${cls}">
    <div class="vd-head"><div><span class="vd-l">${t("STAND")} ${esc(standApt)}</span><b class="vd-stand">${esc(stand)}</b></div>
      <div class="vd-id"><b>${esc(o.callsign)}</b><span>${esc(o.type)}${o.reg ? " · " + esc(o.reg) : ""}</span><span>${esc(o.dep.icao)} → ${esc(o.dest.icao)}</span></div>
      <div class="vd-clock"><span class="vd-l">UTC</span><b data-clock>${hhmmz(now).slice(0, 5)}:${p2(new Date(now).getUTCSeconds())}</b></div></div>
    <div class="vd-main"><div class="vd-msg">${esc(msg)}</div><div class="vd-big">${big}</div><div class="vd-sub">${esc(sub)}</div></div>
    <div class="vd-times">${times}</div>
    ${freqBox(now)}
    ${c?.ctot ? `<div class="vd-ctot">CTOT ${hhmmz(c.ctot)}${c.reason ? " · " + esc(c.reason) : ""}</div>` : ""}
  </div>
  <p class="dim" style="font-size:12px;margin-top:10px">${t("Slot times from vIFF CDM, frequencies from VATSIM (top-down). The start-up window is TSAT −5/+5 minutes.")}</p>`;
}
// the countdowns and the clock, every second
export function vdgsTick(root, now) {
  root.querySelectorAll("[data-cd]").forEach((el) => { const tg = +el.dataset.cd; el.textContent = tg > now ? mmss(tg - now) : "+" + mmss(now - tg); });
  const c = root.querySelector("[data-clock]"); if (c) c.textContent = hhmmz(now).slice(0, 5) + ":" + p2(new Date(now).getUTCSeconds());
}
// one line for the overview of ASL Fly
export function vdgsMini(o, now) {
  const s = slotState(now), c = S.cdm; if (s.k === "air" || s.k === "arr") return "";
  const txt = { noslot: t("No slot") + (s.target ? ` · ${s.lbl} ${hhmmz(s.target)}` : ""), wait: t("Start-up in {t}", { t: mmss(s.target - now) }) + ` · TSAT ${hhmmz(c.tsat)}`, go: t("Start-up window open") + ` · ${t("closes {t}", { t: hhmmz(s.close) })}`, late: t("TSAT expired"), taxi: c?.ttot ? "TTOT " + hhmmz(c.ttot) : t("Taxi") }[s.k];
  return `<button class="vd-mini ${s.k}" data-do="tab" data-tab="vdgs"><span class="vd-l">VDGS</span><b>${esc(txt)}</b>${c?.ctot ? `<span class="late">CTOT ${hhmmz(c.ctot)}</span>` : ""}<span class="go">›</span></button>`;
}
