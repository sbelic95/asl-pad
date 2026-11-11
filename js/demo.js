// Demo: JU500 Belgrade - New York JFK on an A330-200 with EDTO, built as a SimBrief JSON so the real parser runs.
// The aircraft moves along the route in real time. ?demo=ground starts at the gate in Belgrade.
import { distKm, greatCircle, bearing } from "./util.js";

const WP = [ // ident, lat, lon, airway (simplified demo route)
  ["LYBE", 44.8184, 20.3091, ""], ["OSTOV", 45.32, 19.55, "SID"], ["NIKUS", 46.02, 18.55, "L605"], ["LAGEP", 46.82, 17.21, "L605"],
  ["GRZEB", 47.45, 15.30, "Y186"], ["KOPIT", 48.25, 12.95, "Y186"], ["ABLOM", 49.55, 10.05, "UN850"], ["TORNU", 50.58, 7.15, "UN850"],
  ["REDSA", 51.48, 4.20, "UL620"], ["NIGIT", 52.22, 1.48, "UL620"], ["RAMOX", 53.02, -1.55, "UL975"], ["BAGSO", 53.46, -4.52, "UL975"],
  ["GIGTO", 53.62, -7.48, "UL975"], ["DOGAL", 54.0, -15.0, "DCT"], ["5420N", 54.0, -20.0, "NATC"], ["5430N", 54.0, -30.0, "NATC"],
  ["5340N", 53.0, -40.0, "NATC"], ["5150N", 51.0, -50.0, "NATC"], ["LOMSI", 50.0, -53.5, "NATC"], ["TEPLO", 47.8, -60.0, "N178A"],
  ["RIKAL", 46.0, -64.5, "N178A"], ["BRADD", 44.4, -67.8, "J581"], ["SCUPP", 42.9, -70.4, "J581"], ["ROBUC", 41.6, -72.1, "STAR"],
  ["CAMRN", 41.0, -73.2, "STAR"], ["KJFK", 40.6398, -73.7789, ""],
];
const APT = {
  LYBE: { name: "BELGRADE NIKOLA TESLA", iata: "BEG", pos: [44.8184, 20.3091], elev: 335, tz: 1 },
  KJFK: { name: "NEW YORK JOHN F KENNEDY INTL", iata: "JFK", pos: [40.6398, -73.7789], elev: 13, tz: -5 },
  KEWR: { name: "NEWARK LIBERTY INTL", iata: "EWR", pos: [40.6925, -74.1687], elev: 18, tz: -5 },
  EINN: { name: "SHANNON", iata: "SNN", pos: [52.7019, -8.9248], elev: 46 },
  BIKF: { name: "KEFLAVIK", iata: "KEF", pos: [63.985, -22.6056], elev: 171 },
  CYYT: { name: "ST JOHNS INTL", iata: "YYT", pos: [47.6186, -52.7519], elev: 461 },
  LPLA: { name: "LAJES", iata: "TER", pos: [38.7618, -27.0908], elev: 180 },
};
const DEMO_START = Date.now();

export function demoMetars(now = Date.now()) {
  const d = new Date(now), z = String(d.getUTCDate()).padStart(2, "0") + String(d.getUTCHours()).padStart(2, "0") + "20Z";
  return {
    LYBE: `LYBE ${z} 31008KT CAVOK 12/04 Q1021 NOSIG`,
    KJFK: `KJFK ${z} 31014G22KT 10SM FEW045 BKN250 09/M03 A3008`,
    KEWR: `KEWR ${z} 30012KT 10SM SCT050 08/M04 A3009`,
    EINN: `EINN ${z} 24018KT 9999 -RA BKN012 OVC020 11/09 Q1006`,
    BIKF: `BIKF ${z} 05022G34KT 8000 -SN BKN008 OVC015 M01/M03 Q0994`,
    CYYT: `CYYT ${z} 27015KT 15SM FEW030 BKN090 03/M05 A2996`,
    LPLA: `LPLA ${z} 22012KT 9999 SCT025 18/14 Q1019`,
  };
}
export function demoAtis() {
  return [{ callsign: "KJFK_ATIS", frequency: "128.725", atis_code: "K",
    text_atis: ["KENNEDY ARRIVAL INFORMATION KILO. 2251Z. WIND 310 AT 14 GUST 22. VISIBILITY 10.",
      "FEW 045 BKN 250. TEMPERATURE 9 DEWPOINT MINUS 3. ALTIMETER 3008.",
      "ILS RUNWAY 31R APPROACH IN USE. LANDING RUNWAY 31R. DEPARTING RUNWAY 31L.", "ADVISE ON INITIAL CONTACT YOU HAVE INFORMATION KILO."] }];
}
export function demoControllers() {
  return [
    { callsign: "KJFK_TWR", frequency: "119.100", facility: 4, name: "Demo" }, { callsign: "KJFK_GND", frequency: "121.900", facility: 3, name: "Demo" },
    { callsign: "NY_APP", frequency: "132.400", facility: 5, name: "Demo" }, { callsign: "LYBE_TWR", frequency: "118.100", facility: 4, name: "Demo" },
  ];
}

