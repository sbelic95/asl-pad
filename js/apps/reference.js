// Reference: quick look-ups for line flying, offline – phonetic alphabet, a unit converter, transponder codes and
// light signals, and the METAR abbreviations. Own tables from ICAO standards, no external library.
import { t, loc } from "../i18n.js";
import { esc, store } from "../util.js";

export const name = "Reference";
export const tabs = [["abc", "Alphabet"], ["units", "Converter"], ["codes", "Codes & signals"], ["metar", "METAR"]];
const o = (en, sr, de) => ({ en, sr, de });
const ABC = ["Alfa", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliett", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "X-ray", "Yankee", "Zulu"];
const NUM = ["Zero", "One", "Two", "Tree", "Four", "Fife", "Six", "Seven", "Eight", "Niner"];
// [key, label, factor to the base unit] per group; temperature is handled on its own
const UNITS = [
  ["alt", o("Altitude", "Visina", "Höhe"), [["ft", "ft", 0.3048], ["m", "m", 1]]],
  ["spd", o("Speed", "Brzina", "Geschwindigkeit"), [["kt", "kt", 1.852], ["kmh", "km/h", 1], ["mph", "mph", 1.609344]]],
  ["dist", o("Distance", "Rastojanje", "Entfernung"), [["nm", "NM", 1.852], ["km", "km", 1], ["mi", "mi", 1.609344]]],
  ["mass", o("Weight", "Težina", "Gewicht"), [["kg", "kg", 1], ["lb", "lb", 0.45359237]]],
  ["press", o("Pressure", "Pritisak", "Luftdruck"), [["hpa", "hPa", 1], ["inhg", "inHg", 33.8639]]],
  ["vol", o("Fuel volume", "Zapremina goriva", "Treibstoffvolumen"), [["l", "l", 1], ["usg", "US gal", 3.785411784]]],
];
const CODES = [
  ["7500", o("Unlawful interference", "Nezakonito ometanje", "Widerrechtlicher Eingriff")], ["7600", o("Radio failure", "Otkaz radio veze", "Funkausfall")],
  ["7700", o("Emergency", "Opasnost", "Notfall")], ["2000", o("Entering controlled airspace without a code (ICAO)", "Ulazak u kontrolisani prostor bez koda (ICAO)", "Einflug in kontrollierten Luftraum ohne Code (ICAO)")],
  ["7000", o("VFR conspicuity code in Europe", "VFR kod u Evropi", "VFR-Code in Europa")], ["1200", o("VFR code in the USA", "VFR kod u SAD", "VFR-Code in den USA")],
];
const LIGHTS = [
  [o("Steady green", "Stalno zeleno", "Grünes Dauerlicht"), o("Cleared to land", "Odobreno sletanje", "Landung frei"), o("Cleared for take-off", "Odobreno poletanje", "Start frei")],
  [o("Steady red", "Stalno crveno", "Rotes Dauerlicht"), o("Give way, continue circling", "Ustupi prednost, nastavi kruženje", "Vorrang gewähren, weiter kreisen"), o("Stop", "Stani", "Halt")],
  [o("Green flashes", "Zeleno trepćuće", "Grüne Blinkzeichen"), o("Return for landing", "Vrati se na sletanje", "Zur Landung zurückkehren"), o("Cleared to taxi", "Odobreno taksiranje", "Rollen frei")],
  [o("Red flashes", "Crveno trepćuće", "Rote Blinkzeichen"), o("Aerodrome unsafe, do not land", "Aerodrom nije bezbedan, ne sleći", "Flugplatz unsicher, nicht landen"), o("Taxi clear of the landing area", "Skloni se sa površine za sletanje", "Landefläche frei machen")],
  [o("White flashes", "Belo trepćuće", "Weiße Blinkzeichen"), o("Land here, then taxi to the apron", "Sleti ovde, pa taksiraj na platformu", "Hier landen, dann zum Vorfeld rollen"), o("Return to the starting point", "Vrati se na polaznu tačku", "Zum Ausgangspunkt zurück")],
];
const METAR = [
  ["CAVOK", o("Visibility 10 km or more, no cloud below 5000 ft, no significant weather", "Vidljivost 10 km ili više, bez oblaka ispod 5000 ft, bez značajnih pojava", "Sicht 10 km oder mehr, keine Wolken unter 5000 ft, kein signifikantes Wetter")],
  ["FEW / SCT / BKN / OVC", o("1–2 / 3–4 / 5–7 / 8 oktas of cloud", "1–2 / 3–4 / 5–7 / 8 osmina oblaka", "1–2 / 3–4 / 5–7 / 8 Achtel Bewölkung")],
  ["CB / TCU", o("Cumulonimbus / towering cumulus", "Kumulonimbus / razvijeni kumulus", "Cumulonimbus / aufgetürmter Cumulus")],
  ["RA / SN / DZ / GR", o("Rain / snow / drizzle / hail", "Kiša / sneg / rosulja / grad", "Regen / Schnee / Niesel / Hagel")],
  ["BR / FG / HZ", o("Mist / fog / haze", "Sumaglica / magla / izmaglica", "Dunst / Nebel / trockener Dunst")],
  ["TS / SH / FZ", o("Thunderstorm / showers / freezing", "Grmljavina / pljuskovi / ledeno", "Gewitter / Schauer / gefrierend")],
  ["– / +", o("Light / heavy", "Slabo / jako", "Leicht / stark")],
  ["VRB", o("Variable wind direction", "Promenljiv pravac vetra", "Wechselnde Windrichtung")],
  ["G", o("Gusts, e.g. 27015G28KT", "Udari, npr. 27015G28KT", "Böen, z. B. 27015G28KT")],
  ["Q1013 / A2992", o("QNH in hPa / in inches of mercury", "QNH u hPa / u inčima žive", "QNH in hPa / in Zoll Quecksilber")],
  ["NOSIG / BECMG / TEMPO", o("No significant change / becoming / temporarily", "Bez značajne promene / postaje / privremeno", "Keine wesentliche Änderung / werdend / zeitweise")],
  ["R27/1200", o("Runway visual range 1200 m on runway 27", "Vidljivost duž piste 27: 1200 m", "Pistensichtweite 1200 m auf Piste 27")],
];

let V = store.get("asl.ref.conv", { g: "alt", v: "1000", u: "ft", c: "15" });
const conv = (g, v, from) => { const G = UNITS.find((x) => x[0] === g)[2], f = G.find((x) => x[0] === from)[2]; return G.map(([k, l, k2]) => [l, (v * f) / k2, k === from]); };
const fmt = (x) => (Math.abs(x) >= 100 ? Math.round(x).toLocaleString() : x.toFixed(2));

export function render(body, ctx) {
  if (!body._ref) { body._ref = true;
    body.addEventListener("input", (e) => { const k = e.target.dataset.conv; if (!k) return; V = { ...V, [k]: e.target.value }; store.set("asl.ref.conv", V); draw(body, ctx); });
    body.addEventListener("click", (e) => { const b = e.target.closest("[data-grp],[data-unit]"); if (!b) return; if (b.dataset.grp) V = { ...V, g: b.dataset.grp, u: UNITS.find((x) => x[0] === b.dataset.grp)[2][0][0] }; else V = { ...V, u: b.dataset.unit }; store.set("asl.ref.conv", V); body.innerHTML = ""; render(body, ctx); });
  }
  if (ctx.tab === "units") { if (!body.querySelector("[data-conv=v]")) body.innerHTML = convHtml(); draw(body, ctx); return; }
  body.innerHTML = ctx.tab === "codes" ? codesHtml() : ctx.tab === "metar" ? metarHtml() : abcHtml();
}
const abcHtml = () => `<div class="card"><div class="lbl" style="margin-bottom:10px">${t("ICAO spelling alphabet")}</div><div class="ref-abc">${ABC.map((w) => `<div><b>${w[0]}</b><span>${w}</span></div>`).join("")}</div></div>
  <div class="card"><div class="lbl" style="margin-bottom:10px">${t("Numbers on the radio")}</div><div class="ref-abc">${NUM.map((w, i) => `<div><b>${i}</b><span>${w}</span></div>`).join("")}<div><b>.</b><span>Decimal</span></div><div><b>00</b><span>Hundred</span></div><div><b>000</b><span>Thousand</span></div></div></div>`;
function convHtml() {
  const G = UNITS.find((x) => x[0] === V.g) || UNITS[0];
  return `<div class="card"><div class="seg ref-grp">${UNITS.map(([k, l]) => `<button data-grp="${k}" class="${k === G[0] ? "on" : ""}">${esc(loc(l))}</button>`).join("")}</div>
    <div class="ref-in"><input data-conv="v" inputmode="decimal" value="${esc(V.v)}"><div class="seg">${G[2].map(([k, l]) => `<button data-unit="${k}" class="${k === V.u ? "on" : ""}">${esc(l)}</button>`).join("")}</div></div><div class="ref-out"></div></div>
    <div class="card"><div class="lbl" style="margin-bottom:8px">${t("Temperature")}</div><div class="ref-in"><input data-conv="c" inputmode="decimal" value="${esc(V.c)}"> °C</div><div class="ref-t"></div></div>`;
}
function draw(body) {
  const v = parseFloat(String(V.v).replace(",", ".")), c = parseFloat(String(V.c).replace(",", "."));
  const out = body.querySelector(".ref-out"), tt = body.querySelector(".ref-t");
  if (out) out.innerHTML = isNaN(v) ? "" : conv(V.g, v, V.u).filter((x) => !x[2]).map(([l, x]) => `<div><b class="num">${fmt(x)}</b> ${esc(l)}</div>`).join("");
  if (tt) tt.innerHTML = isNaN(c) ? "" : `<div><b class="num">${fmt(c * 9 / 5 + 32)}</b> °F</div><div><b class="num">${fmt(c + 273.15)}</b> K</div><div class="dim">${t("ISA at sea level: 15 °C. Deviation: {d} °C", { d: fmt(c - 15) })}</div>`;
}
const codesHtml = () => `<div class="card"><div class="lbl" style="margin-bottom:10px">${t("Transponder codes")}</div>${CODES.map(([c, d]) => `<div class="ref-row"><b class="num">${c}</b><span>${esc(loc(d))}</span></div>`).join("")}</div>
  <div class="card"><div class="lbl" style="margin-bottom:10px">${t("Light signals from the tower")}</div><table class="ref-tab"><tr><th></th><th>${t("In the air")}</th><th>${t("On the ground")}</th></tr>${LIGHTS.map(([s, a, g]) => `<tr><td><b>${esc(loc(s))}</b></td><td>${esc(loc(a))}</td><td>${esc(loc(g))}</td></tr>`).join("")}</table></div>`;
const metarHtml = () => `<div class="card"><div class="lbl" style="margin-bottom:10px">${t("METAR and TAF abbreviations")}</div>${METAR.map(([c, d]) => `<div class="ref-row"><b class="num">${esc(c)}</b><span>${esc(loc(d))}</span></div>`).join("")}</div>`;
export function summary() { return [t("Reference"), t("Alphabet, converter, codes, METAR")]; }
