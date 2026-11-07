// Stands and gate prediction, taken from the VDGS Slot Board (github.com/sbelic95/vdgs-slot-board) and kept in step
// with it. Stand data: OpenStreetMap (ODbL), prepared twice a day for every airport on the "stands" branch of that repo.
import { distKm, getJSON, inRing } from "./util.js";

const GH = "sbelic95/vdgs-slot-board"; // the data branches live there
export const SCHENGEN = /^(LO|EB|LB|LD|LK|EK|EE|EF|LF|ED|LG|LH|BI|LI|EV|EY|EL|LM|EH|EN|EP|LP|LR|LZ|LJ|LE|GC|ES|LS)/;
export const ALLIANCE = {
  star: "DLH CLH DLA EWG GEC UAL ACA SIA ANA SWR AUA BEL TAP THY LOT AEE ETH AIC SAA CCA ANZ AAR EVA AVA CMP CSZ MSR CTN THA".split(" "),
  oneworld: "BAW SHT AAL CPA JAL QFA QTR IBE IBS FIN MAS RJA ALK ASA FJI".split(" "),
  skyteam: "AFR HOP KLM DAL KAL CES SVA ITY VIR MEA ROT KQA AEA GIA VNA CAL AMX ARG SAS".split(" "), // SAS since 9/2024
  lowcost: "RYR RUK EZY EJU EZS WZZ WMT VLG TRA TVF NOZ NAX SXS PGT TUI TFL CFG BCS".split(" "),
};
export const allianceOf = (cs) => Object.keys(ALLIANCE).find((k) => ALLIANCE[k].includes(String(cs).slice(0, 3))) || "";
// home bases: at its hub an airline gets the main terminal and contact stands
export const HUBS = {
  DLH: "EDDF EDDM", CLH: "EDDF EDDM", DLA: "EDDM", EWG: "EDDL EDDK EDDH EDDS", CFG: "EDDF EDDM EDDL", TUI: "EDDH EDDV EGCC EGBB",
  BAW: "EGLL EGKK", SHT: "EGLL", EZY: "EGKK EGGW EGSS EGCC LFPG", EXS: "EGCC EGNM", VIR: "EGLL EGCC", AFR: "LFPG LFPO", HOP: "LFPO LFLL",
  KLM: "EHAM", TRA: "EHAM", UAE: "OMDB", FDB: "OMDB", QTR: "OTHH", ETD: "OMAA", SVA: "OEJN OERK", THY: "LTFM", PGT: "LTFJ",
  SWR: "LSZH LSGG", EDW: "LSZH", AUA: "LOWW", IBE: "LEMD", IBS: "LEMD", AEA: "LEMD", VLG: "LEBL", TAP: "LPPT", SAS: "EKCH ESSA ENGM",
  NOZ: "ENGM", FIN: "EFHK", LOT: "EPWA", ITY: "LIRF LIML", ASL: "LYBE", CTN: "LDZA", AEE: "LGAV", EIN: "EIDW", RYR: "EIDW LIRF LEMD",
  WZZ: "LHBP LROP EPKT", ICE: "BIKF", BEL: "EBBR", LGL: "ELLX", CSA: "LKPR", ROT: "LROP", TAR: "DTTA", RAM: "GMMN", MSR: "HECA",
  ETH: "HAAB", KQA: "HKJK", SAA: "FAOR", RJA: "OJAI", MEA: "OLBA", AIC: "VIDP VABB", SIA: "WSSS", CPA: "VHHH", MAS: "WMKK",
  THA: "VTBS", QFA: "YSSY YMML YBBN YPPH", ANZ: "NZAA", JAL: "RJTT RJAA", ANA: "RJTT RJAA", KAL: "RKSI", AAR: "RKSI", CCA: "ZBAA ZBAD",
  CES: "ZSPD", CSN: "ZGGG", EVA: "RCTP", CAL: "RCTP", ACA: "CYYZ CYUL CYVR", WJA: "CYYC", AAL: "KDFW KCLT KMIA KORD KJFK KLAX KPHL KPHX KDCA",
  DAL: "KATL KDTW KMSP KJFK KLAX KSEA KSLC KBOS", UAL: "KORD KEWR KIAD KDEN KIAH KSFO KLAX", JBU: "KJFK KBOS", SWA: "KMDW KDAL KLAS KBWI",
  ASA: "KSEA KPDX", AMX: "MMMX", LAN: "SCEL SPJC", TAM: "SBGR", AVA: "SKBO", CMP: "MPTO", ARG: "SAEZ SABE",
};
export const isHub = (cs, apt) => (HUBS[String(cs).slice(0, 3)] || "").split(" ").includes(apt);
// country of an airport from its ICAO code, enough to tell domestic from international flights
export const country = (icao) => {
  const c = String(icao || "");
  return /^(K|P[AFGHJOW])/.test(c) ? "US" : /^R[JO]/.test(c) ? "JP" : /^U[EHILNORSUW]/.test(c) ? "RU" : /^S[BDNSW]/.test(c) ? "BR"
    : /^V[AEIO]/.test(c) ? "IN" : /^W[AIR]/.test(c) ? "ID" : /^(C|Y|Z(?![KM]))/.test(c) ? c[0] : c.slice(0, 2);
};
export const CARGO = /^(GEC|BOX|FDX|UPS|CLX|ABW|CKS|GTI|MPH|NCA|CAO|CKK|SQC|DHK|BCS|DAE|ICL|AZG|TAY|SWN|ABR|AHK|CLU|MSX|QAC|ETC|ICV|WGN|CVK)/;
export const WIDE = /^(A306|A30B|A310|A33|A34|A35|A38|B74|B76|B77|B78|MD1|IL9|B741|B742|B743|B744|B748)/;
export const PROP = /^(AT4|AT7|DH8|SF34|JS3|B190|D328|E120|C208|PC12|L410|SB20)/;
// Per airport: ordered rules, the first that matches wins. Conditions: airlines (ICAO codes), alliance, star,
// schengen, intl (from another country), wide (wide-body). Stands: prefix (pre), number pattern (rx) or OSM terminal
// name (tn). Researched from airport / Wikipedia terminal pages (2025-2026) and matched to the stand names in OSM.
const LHG = ["DLH", "CLH", "EWG", "OCN", "DLA", "SWR", "EDW", "AUA", "BEL"]; // Lufthansa Group incl. Eurowings, Discover
const ULCC = ["EZY", "EJU", "EZS", "RYR", "RUK", "WZZ", "WMT", "TRA", "TVF"];
export const GATE_RULES = {
  // ---- Germany, Austria, Switzerland ----
  EDDF: [
    { star: true, schengen: true, pre: ["A"], term: "Terminal 1" },
    { star: true, schengen: false, pre: ["B", "C"], term: "Terminal 1" },
    { schengen: true, pre: ["D"], term: "Terminal 2" },
    { schengen: false, pre: ["E"], term: "Terminal 2" },
  ],
  EDDM: [
    { alliance: "star", tn: /2/, term: "Terminal 2" }, { airlines: LHG, tn: /2/, term: "Terminal 2" },
    { tn: /1/, term: "Terminal 1" },
  ],
  EDDL: [ // Pier A Lufthansa Group and Star, Pier B Schengen, Pier C non-Schengen (Emirates, Etihad)
    { airlines: LHG, pre: ["A"], term: "Pier A" }, { alliance: "star", pre: ["A"], term: "Pier A" },
    { schengen: false, pre: ["C"], term: "Pier C" },
    { pre: ["B"], term: "Pier B" },
  ],
  EDDH: [ // Terminal 2 Star Alliance, Terminal 1 everyone else
    { airlines: LHG, tn: /Terminal 2/, term: "Terminal 2" }, { alliance: "star", tn: /Terminal 2/, term: "Terminal 2" },
    { tn: /Terminal 1/, term: "Terminal 1" },
  ],
  EDDB: [ // Terminal 2 Ryanair and Wizz Air; Terminal 1 main pier (non-Schengen upstairs), north and south piers
    { airlines: ["RYR", "RUK", "WZZ", "WMT"], tn: /Terminal 2|Pier Nord/, term: "Terminal 2" },
    { schengen: false, pre: ["B"], term: "Terminal 1" },
    { tn: /Terminal 1|Pier Süd|Pier Nord/, term: "Terminal 1" },
  ],
  LOWW: [ // Terminal 3 pier north (F Schengen / G non-Schengen) Austrian and Star; pier west C Schengen, pier east D non-Schengen
    { airlines: LHG, pre: ["F"], term: "Terminal 3 · Pier Nord" }, { alliance: "star", pre: ["F"], term: "Terminal 3 · Pier Nord" },
    { schengen: false, pre: ["D"], term: "Pier Ost" },
    { pre: ["C"], term: "Pier West" },
  ],
  LSZH: [
    { schengen: true, pre: ["A", "B"], term: "Terminal A/B" },
    { schengen: false, pre: ["E", "D"], term: "Dock E / D" },
  ],
  // ---- Benelux, France, UK, Ireland ----
  EHAM: [
    { alliance: "lowcost", schengen: true, pre: ["M"], term: "Pier M" },
    { schengen: true, pre: ["B", "C", "D"], term: "Pier B/C/D" },
    { schengen: false, pre: ["E", "F", "G", "D"], term: "Pier E/F/G/D" },
  ],
  EBBR: [{ schengen: true, tn: /Pier A/, term: "Pier A" }, { schengen: false, tn: /Pier B/, term: "Pier B" }],
  LFPG: [
    { alliance: "skyteam", tn: /2E|2F|2G/, term: "Terminal 2E/2F/2G" },
    { alliance: "star", tn: /Satellite [T-Z]|^Terminal 1$/, term: "Terminal 1" },
    { alliance: "lowcost", tn: /2B|2D|^Terminal 3$/, term: "Terminal 2B/2D/3" },
    { tn: /2A|2C|Satellite [T-Z]|^Terminal 1$/, term: "Terminal 2A/2C/1" },
  ],
  EGLL: [
    { airlines: ["BAW", "SHT", "IBE"], pre: ["5"], term: "Terminal 5" },
    { alliance: "star", pre: ["2"], term: "Terminal 2" },
    { airlines: ["AAL", "CPA", "JAL", "QFA", "FIN", "MAS", "RJA", "ALK", "UAE", "VIR", "DAL"], pre: ["3"], term: "Terminal 3" },
    { pre: ["4"], term: "Terminal 4" },
  ],
  EIDW: [
    { airlines: ["EIN", "UAL", "DAL", "AAL", "ETD", "UAE", "QTR", "ACA"], tn: /2/, term: "Terminal 2" },
    { tn: /1/, term: "Terminal 1" },
  ],
  // ---- Nordics ----
  EKCH: [ // F (CPH Go) low-cost; E SAS long-haul; C non-Schengen; A/B Schengen only (SAS); D mostly Schengen
    { airlines: ULCC, pre: ["F"], term: "Pier F · CPH Go" },
    { airlines: ["SAS"], schengen: false, wide: true, pre: ["E2", "E3"], term: "Pier E" },
    { schengen: false, pre: ["C"], term: "Pier C" },
    { airlines: ["SAS"], pre: ["A", "B"], term: "Pier A/B" },
    { pre: ["A", "B", "D"], term: "Pier A/B/D" },
  ],
  ENGM: [ // west pier domestic 2-28; east pier Schengen 36-44 / non-Schengen 40-53; north pier domestic and Schengen 60-96
    { intl: false, rx: /^([2-9]|1\d|2[0-8])[A-Z]?$/, term: "Pier West · Inland" },
    { schengen: false, rx: /^(4\d|5[0-3])[A-Z]?$/, term: "Pier Ost" },
    { rx: /^(3[6-9]|4[0-4]|[6-9]\d)[A-Z]?$/, term: "Pier Ost/Nord" },
  ],
  EFHK: [ // gates 11-31 Schengen, 32-55 non-Schengen (not mapped in OSM yet: then the apron stands, by bus)
    { schengen: false, rx: /^(3[2-9]|4\d|5[0-5]|1[23]\d|60\d|8\d\d)[A-Z]?$/, term: "Gates 32–55" },
    { rx: /^(1[1-9]|2\d|3[01])[A-Z]?$/, term: "Gates 11–31" },
  ],
  ESSA: [ // Terminal 5 SAS, Norwegian and most others; Terminal 2 Air France, KLM, Czech, easyJet, Transavia, Vueling; Terminal 4 Ryanair, Wizz
    { airlines: ["AFR", "KLM", "CSA", "EZY", "EJU", "EZS", "TRA", "TVF", "VLG"], tn: /Terminal 2/, term: "Terminal 2" },
    { airlines: ["RYR", "RUK", "WZZ", "WMT"], tn: /Terminal 4/, term: "Terminal 4" },
    { tn: /Terminal 5/, term: "Terminal 5" },
  ],
  // ---- Southern and Eastern Europe, Turkey ----
  LEMD: [
    { alliance: "oneworld", tn: /4/, term: "Terminal 4" }, { airlines: ["IBS", "AEA", "VLG"], tn: /4/, term: "Terminal 4" },
    { tn: /[123]/, term: "Terminal 1–3" },
  ],
  LEBL: [{ airlines: ["EZY", "EJU", "EZS"], tn: /2/, term: "Terminal 2" }, { tn: /1/, term: "Terminal 1" }],
  LPPT: [{ alliance: "lowcost", tn: /2/, term: "Terminal 2" }, { tn: /1|Sul/, term: "Terminal 1" }],
  LIRF: [ // area A (terminal 1) Schengen, ITA; area E (terminal 3, pier E) non-Schengen
    { schengen: false, tn: /Boarding Area E/, term: "Terminal 3 · Area E" },
    { tn: /Boarding Area A/, term: "Terminal 1 · Area A" },
  ],
  LGAV: [{ schengen: false, pre: ["A"], term: "Halle A" }, { pre: ["B", "C"], term: "Halle B" }],
  LKPR: [ // Terminal 1 (piers A, B) non-Schengen, Terminal 2 (piers C, D) Schengen
    { schengen: false, tn: /Prst [AB]|Terminal 1/, term: "Terminal 1" },
    { tn: /Prst [CD]|Terminal 2/, term: "Terminal 2" },
  ],
  LYBE: [{ wide: true, rx: /^C(7|8|9|1[0-2])[A-Z]?$/, term: "Pier C" }], // wide-body gates with two bridges
  LTFM: [ // pier G domestic only; A, B, D, F international, wide-bodies on A, D and F
    { intl: false, pre: ["G"], term: "Pier G · Inland" },
    { wide: true, pre: ["A", "D", "F"], term: "International" },
    { pre: ["A", "B", "D", "F"], term: "International" },
  ],
  // ---- Middle East ----
  OMDB: [
    { airlines: ["UAE"], pre: ["A", "B", "C"], term: "Terminal 3" },
    { airlines: ["FDB"], tn: /المبنى ٢|Terminal 2/, term: "Terminal 2" },
    { tn: /كونكورس دي|Concourse D/, term: "Terminal 1 · Concourse D" },
  ],
  LLBG: [ // Terminal 1 domestic and low-cost, Terminal 3 everything else
    { intl: false, tn: /טרמינל 1|Terminal 1/, term: "Terminal 1" }, { alliance: "lowcost", tn: /טרמינל 1|Terminal 1/, term: "Terminal 1" },
    { tn: /Terminal [3BCDE]/, term: "Terminal 3" },
  ],
  // ---- North America ----
  KJFK: [
    { airlines: ["JBU", "EIN"], tn: /Terminal 5/, term: "Terminal 5" },
    { airlines: ["DAL", "KLM", "VIR", "AMX", "UAE", "ETD", "SIA", "AIC", "ELY", "WJA", "LAN", "TAM", "LPE"], tn: /Terminal 4/, term: "Terminal 4" },
    { airlines: ["AAL", "BAW", "IBE", "JAL", "QTR", "QFA", "CPA", "FIN", "HAL", "ASA"], tn: /Termin\w* 8/, term: "Terminal 8" },
    { alliance: "oneworld", tn: /Termin\w* 8/, term: "Terminal 8" },
    { airlines: ["AFR", "CES", "KAL", "SVA", "SAS", "RAM"], tn: /^Terminal 1$/, term: "Terminal 1" },
    { alliance: "star", tn: /^Terminal 1$/, term: "Terminal 1" },
    { alliance: "skyteam", tn: /Terminal 4/, term: "Terminal 4" },
    { tn: /^Terminal [14]$/, term: "Terminal 1/4" },
  ],
  KEWR: [
    { airlines: ["UAL"], tn: /Terminal C/, term: "Terminal C" },
    { airlines: ["ACA", "AAL", "DAL", "JBU"], tn: /Terminal A/, term: "Terminal A" },
    { tn: /Terminal B/, term: "Terminal B" },
  ],
  KBOS: [
    { airlines: ["DAL"], tn: /Terminal A/, term: "Terminal A" },
    { airlines: ["ACA", "ASA", "AAL", "SWA", "UAL"], tn: /Terminal B/, term: "Terminal B" },
    { airlines: ["EIN", "JBU", "TAP"], tn: /Terminal C/, term: "Terminal C" },
    { intl: true, tn: /Terminal E/, term: "Terminal E" },
    { tn: /Terminal [AB]/, term: "Terminal A/B" },
  ],
  KORD: [ // T1 (B, C) and T2 (E, F) United, T3 (G-L) American, T5 (M) Delta and all international arrivals
    { airlines: ["ACA", "JBU"], tn: /Concourse [EF]/, term: "Terminal 2" },
    { intl: true, tn: /Terminal 5/, term: "Terminal 5" },
    { airlines: ["UAL"], tn: /Concourse [BCEF]/, term: "Terminal 1/2" },
    { airlines: ["AAL", "ASA"], tn: /Concourse [GHKL]/, term: "Terminal 3" },
    { tn: /Terminal 5/, term: "Terminal 5" },
  ],
  KATL: [ // international E/F, Delta mainly A/B/T, other airlines C/D
    { intl: true, tn: /Concourse [EF]/, term: "Concourse E/F" },
    { airlines: ["DAL", "EDV"], tn: /Concourse [ABT]$/, term: "Concourse A/B/T" },
    { tn: /Concourse [CD]$/, term: "Concourse C/D" },
  ],
  KSFO: [
    { airlines: ["EIN"], tn: /Terminal 1|^Boarding Area C/, term: "Terminal 1" }, // US preclearance in Dublin: arrives as domestic
    { airlines: ["UAL"], intl: true, tn: /I-G|Area G/, term: "International G" },
    { airlines: ["CCA", "ANZ", "ANA", "DLH", "SWR"], tn: /I-G|Area G/, term: "International G" },
    { airlines: ["UAL"], tn: /Terminal 3/, term: "Terminal 3" },
    { airlines: ["ACA", "SWA", "WJA", "MXY"], tn: /Terminal 2/, term: "Terminal 2" },
    { intl: true, tn: /I-A|International Boarding Area A/, term: "International A" },
    { tn: /Terminal 1|^Boarding Area C/, term: "Terminal 1" },
  ],
  KLAX: [
    { airlines: ["SWA"], tn: /^Terminal 1$/, term: "Terminal 1" },
    { airlines: ["DAL", "AMX", "VIR", "WJA"], tn: /^Terminal [23]$|T3/, term: "Terminal 2/3" },
    { airlines: ["AAL"], tn: /^Terminal [45]$/, term: "Terminal 4/5" },
    { airlines: ["ASA", "ACA"], tn: /^Terminal 6$/, term: "Terminal 6" },
    { airlines: ["UAL"], tn: /^Terminal [78]$/, term: "Terminal 7/8" },
    { intl: true, tn: /Terminal B|Midfield|TBIT/, term: "Tom Bradley International" },
  ],
  CYYZ: [ // Terminal 1 Air Canada and Star Alliance (plus Emirates, Etihad, Royal Air Maroc), Terminal 3 everyone else
    { airlines: ["ACA", "JZA", "ROU", "RAM", "UAE", "ETD"], tn: /Terminal 1/, term: "Terminal 1" },
    { alliance: "star", tn: /Terminal 1/, term: "Terminal 1" },
    { tn: /Terminal 3/, term: "Terminal 3" },
  ],
  // ---- Asia, Oceania ----
  RJTT: [ // Haneda: T3 international, T1 JAL group / Skymark / StarFlyer, T2 ANA group / Air Do / Solaseed (OSM names in Japanese)
    { intl: true, tn: /第3/, term: "Terminal 3" },
    { airlines: ["JAL", "JTA", "SKY", "SFJ"], tn: /第1/, term: "Terminal 1" },
    { airlines: ["ANA", "ADO", "SNJ"], tn: /第2/, term: "Terminal 2" },
  ],
  RJAA: [ // Narita: T2 JAL and oneworld, T3 low-cost, T1 Star Alliance (ANA) and SkyTeam
    { airlines: ["JAL"], tn: /第2/, term: "Terminal 2" }, { alliance: "oneworld", tn: /第2/, term: "Terminal 2" },
    { airlines: ["JJP", "APJ", "SJO"], tn: /Terminal 3|第3/, term: "Terminal 3" },
    { tn: /第1/, term: "Terminal 1" },
  ],
  RKSI: [ // Incheon: T2 Korean Air, Asiana (since 2026), SkyTeam, Jin Air, Air Busan, Air Seoul, Virgin; T1 and its concourse the rest
    { airlines: ["KAL", "AAR", "JNA", "ABL", "ASV", "SAS", "VIR"], tn: /제2/, term: "Terminal 2" }, { alliance: "skyteam", tn: /제2/, term: "Terminal 2" },
    { tn: /제1|탑승동/, term: "Terminal 1" },
  ],
  YSSY: [ // T1 international, T3 Qantas domestic, T2 other domestic
    { intl: true, tn: /Terminal 1/, term: "Terminal 1" },
    { airlines: ["QFA", "QLK"], tn: /Terminal 3/, term: "Terminal 3" },
    { tn: /Terminal 2/, term: "Terminal 2" },
  ],
  ZBAA: [ // Beijing Capital: T3 Air China and Star, T1 Hainan, T2 others (SkyTeam)
    { airlines: ["CCA"], tn: /Terminal 3/, term: "Terminal 3" }, { alliance: "star", tn: /Terminal 3/, term: "Terminal 3" },
    { airlines: ["CHH"], tn: /Terminal 1/, term: "Terminal 1" },
    { tn: /Terminal 2/, term: "Terminal 2" },
  ],
};
const REMOTE = /^(V|W|NV|P|S|Q|BAY|TA|TB|TE|6|7)/; // apron / remote stands, used only if nothing else is free