// a SimBrief-style JSON (v2) for the demo flight
export function demoSimbrief(ground) {
  const now = Date.now();
  // in the air: about 3 h 40 min after the scheduled off-block; on the ground: off-block in 35 min
  const out = ground ? now + 35 * 60e3 : DEMO_START - (3 * 60 + 40) * 60e3;
  const fixes = [];
  let cum = 0, t = 0, fob = 63800;
  const n = WP.length;
  for (let i = 1; i < n; i++) {
    const [id, la, lo, aw] = WP[i], prev = WP[i - 1];
    const leg = distKm([prev[1], prev[2]], [la, lo]) / 1.852;
    cum += leg;
    const climb = i <= 3, desc = i >= n - 3;
    const gs = climb ? 330 : desc ? 300 : 432;
    t += (leg / gs) * 3600;
    fob -= (leg / gs) * (climb ? 7600 : desc ? 2600 : 5650);
    const alt = i === n - 1 ? 13 : climb ? [0, 14000, 28000, 35000][i] : desc ? (i === n - 2 ? 6000 : 16000) : i >= 16 ? 37000 : 35000;
    fixes.push({ ident: id, name: id, type: id.length === 4 && i === n - 1 ? "apt" : "wpt", pos_lat: la, pos_long: lo, via_airway: aw,
      stage: climb ? "CLB" : desc ? "DSC" : "CRZ", is_sid_star: aw === "SID" || aw === "STAR" ? "1" : "0",
      distance: Math.round(leg), altitude_feet: alt, wind_dir: 265 + (i % 5) * 6, wind_spd: climb || desc ? 25 : 40 + (i % 4) * 9,
      oat: alt > 30000 ? -52 - (i % 3) : -10, oat_isa_dev: 1, tropopause_feet: 32100, mora: i < 13 ? 5300 : i > 19 ? 4100 : 0,
      ground_height: i < 13 ? 1200 : 0, time_total: Math.round(t), fuel_plan_onboard: Math.round(fob), fuel_min_onboard: Math.round(fob - 1700),
      true_airspeed: climb || desc ? 380 : 480, groundspeed: gs, mach: 0.82 });
  }
  const ete = Math.round(t);
  const apt = (k, extra = {}) => ({ icao_code: k, iata_code: APT[k].iata, name: APT[k].name, pos_lat: APT[k].pos[0], pos_long: APT[k].pos[1], elevation: APT[k].elev, timezone: APT[k].tz, ...extra });
  return {
    fetch: { status: "Success" },
    params: { request_id: "DEMO500", time_generated: String(Math.floor((out - 90 * 60e3) / 1000)), units: "kgs", airac: "2511" },
    general: { icao_airline: "ASL", flight_number: "500", is_etops: "1", costindex: "40", initial_altitude: "35000", stepclimb_string: "FL350 5430N FL370",
      route: "OSTOV1D OSTOV L605 LAGEP Y186 KOPIT UN850 TORNU UL620 NIGIT UL975 GIGTO DCT DOGAL NATC LOMSI N178A RIKAL J581 SCUPP ROBUC3",
      route_distance: String(Math.round(cum)), air_distance: String(Math.round(cum * 1.07)), avg_wind_comp: "-38" },
    origin: apt("LYBE", { plan_rwy: "30L", trans_alt: 10000 }),
    destination: apt("KJFK", { plan_rwy: "31R", trans_alt: 18000 }),
    alternate: apt("KEWR", { plan_rwy: "22L" }),
    etops: { rule: "120", suitable_airport: ["EINN", "BIKF", "CYYT", "LPLA"].map((k) => apt(k)) },
    navlog: { fix: fixes },
    times: { sched_out: String(Math.floor(out / 1000)), sched_off: String(Math.floor((out + 18 * 60e3) / 1000)),
      sched_on: String(Math.floor((out + 18 * 60e3 + ete * 1000) / 1000)), sched_in: String(Math.floor((out + 26 * 60e3 + ete * 1000) / 1000)),
      est_time_enroute: String(ete), sched_block: String(ete + 26 * 60) },
    fuel: { taxi: "500", enroute_burn: String(Math.round(63800 - fob)), contingency: "2300", alternate_burn: "2400", reserve: "2550", extra: "900", etops: "0",
      plan_ramp: "64300", plan_takeoff: "63800", plan_landing: String(Math.round(fob)), min_takeoff: "62100" },
    weights: { pax_count: "246", pax_count_actual: "246", est_zfw: "168400", max_zfw: "170000", est_tow: "232200", max_tow: "238000", est_ldw: String(Math.round(168400 + fob)), max_ldw: "182000", payload: "25600" },
    aircraft: { icaocode: "A332", name: "A330-200", reg: "YU-ARB", selcal: "CJ-HL" },
    atc: { callsign: "ASL500" },
    weather: { orig_metar: demoMetars().LYBE, orig_taf: "TAF LYBE 0700/0806 31008KT CAVOK TEMPO 0712/0716 32015G25KT",
      dest_metar: demoMetars().KJFK, dest_taf: "TAF KJFK 0700/0806 31015G24KT P6SM FEW045 BKN250 FM072200 30010KT P6SM SCT060",
      altn_metar: demoMetars().KEWR, altn_taf: "TAF KEWR 0700/0806 30012KT P6SM SCT050" },
    files: { directory: "", pdf: {} },
    tlr: { // runway analysis as SimBrief writes it (demo values)
      takeoff: { conditions: { airport_icao: "LYBE", planned_runway: "30L", planned_weight: "232200", wind_direction: "310", wind_speed: "8", temperature: "12", altimeter: "30.15", surface_condition: "dry" },
        runway: [
          { identifier: "30L", length: "3500", length_tora: "3500", length_toda: "3500", length_asda: "3500", length_lda: "3500", elevation: "335", true_course: "300", magnetic_course: "295", headwind_component: "8", crosswind_component: "1",
            flap_setting: "CONF 1+F", thrust_setting: "FLEX", bleed_setting: "ON", anti_ice_setting: "OFF", flex_temperature: "52", max_temperature: "58", max_weight: "238000", limit_code: "F",
            speeds_v1: "149", speeds_vr: "153", speeds_v2: "158", speeds_other: "212", speeds_other_id: "F/S/O" },
          { identifier: "30R", length: "3400", length_tora: "3400", length_toda: "3400", length_asda: "3400", length_lda: "3400", elevation: "335", true_course: "302", magnetic_course: "297", headwind_component: "8", crosswind_component: "1",
            flap_setting: "CONF 1+F", thrust_setting: "FLEX", bleed_setting: "ON", anti_ice_setting: "OFF", flex_temperature: "50", max_temperature: "56", max_weight: "237100", limit_code: "F",
            speeds_v1: "148", speeds_vr: "153", speeds_v2: "158", speeds_other: "212", speeds_other_id: "F/S/O" },
          { identifier: "12R", length: "3500", length_tora: "3500", length_toda: "3500", length_asda: "3500", length_lda: "3500", elevation: "335", true_course: "120", magnetic_course: "115", headwind_component: "-8", crosswind_component: "-1",
            flap_setting: "CONF 2", thrust_setting: "FLEX", bleed_setting: "ON", anti_ice_setting: "OFF", flex_temperature: "41", max_temperature: "47", max_weight: "234600", limit_code: "F",
            speeds_v1: "143", speeds_vr: "149", speeds_v2: "154", speeds_other: "205", speeds_other_id: "F/S/O" },
        ] },
      landing: { conditions: { airport_icao: "KJFK", planned_runway: "31R", planned_weight: "180100", flap_setting: "FULL", wind_direction: "310", wind_speed: "14", temperature: "9", altimeter: "30.08", surface_condition: "dry" },
        distance_dry: { weight: "180100", flap_setting: "FULL", brake_setting: "LOW", reverser_credit: "NO", speeds_vref: "137", actual_distance: "1480", factored_distance: "1850" },
        distance_wet: { weight: "180100", flap_setting: "FULL", brake_setting: "MED", reverser_credit: "NO", speeds_vref: "137", actual_distance: "1700", factored_distance: "2130" },
        runway: [
          { identifier: "31R", length: "3048", length_lda: "2804", elevation: "13", true_course: "301", magnetic_course: "314", headwind_component: "14", crosswind_component: "0", ils_frequency: "111.50", max_weight_dry: "182000", max_weight_wet: "182000" },
          { identifier: "31L", length: "4423", length_lda: "3460", elevation: "13", true_course: "301", magnetic_course: "314", headwind_component: "14", crosswind_component: "0", ils_frequency: "109.50", max_weight_dry: "182000", max_weight_wet: "182000" },
          { identifier: "22L", length: "2560", length_lda: "2560", elevation: "13", true_course: "211", magnetic_course: "224", headwind_component: "0", crosswind_component: "14", ils_frequency: "109.50", max_weight_dry: "182000", max_weight_wet: "176400" },
          { identifier: "04R", length: "2560", length_lda: "2560", elevation: "13", true_course: "31", magnetic_course: "44", headwind_component: "0", crosswind_component: "-14", ils_frequency: "109.50", max_weight_dry: "182000", max_weight_wet: "176400" },
        ] },
    },
  };
}

