// Weights in the unit the pilot chose (kg, t or lb); SimBrief OFPs come in kg or lb.
import { settings } from "./data.js";
import { nf } from "./i18n.js";

export function toUnit(v, ofp) {
  if (v == null || isNaN(v)) return null;
  const kg = ofp?.units === "lb" ? v * 0.45359237 : v;
  return settings.unit === "lb" ? kg / 0.45359237 : settings.unit === "t" ? kg / 1000 : kg;
}
export function fromUnit(v, ofp) { // what the pilot typed -> OFP units
  const kg = settings.unit === "lb" ? v * 0.45359237 : settings.unit === "t" ? v * 1000 : v;
  return ofp?.units === "lb" ? kg / 0.45359237 : kg;
}
export const unitLabel = () => (settings.unit === "lb" ? "lb" : settings.unit === "t" ? "t" : "kg");
export function fmtW(v, ofp, opts = {}) {
  const x = toUnit(v, ofp);
  if (x == null) return "—";
  const d = settings.unit === "t" ? 1 : 0;
  const s = (opts.sign && x > 0 ? "+" : "") + nf(settings.unit === "t" ? x : Math.round(x / (opts.round || 1)) * (opts.round || 1), d);
  return opts.bare ? s : s + " " + unitLabel();
}
