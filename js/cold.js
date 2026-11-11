// Cold temperature correction of altitudes (ICAO PANS-OPS, Doc 8168): in cold air the true altitude is lower than
// the indicated one, so minimum altitudes have to be raised. Shown when the airport temperature is 0 °C or below.
//   ΔH = (−ΔT / L0) · ln(1 + L0 · h / (T0 + L0 · h_apt)), L0 = −0.0065 K/m, T0 = 288.15 K, ΔT = deviation from ISA at the airport
import { wxOf } from "./data.js";
import { t, nf } from "./i18n.js";
import { esc } from "./util.js";

const L0 = -0.0065, T0 = 288.15, FT = 0.3048;
// correction in ft for a height above the airport (ft), rounded up to 10 ft; 0 when it is not colder than ISA
export function coldCorrection(heightFt, elevFt, tempC) {
  const hA = (elevFt || 0) * FT, h = heightFt * FT, dT = tempC - (15 + L0 * hA);
  if (!(dT < 0) || h <= 0) return 0;
  const corr = (-dT / L0) * Math.log(1 + (L0 * h) / (T0 + L0 * hA)) / FT;
  return Math.ceil(corr / 10) * 10;
}

const HEIGHTS = [500, 1000, 1500, 2000, 3000, 4000, 5000];
export function coldHtml(o) {
  const cards = [o.dep, o.dest].filter((a, i, l) => a?.icao && l.findIndex((x) => x?.icao === a.icao) === i).map((a) => {
    const w = wxOf(a.icao); if (w?.temp == null || w.temp > 0) return "";
    const elev = a.elev || 0;
    const rows = HEIGHTS.map((h) => { const c = coldCorrection(h, elev, w.temp);
      return `<tr><td>${nf(h)} ft</td><td>${nf(elev + h)} ft</td><td class="r"><b>+${nf(c)}</b></td><td class="r">${nf(elev + h + c)} ft</td></tr>`; }).join("");
    return `<div class="card perf"><div class="perf-h"><div><div class="lbl">${t("Cold temperature correction")}</div><div class="perf-apt">${esc(a.icao)} <span>${w.temp} °C · ${t("elevation {e} ft", { e: nf(elev) })}</span></div></div></div>
      <table class="t" style="margin-top:8px"><thead><tr><th>${t("Height above airport")}</th><th>${t("Altitude")}</th><th class="r">${t("Correction")}</th><th class="r">${t("Fly at least")}</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="dim" style="font-size:12px;margin-top:8px">${t("ICAO formula for temperatures of 0 °C and below. Correct the procedure altitudes from the chart (e.g. FAF, missed approach) with the value for their height above the airport. No correction when ATC gives you an altitude by radar vectors – the controller does that.")}</div></div>`;
  });
  return cards.join("");
}