// the demo aircraft: where it is now on the planned route (real time), as a VATSIM pilot record
export function demoPilot(ofp, ground) {
  const now = Date.now(), T = ofp.times;
  if (ground) {
    // parked at a gate in Belgrade until off-block
    if (now < T.out) return { callsign: ofp.callsign, latitude: 44.8199, longitude: 20.2918, altitude: 335, groundspeed: 0, heading: 120, flight_plan: { departure: "LYBE", arrival: "KJFK", aircraft_short: ofp.type } };
  }
  const tAir = (now - T.off) / 1000; // seconds since planned take-off
  const nl = ofp.navlog;
  if (tAir <= 0) return { callsign: ofp.callsign, latitude: nl[0].pos[0], longitude: nl[0].pos[1], altitude: ofp.dep.elev, groundspeed: now > T.out ? 12 : 0, heading: 300, flight_plan: { departure: "LYBE", arrival: "KJFK", aircraft_short: ofp.type } };
  let i = 0; while (i < nl.length - 2 && nl[i + 1].t < tAir) i++;
  const a = nl[i], b = nl[i + 1], f = Math.min(1, Math.max(0, (tAir - a.t) / ((b.t - a.t) || 1)));
  const seg = greatCircle(a.pos, b.pos, 40), k = Math.min(39, Math.floor(f * 40)), p = seg[k], q = seg[k + 1] || b.pos;
  const alt = (a.alt ?? 0) + ((b.alt ?? 0) - (a.alt ?? 0)) * f;
  return { callsign: ofp.callsign, latitude: p[0], longitude: p[1], altitude: Math.round(alt), groundspeed: b.gs || 430, heading: Math.round(bearing(p, q)),
    transponder: "4721", flight_plan: { departure: "LYBE", arrival: "KJFK", aircraft_short: ofp.type } };
}

