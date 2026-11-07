// Time zone of an airport: IANA zone from airports.json (loaded once), else SimBrief's hour offset.
let APTS = null, req = null;
export function loadAirports() {
  if (!req) req = fetch("airports.json").then((r) => r.json()).then((d) => { APTS = d; return d; }).catch(() => { req = null; return null; });
  return req;
}
export const aptDb = (icao) => APTS?.[icao] || null; // [lat, lon, city, tz]
export function tzOf(apt) {
  if (!apt) return undefined;
  const z = APTS?.[apt.icao]?.[3];
  if (z) return z;
  if (apt.tzH != null && Number.isInteger(apt.tzH)) return "Etc/GMT" + (apt.tzH > 0 ? "-" : "+") + Math.abs(apt.tzH); // Etc zones have inverted signs
  return "UTC";
}
export const cityOf = (apt) => APTS?.[apt?.icao]?.[2]?.replace(/-/g, " ") || apt?.name || "";
