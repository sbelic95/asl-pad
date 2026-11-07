// SimBrief OFP (JSON v2) -> the flight model every app works with.
import { num, toMs, arr } from "./util.js";

export const SIMBRIEF = "https://www.simbrief.com/api/xml.fetcher.php";

// IATA codes for the flight number shown to crews (JU 500) of airlines often flown with this pad
export const IATA = { ASL: "JU", DLH: "LH", AUA: "OS", SWR: "LX", THY: "TK", AFR: "AF", KLM: "KL", BAW: "BA", UAE: "EK", QTR: "QR", WZZ: "W6", EZY: "U2", RYR: "FR", LOT: "LO", CTN: "OU", ROT: "RO", AEE: "A3", TAP: "TP", IBE: "IB", AZA: "AZ", ITY: "AZ", SAS: "SK", FIN: "AY", CSA: "OK", AAL: "AA", UAL: "UA", DAL: "DL", ETD: "EY", FDB: "FZ" };

const pos = (x) => (x && x.pos_lat != null && x.pos_long != null && x.pos_lat !== "" ? [+x.pos_lat, +x.pos_long] : null);
const txt = (v) => (Array.isArray(v) ? v.join(" ") : v == null ? "" : String(v)).trim();

function airport(x, wx = {}) {
  if (!x || !x.icao_code) return null;
  return {
    icao: x.icao_code, iata: x.iata_code || "", name: titleCase(x.name || ""), pos: pos(x),
    elev: num(x.elevation), rwy: x.plan_rwy || "", transAlt: num(x.trans_alt), transLevel: num(x.trans_level),
    metar: txt(x.metar || wx.metar), taf: txt(x.taf || wx.taf),
    tzH: x.timezone !== undefined && x.timezone !== "" ? Number(x.timezone) : null,
  };
}
export function titleCase(s) {
  return String(s).toLowerCase().replace(/(^|[\s/(-])([a-zà-ž])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bIntl\b/i, "Intl");
}

// SimBrief runway analysis (TLR): take-off speeds, flaps, thrust and landing distances for every runway.
// Present only when the runway analysis was switched on for the OFP. Lengths in metres, elevation in feet, weights in OFP units.
function normTlr(x) {
  if (!x || (!x.takeoff && !x.landing)) return null;
  const s = (v) => (v == null || Array.isArray(v) || typeof v === "object" ? "" : String(v).trim());
  const rwy = (r) => ({
    id: s(r.identifier), len: num(r.length), tora: num(r.length_tora), toda: num(r.length_toda), asda: num(r.length_asda), lda: num(r.length_lda),
    elev: num(r.elevation), course: num(r.true_course) ?? num(r.magnetic_course), hw: num(r.headwind_component), xw: num(r.crosswind_component), ils: s(r.ils_frequency),
    flaps: s(r.flap_setting), thrust: s(r.thrust_setting), bleed: s(r.bleed_setting), antiIce: s(r.anti_ice_setting), flex: num(r.flex_temperature),
    maxTemp: num(r.max_temperature), maxW: num(r.max_weight), limit: s(r.limit_code), v1: num(r.speeds_v1), vr: num(r.speeds_vr), v2: num(r.speeds_v2),
    other: num(r.speeds_other), otherId: s(r.speeds_other_id), maxWDry: num(r.max_weight_dry), maxWWet: num(r.max_weight_wet),
  });
  const cond = (c = {}) => ({ apt: s(c.airport_icao), rwy: s(c.planned_runway), w: num(c.planned_weight), flaps: s(c.flap_setting), wdir: num(c.wind_direction),
    wspd: num(c.wind_speed), temp: num(c.temperature), alt: num(c.altimeter), surface: s(c.surface_condition) });
  const dist = (d) => (d ? { w: num(d.weight), flaps: s(d.flap_setting), brake: s(d.brake_setting), rev: s(d.reverser_credit), vref: num(d.speeds_vref),
    actual: num(d.actual_distance), factored: num(d.factored_distance) } : null);
  return {
    to: x.takeoff ? { cond: cond(x.takeoff.conditions), rwys: arr(x.takeoff.runway).map(rwy).filter((r) => r.id) } : null,
    ldg: x.landing ? { cond: cond(x.landing.conditions), dry: dist(x.landing.distance_dry), wet: dist(x.landing.distance_wet), rwys: arr(x.landing.runway).map(rwy).filter((r) => r.id) } : null,
  };
}

export function normOfp(d) {
  const g = d.general || {}, t = d.times || {}, w = d.weights || {}, f = d.fuel || {}, ac = d.aircraft || {}, wx = d.weather || {};
  const units = /lb/i.test(d.params?.units || "") ? "lb" : "kg";
  const dep = airport(d.origin, { metar: wx.orig_metar, taf: wx.orig_taf });
  const dest = airport(d.destination, { metar: wx.dest_metar, taf: wx.dest_taf });
  const altns = arr(d.alternate).map((a, i) => airport(a, i === 0 ? { metar: wx.altn_metar, taf: wx.altn_taf } : {})).filter(Boolean);
  // EDTO / ETOPS: suitable airports
  const et = d.etops || {};
  const edtoApts = arr(et.suitable_airport || et.airport).map((a) => airport(a)).filter(Boolean);
  const edto = (g.is_etops === "1" || edtoApts.length) ? { rule: num(et.rule) || null, airports: edtoApts } : null;

  // navlog: cumulative distance and time from the start
  let cum = 0;
  const fixes = arr(d.navlog?.fix || d.navlog).map((x) => {
    cum += num(x.distance) || 0;
    return {
      ident: x.ident || "", name: x.name || "", type: x.type || "", pos: pos(x), airway: x.via_airway || "", stage: x.stage || "",
      sidstar: x.is_sid_star === "1", alt: num(x.altitude_feet), wind: [num(x.wind_dir), num(x.wind_spd)], oat: num(x.oat), isa: num(x.oat_isa_dev),
      tropo: num(x.tropopause_feet), mora: num(x.mora), ground: num(x.ground_height), legNm: num(x.distance) || 0, cumNm: cum,
      t: num(x.time_total), fob: num(x.fuel_plan_onboard), fobMin: num(x.fuel_min_onboard), tas: num(x.true_airspeed), gs: num(x.groundspeed), mach: num(x.mach),
    };
  }).filter((x) => x.pos);
  // start the route at the departure airport (SimBrief's first fix is the first waypoint after take-off)
  if (dep?.pos && fixes.length && fixes[0].ident !== dep.icao) {
    fixes.unshift({ ident: dep.icao, name: dep.name, type: "apt", pos: dep.pos, airway: "", stage: "CLB", alt: dep.elev, legNm: 0, cumNm: 0, t: 0,
      fob: num(f.plan_takeoff), fobMin: num(f.min_takeoff), wind: [null, null] });
  }
  const callsign = (d.atc?.callsign || (g.icao_airline || "") + (g.flight_number || "")).toUpperCase();
  const out = toMs(t.sched_out), off = toMs(t.sched_off), on = toMs(t.sched_on), inn = toMs(t.sched_in);
  return {
    id: d.params?.request_id || String(d.params?.time_generated || ""), generated: toMs(d.params?.time_generated), airac: d.params?.airac || "",
    callsign, airline: g.icao_airline || callsign.slice(0, 3), number: g.flight_number || "",
    iataNo: IATA[g.icao_airline] && g.flight_number ? IATA[g.icao_airline] + g.flight_number : "",
    dep, dest, altns, edto,
    type: ac.icaocode || ac.icao_code || "", typeName: ac.name || "", reg: ac.reg || "", selcal: ac.selcal || "", fin: ac.fin || "",
    pax: num(w.pax_count_actual) ?? num(w.pax_count), ci: g.costindex || "", cruise: num(g.initial_altitude), stepclimb: g.stepclimb_string || "",
    route: g.route || "", dist: num(g.route_distance), airDist: num(g.air_distance), avgWind: num(g.avg_wind_comp),
    units,
    fuel: {
      taxi: num(f.taxi), trip: num(f.enroute_burn), cont: num(f.contingency), altn: num(f.alternate_burn), final: num(f.reserve),
      etops: num(f.etops), extra: num(f.extra), block: num(f.plan_ramp), takeoff: num(f.plan_takeoff), landing: num(f.plan_landing),
      minTakeoff: num(f.min_takeoff),
    },
    weights: { zfw: num(w.est_zfw), maxZfw: num(w.max_zfw), tow: num(w.est_tow), maxTow: num(w.max_tow), ldw: num(w.est_ldw), maxLdw: num(w.max_ldw), payload: num(w.payload) },
    times: { out, off, on, in: inn, ete: num(t.est_time_enroute) ?? num(t.sched_time_enroute), block: num(t.sched_block) ?? num(t.est_block) },
    navlog: fixes,
    tlr: normTlr(d.tlr),
    pdf: d.files?.pdf?.link ? (d.files.directory || "") + d.files.pdf.link : "",
    prefile: d.prefile?.vatsim?.link || "",
  };
}

export async function fetchOfp(id, getJSON) {
  const q = /^\d+$/.test(id) ? "userid=" + id : "username=" + encodeURIComponent(id);
  const d = await getJSON(SIMBRIEF + "?" + q + "&json=v2", 20000);
  if (!d || !String(d.fetch?.status).startsWith("Success")) {
    throw new Error(/unknown|not found/i.test(d?.fetch?.status || "") ? "user" : "noofp");
  }
  return normOfp(d);
}