// sample logbook so the logbook app is not empty in the demo
export function demoLogbook() {
  const day = 864e5, base = Date.now() - 2 * day;
  const mk = (n, dep, arr, depName, arrName, type, reg, out, blk, dist, path) => ({ id: "demo" + n, date: out, callsign: "ASL" + n, flightNo: "JU" + n,
    dep, arr, depName, arrName, type, reg, schedOut: out, schedIn: out + blk, offBlock: out + 4 * 60e3, takeoff: out + 18 * 60e3, landing: out + blk - 7 * 60e3,
    onBlock: out + blk + 2 * 60e3, distNm: dist, units: "kg", blockFuel: null, landingFuel: null, checks: 2, route: "", path });
  return [
    mk(122, "LYBE", "EDDF", "Belgrade Nikola Tesla", "Frankfurt Main", "A319", "YU-APA", base - day + 6 * 36e5, 125 * 60e3, 563, [[44.82, 20.31], [47.2, 15.5], [50.03, 8.57]]),
    mk(123, "EDDF", "LYBE", "Frankfurt Main", "Belgrade Nikola Tesla", "A319", "YU-APA", base - day + 9.5 * 36e5, 120 * 60e3, 563, [[50.03, 8.57], [47.2, 15.5], [44.82, 20.31]]),
    mk(330, "LYBE", "LDZA", "Belgrade Nikola Tesla", "Zagreb", "AT76", "YU-ALW", base + 7 * 36e5, 60 * 60e3, 205, [[44.82, 20.31], [45.3, 18.0], [45.74, 16.07]]),
  ];
}

