// Alerts with sound: changes the crew must not miss, compared with what the pad saw last time (never on the first look).
//   slot – TSAT, CTOT or TOBT (vIFF CDM) or the planned off-block time (new OFP of the same flight) changed, in the 3 hours
//          before off-block and before take-off
//   atis – a new ATIS letter at the departure airport (before take-off) or at the destination (from take-off on)
// CPDLC and other ACARS messages sound in js/hoppie.js when they arrive.
import { S, onChange, atisOf } from "./data.js";
import { notify } from "./notify.js";
import { play } from "./sound.js";
import { t } from "./i18n.js";
import { hhmmz } from "./util.js";

let seen = { key: "", cdm: {}, out: null, atis: {} };
function check() {
  const o = S.ofp; if (!o) return;
  const key = o.callsign + o.dep?.icao + o.dest?.icao;
  if (seen.key !== key) { seen = { key, cdm: {}, out: o.times?.out ?? null, atis: {} }; } // new flight: start fresh, no alert
  const now = Date.now(), before = !S.st?.takeoff, soon = o.times?.out && o.times.out - now < 3 * 3600e3;
  // slot, TSAT, TOBT and the off-block time
  if (before && soon) {
    const c = S.cdm || {}, changes = [];
    for (const [k, l] of [["ctot", "CTOT"], ["tsat", "TSAT"], ["tobt", "TOBT"]]) {
      const v = c[k] ?? null, was = seen.cdm[k];
      if (was !== undefined && v && was !== v) changes.push(`${l} ${was ? hhmmz(was) + " → " : ""}${hhmmz(v)}`);
      seen.cdm[k] = v;
    }
    const out = o.times?.out ?? null;
    if (seen.out != null && out && out !== seen.out) changes.push(`${t("Off-block")} ${hhmmz(seen.out)} → ${hhmmz(out)}`);
    seen.out = out;
    if (changes.length) { play("slot"); notify({ app: "fly", tab: "vdgs", ic: "clock", lv: "attn", title: t("Departure times changed"), text: changes.join(" · "), tag: "slot" }); }
  } else { for (const k of ["ctot", "tsat", "tobt"]) seen.cdm[k] = S.cdm?.[k] ?? null; seen.out = o.times?.out ?? null; }
  // ATIS letter: departure before take-off, destination from take-off on
  const apt = before ? o.dep?.icao : o.dest?.icao, a = apt && atisOf(apt);
  const letter = a ? (before ? a.depLetter : a.letter) : "";
  if (apt && letter) {
    const was = seen.atis[apt];
    if (was && was !== letter) { play("atis"); notify({ app: "fly", tab: "radio", ic: "radio", lv: "info", title: t("New ATIS {a}", { a: apt }), text: t("Information {l} (was {w})", { l: letter, w: was }), tag: "atis-" + apt }); }
    seen.atis[apt] = letter;
  }
}
export function startAlerts() { onChange(() => { try { check(); } catch (e) { console.error(e); } }); }
