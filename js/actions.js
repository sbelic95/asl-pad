// Things the pilot should do or know now: one card per topic, shown on the lock screen and in ASL Ops.
import { S, settings, derived, arrivalStand, atisOf, runwayOf } from "./data.js";
import { t } from "./i18n.js";
import { hhmmz, dur } from "./util.js";
import { fmtW } from "./units.js";
import { toPick, ldgPick } from "./apps/perf.js";

export function actions(now = Date.now()) {
  const o = S.ofp, out = [];
  if (!o) {
    if (S.ofpErr === "setup") out.push({ id: "setup", lv: "info", ic: "plane", title: t("Set up your flight"), text: t("Enter your SimBrief name in Settings."), app: "settings" });
    else if (S.ofpErr) out.push({ id: "ofp", lv: "red", ic: "warn", title: t("No flight plan"), text: S.ofpErr === "user" ? t("SimBrief user not found.") : S.ofpErr === "noofp" ? t("No OFP found at SimBrief.") : t("SimBrief not reachable."), app: "settings" });
    return out;
  }
  const st = S.st, d = derived(now);
  if (!d) return out;
  // before departure: flight plan on VATSIM, slot
  if (!st.offBlock) {
    if (!settings.demo && !S.pilot && !S.prefile && o.times.out && o.times.out - now < 90 * 60e3)
      out.push({ id: "prefile", lv: "info", ic: "plane", title: t("File your flight plan"), text: t("No VATSIM flight plan for {cs} yet.", { cs: o.callsign }), app: "ops", link: o.prefile });
    const c = S.cdm;
    if (c?.tsat) {
      const open = c.tsat - 5 * 60e3, close = c.tsat + 5 * 60e3;
      if (now < open) out.push({ id: "tsat", lv: "info", ic: "clock", title: t("TSAT {t}", { t: hhmmz(c.tsat) }), text: t("Start-up from {t}. TOBT {b}.", { t: hhmmz(open), b: hhmmz(c.tobt) }), app: "ops" });
      else if (now <= close) out.push({ id: "tsat", lv: "red", ic: "clock", title: t("Start-up window open"), text: t("Request start-up now · closes {t}", { t: hhmmz(close) }), app: "ops" });
      else out.push({ id: "tsat", lv: "red", ic: "warn", title: t("TSAT expired"), text: t("Set a new TOBT or call ATC."), app: "ops" });
    }
    const r = toPick(o); // take-off data from SimBrief's runway analysis
    if (r?.v1) out.push({ id: "perf-to", lv: "info", ic: "plane", title: t("Take-off RWY {r}", { r: r.id }), text: `V1 ${r.v1} · VR ${r.vr} · V2 ${r.v2}${r.flaps ? " · " + r.flaps : ""}${r.flex != null ? " · FLEX " + r.flex + "°" : r.thrust ? " · " + r.thrust : ""}`, app: "fly", tab: "perf" });
  }
  // en route: fuel checks
  if (st.takeoff && !st.landing && (d.phase === "cruise" || d.phase === "climb" && now - st.takeoff > 45 * 60e3)) {
    const last = st.checks[st.checks.length - 1];
    if (!last || now - last.t > 60 * 60e3) out.push({ id: "fuel", lv: "attn", ic: "fuel", title: t("Fuel check due"), text: last ? t("Last check {t} ago at {fix}", { t: dur(now - last.t), fix: last.fix }) : t("No fuel check on this flight yet."), app: "fly", tab: "fuel" });
  }
  if (d.fs.expLdg != null && st.checks.length && d.fs.expLdg < d.fs.minLdg) out.push({ id: "minfuel", lv: "red", ic: "fuel", title: t("Landing fuel below minimum"), text: t("Expected {a} · minimum {b}", { a: fmtW(d.fs.expLdg, o), b: fmtW(d.fs.minLdg, o) }), app: "fly", tab: "fuel" });
  // arrival: stand, ATIS
  if (st.takeoff && !st.onBlock) {
    const toLand = d.est.on - now;
    if (toLand < 40 * 60e3 || st.landing) {
      const s = arrivalStand();
      if (s?.ref) out.push({ id: "stand", lv: "ok", ic: "gate", title: (s.gate ? t("Gate {r}", { r: s.ref }) : t("Stand {r}", { r: s.ref })) + " · " + o.dest.icao, text: s.state === "parked" ? t("You are parked.") : s.src ? t("Assigned by {src}", { src: s.src }) : [s.term, t("forecast")].filter(Boolean).join(" · "), app: "ops" });
    }
    const L = !st.landing && d.toGo < 250 ? ldgPick(o) : null;
    if (L?.D?.vref) out.push({ id: "perf-ldg", lv: "info", ic: "plane", title: t("Landing RWY {r}", { r: L.r.id || o.dest.rwy || "—" }), text: `VREF ${L.D.vref}${L.vapp ? " · VAPP " + L.vapp : ""}${L.D.flaps ? " · " + L.D.flaps : ""}${L.D.brake ? " · AB " + L.D.brake : ""}`, app: "fly", tab: "perf" });
    const a = atisOf(o.dest.icao);
    if (a && d.toGo < 180 && !st.landing) {
      const r = runwayOf(o.dest.icao, "arr");
      out.push({ id: "atis", lv: "info", ic: "radio", title: t("{icao} information {l}", { icao: o.dest.icao, l: a.letter || "—" }), text: [r?.rwy && t("Landing runway {r}", { r: r.rwy }), a.freq && "ATIS " + a.freq].filter(Boolean).join(" · "), app: "ops" });
    }
  }
  if (st.onBlock) out.push({ id: "logged", lv: "ok", ic: "check", title: t("Flight logged"), text: t("{f} · block {b}", { f: o.iataNo || o.callsign, b: dur(st.onBlock - st.offBlock) }), app: "log" });
  return out;
}