// VATSIM events for the test (the real ones come from .github/workflows/vatsim-events.yml)
export function demoEvents(now = Date.now()) {
  const day = 864e5, at = (d, h) => { const x = new Date(now + d * day); x.setUTCHours(h, 0, 0, 0); return x.toISOString().replace(".000", ""); };
  return [
    { id: 1, name: "Belgrade Friday Night Ops", link: "https://my.vatsim.net/events", start: at(1, 18), end: at(1, 21), airports: ["LYBE"], text: "" },
    { id: 2, name: "Balkan Crossfire", link: "https://my.vatsim.net/events", start: at(2, 17), end: at(2, 21), airports: ["LYBE", "LDZA", "LQSA"], text: "" },
    { id: 3, name: "Frankfurt Real Ops", link: "https://my.vatsim.net/events", start: at(3, 16), end: at(3, 20), airports: ["EDDF"], text: "" },
    { id: 4, name: "New York Approach Night", link: "https://my.vatsim.net/events", start: at(4, 23), end: at(5, 2), airports: ["KJFK", "KEWR"], text: "" },
    { id: 5, name: "Vienna Overload", link: "https://my.vatsim.net/events", start: at(6, 15), end: at(6, 19), airports: ["LOWW"], text: "" },
  ];
}

// aircraft on the ground at Belgrade for the test: two parked, one of ours taxiing
export function demoTraffic() {
  return [
    { callsign: "WZZ4471", lat: 44.81904, lon: 20.292184, gs: 0, hdg: 210, type: "A21N" },
    { callsign: "THY5LV", lat: 44.821158, lon: 20.291823, gs: 0, hdg: 210, type: "A321" },
    { callsign: "ASL218", lat: 44.8196, lon: 20.2995, gs: 14, hdg: 300, type: "A319" },
  ];
}

// SIGMETs for the test: thunderstorms on the route over the Atlantic, turbulence over the Balkans
export function demoSigmets(now = Date.now()) {
  const iso = (h) => new Date(now + h * 36e5).toISOString().replace(/\.\d+Z$/, "Z");
  return [
    { fir: "EGGX", name: "SHANWICK OCEANIC", hazard: "TS", qual: "EMBD", from: iso(-1), to: iso(3), base: null, top: 39000,
      poly: [[56, -25], [58, -18], [55, -12], [52, -16], [52, -24]], raw: "EGGX SIGMET 3 VALID ... EMBD TS OBS ... TOP FL390 MOV E 20KT NC=" },
    { fir: "LYBA", name: "BEOGRAD", hazard: "TURB", qual: "SEV", from: iso(-2), to: iso(2), base: 25000, top: 38000,
      poly: [[46, 17], [46, 22], [43, 22], [43, 17]], raw: "LYBA SIGMET 1 VALID ... SEV TURB FCST FL250/380 STNR NC=" },
  ];
}
