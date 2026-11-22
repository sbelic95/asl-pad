// "What's new": release notes, newest first. Shown once in the pad after an update (main.js) and used for the
// update graphic for Discord (tools/whatsnew-card.html → node tools/whatsnew-card.mjs).
// New release: add an entry at the top, write the texts in English inside t() and add SR and DE in i18n-dict.js.
// Only list what the pad really does.
import { t, LOCALE } from "./i18n.js";
import { esc } from "./util.js";
import { APP_ICONS } from "./icons.js";

export const releases = () => [
  { v: "2.1.0", date: "2026-11-22", groups: [
    { icon: "pad", name: "ASL Pad", items: [
      t("On a computer the pad now lies as a tablet on a desk: frame, lock button on the top edge, brightness buttons on the side and your crew card next to it"),
      t("Status bar with network and battery, like on a real tablet"),
      t("Settings → Device frame: Auto, On or Off. On tablets, phones and as an installed app the pad stays full screen"),
    ] },
  ] },
  { v: "2.0.2", date: "2026-11-21", groups: [
    { icon: "fly", name: "ASL Fly", items: [
      t("VDGS: TOBT, TSAT, TTOT, CTOT and taxi time from VATSIM (vIFF CDM) wherever VATSIM has them, as at Frankfurt and Heathrow – everything else from SimBrief"),
      t("Frankfurt: the VDGS reminds you to set a TOBT and opens the VATSIM VDGS to set it"),
    ] },
  ] },
  { v: "2.0.1", date: "2026-11-21", groups: [
    { icon: "fly", name: "ASL Fly", items: [
      t("New VDGS tab: your stand, the slot from vIFF CDM with a countdown to the start-up window, runway, SID and which frequency to call now and next"),
      t("The overview shows the slot in one line"),
    ] },
    { icon: "pad", name: "ASL Pad", items: [
      t("Maps work again: OpenStreetMap instead of the map provider that now asks for a key"),
      t("Weather: the TAFs of all Air Serbia destinations"),
    ] },
  ] },
  { v: "2.0", date: "2026-11-20", groups: [
    { icon: "pad", name: "ASL Pad", items: [
      t("Home screen with three pages – Operations, Network & weather, Tools & device – plus weather and calendar widgets"),
      t("App Store: install and remove apps; Control Center and Notification Center from the top edge"),
      t("PIN with the digits of your vAMSYS pilot ID, and Face ID before ASL Ops and Manuals"),
    ] },
    { icon: "ops", name: "ASL Ops", items: [
      t("Roster from your vAMSYS bookings with report time, turnarounds, duty time and check-in"),
      t("Crew Desk: inbox, preflight list, weather and the NOTAMs from your OFP; flight report with the actual times"),
    ] },
    { icon: "fly", name: "ASL Fly", items: [
      t("Runways: head, tail and cross wind for every runway from the live METAR"),
      t("Logbook: every new flight with its altitude profile"),
    ] },
    { icon: "radar", name: t("New apps"), items: [
      t("VATSIM Radar and IVAO Radar, Weather for every Air Serbia destination, Calendar, Clock, Calculator, Kneeboard and Manuals"),
    ] },
  ] },
  { v: "1.8", date: "2026-11-20", groups: [
    { icon: "fly", name: "ASL Fly", items: [
      t("Radio & ACARS: the frequency now and the next one with the time to the change, all the way to the stand"),
      t("ACARS and CPDLC over Hoppie: request a PDC, METAR, TAF and ATIS, send telex, log on to CPDLC and answer WILCO or UNABLE"),
      t("Slot status from vIFF CDM with the start-up window, and reminders for frequency changes and new messages"),
    ] },
    { icon: "cabin", name: "Cabin", items: [
      t("New app for the passengers: flight map, destination with local time and weather, connecting flights and arrivals"),
    ] },
    { icon: "pad", name: "ASL Pad", items: [
      t("Sign in with vAMSYS: your name, rank, hours and your booking come into the pad"),
      t("The old VDGS app is gone – everything from it now lives in ASL Fly and Cabin"),
    ] },
  ] },
  { v: "1.7.2", date: "2026-11-17", groups: [
    { icon: "fly", name: "ASL Fly", items: [
      t("Flight map: countries, coasts and borders from Natural Earth even when the map tiles do not load"),
    ] },
  ] },
  { v: "1.7.1", date: "2026-11-15", groups: [
    { icon: "ops", name: "ASL Ops", items: [
      t("Suggestions and bookings only on the Air Serbia network – with the new routes of 2026, seasonal routes in their season and the flights from Niš"),
    ] },
  ] },
  { v: "1.7", date: "2026-11-15", groups: [
    { icon: "pad", name: "ASL Pad", items: [
      t("Suggested for you: a flight from our route network – new routes, events at the destination, your most flown type"),
      t("A free callsign on VATSIM and when you are back in Belgrade"),
      t("Sort the cards of the home screen, not only hide them"),
    ] },
    { icon: "ops", name: "ASL Ops", items: [
      t("Book a flight in four steps: flight, aircraft and time, SimBrief plan, prefile on VATSIM"),
      t("Plan card: weather at both ends, stands, fuel from taxi to extra, ZFW, TOW and LDW"),
      t("Change the block fuel with + and − and see the minutes you land with"),
    ] },
  ] },
  { v: "1.6.2", date: "2026-11-11", groups: [
    { icon: "airport", name: "Airport", items: [
      t("Ground map: each stand once, names when you zoom in, your stand highlighted"),
      t("On small screens the route panel folds away with one tap"),
    ] },
  ] },
  { v: "1.6.1", date: "2026-11-11", groups: [
    { icon: "airport", name: "Airport", items: [
      t("LYBE: docking guidance system per stand, RNAV arrivals, transponder and TCAS, lost communication after departure and in a missed approach"),
      t("LYBE: early morning full-length rule for TISAK 4Z and landing distance beyond the glide slope"),
    ] },
  ] },
  { v: "1.6", date: "2026-11-11", groups: [
    { icon: "fly", name: "ASL Fly", items: [
      t("Map: measure distance and course between two points"),
      t("Map: range rings of 25, 50, 100 and 200 NM around your aircraft"),
      t("Direct to any fix ahead: course, distance, time and how much shorter"),
      t("SIGMETs on the map, and those on your route in the weather"),
      t("Cold temperature correction of altitudes at 0 °C and below (ICAO)"),
    ] },
    { icon: "airport", name: "Airport", items: [
      t("LYBE briefing from the official AIP: noise abatement, rapid exits, de-icing, VFR and all frequencies"),
    ] },
  ] },
  { v: "1.5", date: "2026-11-11", groups: [
    { icon: "airport", name: "Airport", items: [
      t("New app: ground map of Belgrade, Niš and Kraljevo with runways, taxiway names, stands and holding positions"),
      t("Taxi route from your stand to the runway, or from your exit to the stand, with the points to hold short"),
      t("Other aircraft on the ground from VATSIM – ours in red"),
      t("LYBE briefing: frequencies, runways, intersection take-offs, exits, low visibility, taxiing, parking, hot spots, lost communication"),
      t("Stands with maximum wingspan, docking guidance, and whether your aircraft fits and the stand is free"),
    ] },
    { icon: "pad", name: "ASL Pad", items: [
      t("Countdown to your TOBT as soon as vIFF CDM has one"),
    ] },
  ] },
  { v: "1.4", date: "2026-11-11", groups: [
    { icon: "pad", name: "ASL Pad", items: [
      t("Career: your rank and progress to the next one, with a letter when you are promoted"),
      t("Crew info: tips that match the phase of your flight"),
      t("Choose which cards the home screen shows"),
      t("Wallpaper “Sky where you are”: follows the time of day and the weather"),
      t("Your stand next to the departure countdown"),
    ] },
    { icon: "downloads", name: "Downloads", items: [
      t("New app: ACARS, Crew Lounge, liveries, SimBrief and VATSIM in one place"),
      t("Every update of the pad, with all changes"),
      t("The airline keeps the links up to date itself"),
    ] },
    { icon: "log", name: "Logbook", items: [
      t("Your career with block time and flights"),
    ] },
  ] },
  { v: "1.3", date: "2026-11-11", groups: [
    { icon: "pad", name: "ASL Pad", items: [
      t("Notices from the Air Serbia Virtual staff on the home screen"),
      t("Tip of the day for the crew"),
      t("Coming VATSIM events – ours in Serbia and on your route first"),
      t("Weather where you are: at departure until take-off, then at destination"),
      t("Countdown to your departure"),
    ] },
    { icon: "log", name: "Logbook", items: [
      t("Your flying: the last twelve months at a glance"),
      t("Block time and flights for every month"),
    ] },
  ] },
  { v: "1.2", date: "2026-11-11", groups: [
    { icon: "pad", name: "ASL Pad", items: [
      t("Lock screen with your flight live: route, next fix, flight level, fuel and miles to go"),
      t("Your own wallpaper: six skies or a photo from your iPad"),
      t("The app logo at the top left takes you back home"),
      t("In Serbian, English and German"),
      t("Updates are there the moment you open the pad"),
    ] },
    { icon: "fly", name: "ASL Fly", items: [
      t("Overview with weather, runway, phase, next fix and ETA"),
      t("Flight plan with ETA and ATA for every fix"),
      t("METAR, TAF and ATIS for all airports of your flight"),
      t("Fuel checks against the plan, about every hour"),
      t("V-speeds and landing distances from the SimBrief runway analysis"),
    ] },
    { icon: "ops", name: "ASL Ops", items: [
      t("Duty strip with report time, STD, STA and block time"),
      t("vIFF CDM: TOBT, TSAT, TTOT and CTOT"),
      t("Stand forecast for departure and arrival"),
      t("Frequencies of the controllers online"),
      t("Fleet: SimBrief airframes YU-APA to YU-APE and your own aircraft"),
    ] },
    { icon: "log", name: "Logbook", items: [
      t("Every flight is logged by itself at on-block"),
      t("Statistics and a route map for every flight"),
      t("Add flights by hand"),
      t("CSV export, backup and import"),
    ] },
  ] },
];
export const latest = () => releases()[0];
// texts of the update graphic
export const cardTexts = () => ({ title: t("What's new"), live: t("All live now."), open: t("Open the pad on your iPad and fly."), sub: t("Crew pad for Air Serbia Virtual") });

export function relDate(r) {
  try { return new Intl.DateTimeFormat(LOCALE(), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(r.date)); } catch { return r.date; }
}
export const groupIcon = (g, base = "") => g.icon === "pad" ? `<img src="${base}icons/icon.svg" alt="">` : APP_ICONS[g.icon] || "";

// the cards of one release (used in the pad and in the graphic)
export function groupsHtml(r, base = "") {
  return r.groups.map((g) => `<div class="wn-card"><div class="wn-h"><span class="wn-ic">${groupIcon(g, base)}</span><b>${esc(t(g.name))}</b></div>
    <ul>${g.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("");
}