// OpenStreetMap: stands, gates, terminal buildings and named cargo / general-aviation aprons around the airport.
// Sources in this order: 1. browser cache, 2. the "stands" branch on GitHub (prepared every hour for busy airports
// and every airport flown to on VATSIM), 3. Overpass live for airports the job has not reached yet.
// An empty list is a valid answer: OpenStreetMap has no numbered stands there.
const standsKey = (icao) => "aslpad.stands5." + icao; // 5: with stand spacing "w"
export function standsCached(icao) {
  try {
    const c = JSON.parse(localStorage.getItem(standsKey(icao)) || "null");
    if (c && Array.isArray(c.list) && Date.now() - c.t < (c.list.length ? 7 : 1) * 864e5) return c.list;
  } catch {}
  return null;
}
function standsSave(icao, list) { try { localStorage.setItem(standsKey(icao), JSON.stringify({ t: Date.now(), list })); } catch {} return list; }
export async function standsGithub(icao) {
  try { const list = await getJSON(`https://raw.githubusercontent.com/${GH}/stands/${icao}.json`, 15000); return Array.isArray(list) ? standsSave(icao, list) : null; }
  catch (e) { return null; } // not prepared yet (404) or offline
}
// the public Overpass servers are often busy: try them one after the other
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
export async function standsOverpass(icao, pos) {
  const A = `(around:4500,${pos[0]},${pos[1]})`;
  const q = `[out:json][timeout:25];(node${A}["aeroway"~"^(parking_position|gate)$"];way${A}["aeroway"="parking_position"];);out tags center;`
    + `(way${A}["aeroway"="terminal"];relation${A}["aeroway"="terminal"];);out tags center;`
    + `way${A}["aeroway"="apron"]["name"~"cargo|fracht|fret|frêt|carga|general aviation|^GA|GAT|business|executive",i];out tags geom;`;
  for (const url of OVERPASS) {
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 35000);
    try {
      const r = await fetch(url, { method: "POST", body: new URLSearchParams({ data: q }), signal: ac.signal });
      if (!r.ok) continue;
      const d = await r.json();
      // a busy server can answer 200 with a "runtime error" remark and only part of the data: never keep that
      if (Array.isArray(d?.elements) && !/error|timed out|out of memory/i.test(d.remark || "")) return standsSave(icao, buildStands(d.elements));
    } catch (e) {} finally { clearTimeout(tm); }
  }
  throw new Error("overpass busy");
}

