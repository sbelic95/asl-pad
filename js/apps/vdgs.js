// ASL Fly → "VDGS": the stand display the crew looks at through the windscreen, as one panel – slot (vIFF CDM) with the
// start-up countdown, stand, runway and SID, and which frequency to call now and next. Before off-block it is the
// departure board of the stand; while taxiing and airborne the frequency guide; after landing the arrival stand.
// Countdowns run every second through tick() (no full rebuild).
import { S, departureStand, arrivalStand, runwayOf, atisOf, emit } from "../data.js";
import { t } from "../i18n.js";
import { esc, hhmmz, p2, store } from "../util.js";
import { flightKey } from "../flight.js";
import { sheet } from "../sheet.js";
import { freqPlan, loadAtcData, atcReady } from "../atc.js";

const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600); return (h ? h + ":" + p2(Math.floor(s / 60) % 60) : Math.floor(s / 60)) + ":" + p2(s % 60); };
// Where the times come from: VATSIM first – vIFF CDM (VATSIM Spain), the CDM system VATSIM Europe uses, also at Frankfurt
// and Heathrow – and SimBrief (OFP) for everything VATSIM does not give. Frankfurt asks every pilot for a TOBT.
export const REQ_TOBT = new Set(["EDDF"]);
export const VDGS_PANEL = "https://vdgs.vatsimspain.es/"; // the pilot panel of vIFF CDM: log in with VATSIM, set or confirm the TOBT
const sidOf = (o) => { const proc = /^[A-Z]{2,5}\d{1,2}[A-Z]?$/, nl = o.navlog || []; return nl.find((x) => x.sidstar && proc.test(x.airway))?.airway || ((o.route || "").split(/\s+/).find((x) => proc.test(x)) || ""); };
export function timing(o) {
  const c = S.cdm, T = o.times || {};
  const sb = { src: "simbrief", eobt: T.out, tobt: null, tsat: null, ttot: T.off, ctot: null, rwy: o.dep.rwy || "", sid: sidOf(o), exot: T.off && T.out ? Math.round((T.off - T.out) / 6e4) : null };
  if (!c) return { ...sb, needTobt: REQ_TOBT.has(o.dep.icao), filed: false };
  return { src: "vatsim", eobt: c.eobt || sb.eobt, tobt: c.tobt, tsat: c.tsat, ttot: c.ttot, ctot: c.ctot, rwy: c.rwy || runwayOf(o.dep.icao, "dep")?.rwy || sb.rwy, sid: c.sid || sb.sid,
    exot: c.exot ?? sb.exot, isCdm: c.isCdm, reason: c.reason, filed: true, needTobt: (REQ_TOBT.has(o.dep.icao) || c.isCdm) && !c.tobtSet, rwySrc: c.rwy ? "vatsim" : "simbrief", sidSrc: c.sid ? "vatsim" : "simbrief" };
}
// the start-up window: TSAT ±5 at A-CDM, else (CTOT − EXOT), TOBT or EOBT −5/+6 – the order vIFF CDM uses
export function slotState(now = Date.now()) {
  const o = S.ofp, st = S.st;
  if (st?.offBlock) return { k: st.takeoff ? (st.landing ? "arr" : "air") : "taxi" };
  if (!o) return { k: "none" };
  const m = timing(o);
  if (m.needTobt) return { k: "tobt", m };
  let ref = null, lbl = "", lo = 5 * 60e3, hi = 6 * 60e3;
  if (m.tsat) { ref = m.tsat; lbl = "TSAT"; hi = 5 * 60e3; }
  else if (m.isCdm) return { k: "waittsat", m };
  else if (m.ctot && m.exot) { ref = m.ctot - m.exot * 60e3; lbl = "CTOT−EXOT"; }
  else if (m.tobt) { ref = m.tobt; lbl = "TOBT"; }
  else if (m.eobt) { ref = m.eobt; lbl = "EOBT"; }
  if (!ref) return { k: "none", m };
  const open = ref - lo, close = ref + hi;
  return { m, ref, lbl, open, close, k: now < open ? "wait" : now <= close ? "go" : "late", target: now < open ? open : close };
}
function freqBox(now) {
  if (!atcReady()) loadAtcData().then(emit);
  const p = freqPlan();
  if (!p?.cur) return `<div class="vd-freq"><div class="vd-l">${t("FREQUENCY")}</div><div class="vd-v dim">${atcReady() ? "UNICOM 122.800" : t("loading the airspaces…")}</div></div>`;
  const when = p.next ? [p.next.when !== t("now") ? p.next.when : "", p.next.min != null && p.next.km > 0.5 ? t("in about {n} min", { n: p.next.min }) : ""].filter(Boolean).join(" · ") : "";
  return `<div class="vd-freq"><div class="vd-row"><div class="vd-l">${t("CONTACT NOW")}</div><div class="vd-st">${esc(p.cur.st.name)}<small>${esc(p.cur.st.cs)} · ${esc(p.cur.role)}</small></div><b class="vd-mhz">${esc(p.cur.st.mhz)}${p.cur.st.ctaf ? `<small> · CTAF ${esc(p.cur.st.ctaf)}</small>` : ""}</b></div>
    ${p.next ? `<div class="vd-row next${p.soon ? " soon" : ""}"><div class="vd-l">${p.soon ? t("CHANGE SOON") : t("NEXT")}</div><div class="vd-st">${esc(p.next.st.name)}<small>${esc(p.next.st.cs)} · ${esc(p.next.role)}${when ? " · " + esc(when) : ""}</small></div><b class="vd-mhz">${esc(p.next.st.mhz)}${p.next.st.ctaf ? `<small> · CTAF ${esc(p.next.st.ctaf)}</small>` : ""}</b></div>` : ""}</div>`;
}
const cell = (l, v, cls = "") => `<div class="vd-c ${cls}"><span>${l}</span><b>${v}</b></div>`;
export function vdgsView(o, d, now) {
  const s = slotState(now), m = s.m || timing(o), ds = departureStand(), as = arrivalStand();
  let stand, msg, sub = "", big = "", cls = s.k;
  if (s.k === "arr") {
    stand = as?.ref || "—";
    msg = as?.state === "parked" ? t("ON STAND") : t("ARRIVAL STAND");
    sub = as?.state === "assigned" ? t("Assigned by {src}", { src: as.src }) : as?.state === "forecast" ? t("forecast") : as?.state === "parked" ? t("Parked at the stand") : "";
    big = S.st.onBlock ? "IN " + hhmmz(S.st.onBlock) : t("LANDED") + " " + hhmmz(S.st.landing);
  } else {
    stand = s.k === "air" ? as?.ref || "—" : ds?.state === "parked" ? ds.ref : "—";
    msg = { tobt: t("TOBT REQUIRED"), waittsat: t("WAITING FOR TSAT"), none: t("NO TIMES"), wait: t("START-UP IN"), go: t("START-UP APPROVED"), late: s.lbl === "TSAT" ? t("TSAT EXPIRED") : t("WINDOW MISSED"), taxi: t("TAXI"), air: t("AIRBORNE") }[s.k];
    sub = { tobt: m.filed ? t("{apt} sequences departures by TOBT. Set your TOBT in the VATSIM VDGS.", { apt: o.dep.icao }) : t("File your flight plan on VATSIM, then set your TOBT in the VATSIM VDGS."),
      waittsat: t("TOBT {t} is set. The TSAT follows from the sequence.", { t: hhmmz(m.tobt) }), none: t("No times in the OFP."),
      wait: t("Window {a}–{b}", { a: hhmmz(s.open), b: hhmmz(s.close) }) + " · " + s.lbl + " " + hhmmz(s.ref), go: t("Request start-up now · closes {t}", { t: hhmmz(s.close) }),
      late: t("Set a new TOBT or call ATC."), taxi: t("Off block {t}", { t: hhmmz(S.st.offBlock) }) + (m.ttot ? " · TTOT " + hhmmz(m.ttot) : ""), air: t("Airborne {t}", { t: hhmmz(S.st.takeoff) }) }[s.k] || "";
    big = s.k === "wait" || s.k === "go" ? `<span data-cd="${s.target}">${mmss(s.target - now)}</span>` : s.k === "late" ? s.lbl + " " + hhmmz(s.ref) : s.k === "waittsat" ? "TOBT " + hhmmz(m.tobt) : "";
  }
  const arrSide = s.k === "arr" || s.k === "air", standApt = arrSide ? o.dest.icao : o.dep.icao;
  const src = (k) => (k === "vatsim" ? "VATSIM" : "SimBrief");
  const times = arrSide ? cell("STA", hhmmz(o.times.in)) + cell("ETA", hhmmz(d?.est?.in)) + cell(t("Runway"), esc(runwayOf(o.dest.icao, "arr")?.rwy || o.dest.rwy || "—")) + cell("ATIS", esc(atisOf(o.dest.icao)?.letter || "—"))
    : cell("EOBT", hhmmz(m.eobt)) + cell("TOBT", hhmmz(m.tobt), s.k === "tobt" ? "late" : "") + cell("TSAT", hhmmz(m.tsat), s.k === "go" && s.lbl === "TSAT" ? "go" : s.k === "late" && s.lbl === "TSAT" ? "late" : "") + cell("TTOT", hhmmz(m.ttot))
      + (m.ctot ? cell("CTOT", hhmmz(m.ctot), "late") : "") + (m.exot ? cell("EXOT", m.exot + " min") : "") + cell(t("Runway"), esc(m.rwy || "—")) + cell("SID", esc(m.sid || "—"))
      + cell("ATIS", esc(atisOf(o.dep.icao)?.depLetter || atisOf(o.dep.icao)?.letter || "—"));
  const srcLine = arrSide ? "" : m.src === "vatsim"
    ? `<span class="vd-src on">VATSIM · vIFF CDM${m.isCdm ? " · A-CDM" : ""}</span>${m.rwySrc === "simbrief" || m.sidSrc === "simbrief" ? `<span class="vd-src">${t("Runway/SID from SimBrief")}</span>` : ""}`
    : `<span class="vd-src">SimBrief · ${S.cdmOk === false ? t("vIFF CDM not reachable.") : t("no VATSIM CDM data yet (flight plan not filed?)")}</span>`;
  const tobtBtn = !arrSide && (s.k === "tobt" || s.k === "late" || (m.src === "vatsim" && (m.isCdm || REQ_TOBT.has(o.dep.icao))))
    ? `<a class="vd-btn${s.k === "tobt" || s.k === "late" ? " hot" : ""}" href="${VDGS_PANEL}" target="_blank" rel="noopener">${s.k === "tobt" ? t("Set TOBT in the VATSIM VDGS") : t("Change TOBT in the VATSIM VDGS")} ↗</a>` : "";
  return `<div class="vd ${cls}">
    <div class="vd-head"><div><span class="vd-l">${t("STAND")} ${esc(standApt)}</span><b class="vd-stand">${esc(stand)}</b></div>
      <div class="vd-id"><b>${esc(o.callsign)}</b><span>${esc(o.type)}${o.reg ? " · " + esc(o.reg) : ""}</span><span>${esc(o.dep.icao)} → ${esc(o.dest.icao)}</span></div>
      <div class="vd-clock"><span class="vd-l">UTC</span><b data-clock>${hhmmz(now).slice(0, 5)}:${p2(new Date(now).getUTCSeconds())}</b></div></div>
    <div class="vd-main"><div class="vd-msg">${esc(msg)}</div><div class="vd-big">${big}</div><div class="vd-sub">${esc(sub)}</div>${tobtBtn ? `<div style="margin-top:12px">${tobtBtn}</div>` : ""}</div>
    <div class="vd-times">${times}</div>
    ${freqBox(now)}
    ${m.ctot && !arrSide ? `<div class="vd-ctot">CTOT ${hhmmz(m.ctot)} (−5/+10)${m.reason ? " · " + esc(m.reason) : ""}</div>` : ""}
    ${srcLine ? `<div class="vd-srcs">${srcLine}</div>` : ""}
  </div>
  <p class="dim" style="font-size:12px;margin-top:10px">${t("Times from VATSIM (vIFF CDM) where the airport has them, everything else from your SimBrief OFP. Start-up window: TSAT −5/+5 minutes, otherwise −5/+6 around the reference time.")}</p>`;
}
// the countdowns and the clock, every second
export function vdgsTick(root, now) {
  root.querySelectorAll("[data-cd]").forEach((el) => { const tg = +el.dataset.cd; el.textContent = tg > now ? mmss(tg - now) : "+" + mmss(now - tg); });
  const c = root.querySelector("[data-clock]"); if (c) c.textContent = hhmmz(now).slice(0, 5) + ":" + p2(new Date(now).getUTCSeconds());
}
// one line for the overview of ASL Fly
export function vdgsMini(o, now) {
  const s = slotState(now); if (["air", "arr", "none"].includes(s.k)) return "";
  const m = s.m || {};
  const txt = { tobt: t("TOBT required"), waittsat: "TOBT " + hhmmz(m.tobt) + " · " + t("waiting for TSAT"), wait: t("Start-up in {t}", { t: mmss(s.target - now) }) + ` · ${s.lbl} ${hhmmz(s.ref)}`,
    go: t("Start-up window open") + ` · ${t("closes {t}", { t: hhmmz(s.close) })}`, late: s.lbl === "TSAT" ? t("TSAT expired") : t("Window missed"), taxi: m.ttot ? "TTOT " + hhmmz(m.ttot) : t("Taxi") }[s.k];
  return `<button class="vd-mini ${s.k}" data-do="tab" data-tab="vdgs"><span class="vd-l">VDGS · ${m.src === "vatsim" ? "VATSIM" : "SimBrief"}</span><b>${esc(txt)}</b>${m.ctot ? `<span class="late">CTOT ${hhmmz(m.ctot)}</span>` : ""}<span class="go">›</span></button>`;
}