// OSM elements -> stands; same as build() in .github/scripts/stands.py, keep both in step
const GA_RE = /business|general aviation|executive|GAT|FBO|privat/i, CARGO_RE = /cargo|fracht|fret|frêt|carga/i;
function termName(t) {
  const name = t.name || "", ref = /^T?[0-9A-Z]{1,2}$/.test(t.ref || "") ? t.ref : ""; // "118" at Vienna is a building number
  if (ref && !CARGO_RE.test(name) && !GA_RE.test(name)) return "Terminal " + ref.replace(/^T(?=\w)/, "");
  const m = name.match(/Terminal\s*([0-9A-Z]{1,3})\b/);
  return m ? "Terminal " + m[1] : name || (ref ? "Terminal " + ref : "");
}
export function buildStands(el) {
  const pos = (e) => [e.lat ?? e.center?.lat, e.lon ?? e.center?.lon];
  const gateNodes = el.filter((e) => e.tags?.aeroway === "gate" && pos(e)[0] != null).map((e) => ({ r: (e.tags.ref || "").split(/[\s/]/)[0], p: pos(e) }));
  const gateRefs = new Set(gateNodes.map((g) => g.r).filter(Boolean));
  const terms = el.filter((e) => e.tags?.aeroway === "terminal" && (e.tags.name || e.tags.ref) && e.center)
    .map((e) => ({ n: termName(e.tags), p: [e.center.lat, e.center.lon], cargo: CARGO_RE.test(e.tags.name || ""), ga: GA_RE.test(e.tags.name || "") }));
  const aprons = el.filter((e) => e.tags?.aeroway === "apron" && e.geometry)
    .map((e) => ({ cargo: CARGO_RE.test(e.tags.name), ring: e.geometry.map((g) => [g.lon, g.lat]) }));
  const list = el.filter((e) => e.tags?.aeroway === "parking_position" && e.tags.ref).map((e) => {
    const ref = e.tags.ref.split(/[\s/;]/)[0];
    const [lat, lon] = pos(e);
    if (lat == null) return null;
    let near = null, bd = 1.5;
    for (const x of terms) { const dd = distKm([lat, lon], x.p); if (dd < bd) { bd = dd; near = x; } }
    const ap = aprons.find((a) => inRing([lat, lon], a.ring));
    const cargo = !!ap?.cargo || !!near?.cargo, ga = (!!ap && !ap.cargo) || !!near?.ga;
    const c = gateRefs.has(ref) || gateNodes.some((g) => distKm([lat, lon], g.p) < 0.12);
    return { ref, lat, lon, gate: gateRefs.has(ref), c, t: cargo || ga ? "" : near?.n || "", cargo, ga };
  }).filter(Boolean);
  // w: metres to the nearest other stand. Stands sit about one wingspan plus clearance apart: ~40-45 m for an A320,
  // ~70 m for a 777, ~85 m for an A380. Positions closer than 25 m are alternatives on the same spot (12L / 12R / 12,
  // or E71 / E72 / E73: one wide-body or two narrow-body stands), not neighbours, and are left out.
  const base = (r) => r.replace(/(\d)[A-Z]+$/, "$1");
  for (const s of list) {
    let m = Infinity;
    for (const o of list) if (base(o.ref) !== base(s.ref)) { const d = distKm([s.lat, s.lon], [o.lat, o.lon]); if (d >= 0.025) m = Math.min(m, d); }
    if (m < Infinity) s.w = Math.round(m * 1000);
  }
  return list;
}

// stands: list for arrI; pilots: VATSIM pilots (stands with an aircraft on the ground count as taken)
export function predictStand(stands, arrI, depI, cs, type, pilots = []) {
  if (!stands || !stands.length) return null;
  const schengenFlight = SCHENGEN.test(arrI) ? SCHENGEN.test(depI || "") : null;
  const al = allianceOf(cs), code = String(cs).slice(0, 3);
  const kind = CARGO.test(cs) ? "cargo" : /^[A-Z]{3}\d/.test(cs) ? "pax" : "ga";
  const taken = (pilots || []).filter((p) => p.groundspeed < 5 && p.callsign !== cs).map((p) => [p.latitude, p.longitude]);
  const free = (s) => !taken.some((t) => distKm(t, [s.lat, s.lon]) < 0.06);
  const sorted = [...stands].sort((a, b) => a.ref.localeCompare(b.ref, "en", { numeric: true }));
  // remote = no passenger gate at or next to the stand; the letter list only applies at airports with curated rules
  const anyContact = sorted.some((x) => x.c);
  const isRemote = (s) => (GATE_RULES[arrI] && REMOTE.test(s.ref)) || (!s.c && anyContact);
  const steps = []; // candidate pools, best first: [label, stands]

  if (kind === "cargo") steps.push(["Cargo", sorted.filter((s) => s.cargo)], ["Cargo", sorted.filter(isRemote)]);
  if (kind === "ga") steps.push(["General Aviation", sorted.filter((s) => s.ga)], ["General Aviation", sorted.filter((s) => isRemote(s) && !s.cargo)]);
  const pax = sorted.filter((s) => !s.cargo && !s.ga);
  // curated airport rules: conditions airlines / alliance / star / schengen / intl (other country) / wide (wide-body);
  // stands by prefix (pre), by number pattern (rx) or by OSM terminal name (tn)
  const wideBody = WIDE.test(type || ""), intlFlight = country(depI) !== country(arrI);
  const rule = kind === "pax" && (GATE_RULES[arrI] || []).find((r) =>
    (r.airlines ? r.airlines.includes(code) : true) && (r.alliance ? r.alliance === al : true) &&
    (r.star !== undefined ? (al === "star") === r.star : true) && (r.schengen !== undefined ? r.schengen === schengenFlight : true) &&
    (r.intl !== undefined ? r.intl === intlFlight : true) && (r.wide !== undefined ? r.wide === wideBody : true));
  if (rule) {
    // gates with a bridge first, like the airport; stands a rule names for wide-bodies need no size check
    const inRule = pax.filter((s) => rule.pre ? rule.pre.some((p) => s.ref.startsWith(p)) : rule.rx ? rule.rx.test(s.ref) : rule.tn.test(s.t));
    steps.push([rule.term, inRule.filter((s) => !isRemote(s)), rule.wide === true], [rule.term, inRule, rule.wide === true]);
  } else if (kind === "pax") {
    // terminals as mapped in OSM; the one with most gates is the main terminal
    const count = {}; for (const s of pax) if (s.t && s.c) count[s.t] = (count[s.t] || 0) + 1;
    const tlist = Object.keys(count).sort((a, b) => count[b] - count[a]);
    const main = tlist[0] || "";
    const contact = pax.filter((s) => !isRemote(s)), remote = pax.filter(isRemote);
    const wide = WIDE.test(type || ""), small = PROP.test(type || ""), lowcost = al === "lowcost";
    if (isHub(cs, arrI)) steps.push([main, contact.filter((s) => !main || s.t === main)]);
    else if ((lowcost || small) && !wide) steps.push(["", remote]);
    else if (tlist.length > 1) steps.push(["", contact.filter((s) => s.t !== main)]);
    steps.push(["", contact]);
  }
  steps.push(["", pax.filter((s) => !isRemote(s))], ["", pax], ["", sorted]);

  // stand size from the spacing to the next stand (w): an A380 needs ~70 m+, a 777/A330 ~55 m+, an A320 ~30 m+.
  // Smaller aircraft prefer stands that are not much bigger than needed, like airports keep big stands for big aircraft.
  const t = type || "", need = kind === "ga" || PROP.test(t) ? 0 : /^(A38|B748|B74)/.test(t) ? 70 : WIDE.test(t) ? 55 : 30;
  const roomy = need >= 70 ? Infinity : need >= 55 ? 80 : 60;
  const sized = (c) => { const fit = c.filter((s) => s.w == null || s.w >= need); const snug = fit.filter((s) => s.w == null || s.w < roomy); return snug.length ? snug : fit; };
  let pool = [], label = "";
  for (const [l, cand, sure] of steps) { pool = sure ? cand.filter(free) : sized(cand.filter(free)); if (pool.length) { label = l; break; } }
  // the spacing comes from the map and can be off: if nothing fits anywhere, size is only a preference
  if (!pool.length) for (const [l, cand] of steps) { pool = cand.filter(free); if (pool.length) { label = l; break; } }
  if (!pool.length) return null;
  let h = 0; for (const ch of cs + arrI) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const s = pool[h % pool.length];
  return { ref: s.ref, gate: s.gate, term: label || s.t || "", schengen: kind === "pax" ? schengenFlight : null, remote: isRemote(s) && kind === "pax", pos: [s.lat, s.lon] };
}
