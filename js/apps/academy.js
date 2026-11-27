// Academy: short courses with questions for the quiet part of a flight – general aviation knowledge in own words,
// online flying, and a Serbian word course for the crew. Progress stays on this device (asl.academy).
// Not the official training of the VA: the airline's own courses would come from the VA staff.
import { t, loc } from "../i18n.js";
import { esc, store } from "../util.js";

export const name = "Academy";
export const tabs = [["courses", "Courses"], ["badges", "Progress"]];
const q = (en, sr, de, a, ok, why) => ({ q: { en, sr, de }, a, ok, why });
const o = (en, sr, de) => ({ en, sr, de });

export const COURSES = [
  { id: "basics", title: o("Fundamentals", "Osnove", "Grundlagen"), text: o("Altimetry, weather and navigation – the groundwork for every type.", "Visinomer, vreme i navigacija – osnova za svaki tip.", "Höhenmesser, Wetter und Navigation – die Grundlage für jedes Muster."), qs: [
    q("Which altimeter setting do you use above the transition altitude?", "Koje podešavanje visinomera koristiš iznad prelazne visine?", "Welche Höhenmessereinstellung gilt oberhalb der Übergangshöhe?",
      [o("QNH", "QNH", "QNH"), o("Standard 1013 hPa", "Standard 1013 hPa", "Standard 1013 hPa"), o("QFE", "QFE", "QFE")], 1,
      o("Above the transition altitude everyone flies on 1013.25 hPa and reports flight levels.", "Iznad prelazne visine svi lete na 1013,25 hPa i javljaju nivoe leta.", "Oberhalb der Übergangshöhe fliegen alle mit 1013,25 hPa und melden Flugflächen.")),
    q("What does BKN mean in a METAR?", "Šta znači BKN u METAR-u?", "Was bedeutet BKN in einem METAR?",
      [o("1–2 oktas", "1–2 osmine", "1–2 Achtel"), o("5–7 oktas", "5–7 osmina", "5–7 Achtel"), o("8 oktas", "8 osmina", "8 Achtel")], 1,
      o("FEW 1–2, SCT 3–4, BKN 5–7, OVC 8 oktas. BKN or OVC is the ceiling.", "FEW 1–2, SCT 3–4, BKN 5–7, OVC 8 osmina. BKN ili OVC je plafon.", "FEW 1–2, SCT 3–4, BKN 5–7, OVC 8 Achtel. BKN oder OVC ist die Hauptwolkenuntergrenze.")),
    q("Flying from high to low pressure without changing QNH, the aircraft is …", "Ako letiš iz visokog u nizak pritisak bez promene QNH, avion je …", "Fliegt man ohne QNH-Änderung vom Hoch ins Tief, ist das Flugzeug …",
      [o("higher than indicated", "više nego što pokazuje", "höher als angezeigt"), o("lower than indicated", "niže nego što pokazuje", "tiefer als angezeigt"), o("exactly as indicated", "tačno kako pokazuje", "genau wie angezeigt")], 1,
      o("“From high to low, look out below”: the true altitude drops.", "„Iz visokog u nisko – pazi dole“: stvarna visina opada.", "„Vom Hoch ins Tief geht's schief“: die wahre Höhe sinkt.")),
    q("What is the ICAO standard temperature at sea level?", "Kolika je ICAO standardna temperatura na nivou mora?", "Wie hoch ist die ICAO-Standardtemperatur auf Meereshöhe?",
      [o("0 °C", "0 °C", "0 °C"), o("15 °C", "15 °C", "15 °C"), o("20 °C", "20 °C", "20 °C")], 1,
      o("ISA: 15 °C and 1013.25 hPa at sea level, minus about 2 °C per 1000 ft.", "ISA: 15 °C i 1013,25 hPa na nivou mora, oko 2 °C manje na svakih 1000 ft.", "ISA: 15 °C und 1013,25 hPa auf Meereshöhe, etwa 2 °C weniger je 1000 ft.")),
    q("A runway 12 is oriented roughly …", "Pista 12 je okrenuta otprilike …", "Eine Piste 12 zeigt ungefähr …",
      [o("120° magnetic", "120° magnetno", "120° missweisend"), o("012° true", "012° pravo", "012° rechtweisend"), o("1200 m long", "1200 m dužine", "1200 m Länge")], 0,
      o("The number is the magnetic heading divided by ten, rounded.", "Broj je magnetni kurs podeljen sa deset, zaokružen.", "Die Zahl ist der missweisende Kurs durch zehn, gerundet.")),
    q("Which squawk means radio failure?", "Koji squawk znači otkaz radio veze?", "Welcher Squawk bedeutet Funkausfall?",
      [o("7500", "7500", "7500"), o("7600", "7600", "7600"), o("7700", "7700", "7700")], 1,
      o("7500 unlawful interference, 7600 radio failure, 7700 emergency.", "7500 nezakonito ometanje, 7600 otkaz radio veze, 7700 opasnost.", "7500 widerrechtlicher Eingriff, 7600 Funkausfall, 7700 Notfall.")),
  ] },
  { id: "online", title: o("Online operations", "Onlajn letenje", "Online-Betrieb"), text: o("Your first flights on VATSIM: ATIS, clearance, frequencies.", "Prvi letovi na VATSIM-u: ATIS, odobrenje, frekvencije.", "Deine ersten Flüge auf VATSIM: ATIS, Freigabe, Frequenzen."), qs: [
    q("What do you do before your first call on the frequency?", "Šta radiš pre prvog poziva na frekvenciji?", "Was tust du vor dem ersten Funkspruch?",
      [o("Listen to the ATIS", "Slušam ATIS", "ATIS hören"), o("Squawk 7700", "Postavim 7700", "7700 rasten"), o("Start the engines", "Pokrenem motore", "Triebwerke starten")], 0,
      o("The ATIS gives runway, weather and the information letter you report on first contact.", "ATIS daje pistu, vreme i slovo informacije koje javljaš u prvom kontaktu.", "Die ATIS nennt Piste, Wetter und den Buchstaben, den du beim Erstkontakt meldest.")),
    q("Who do you call first at a big airport, before pushback?", "Koga prvo zoveš na velikom aerodromu, pre guranja?", "Wen rufst du an einem großen Flughafen zuerst, vor dem Pushback?",
      [o("Tower", "Toranj", "Tower"), o("Delivery", "Delivery", "Delivery"), o("Approach", "Prilaz", "Approach")], 1,
      o("Delivery gives the route clearance; then Ground for pushback and taxi, then Tower.", "Delivery daje odobrenje rute; zatim Ground za guranje i taksiranje, pa Toranj.", "Delivery gibt die Streckenfreigabe; dann Ground für Pushback und Rollen, dann Tower.")),
    q("Nobody is online at your airport. Who do you call?", "Niko nije onlajn na tvom aerodromu. Koga zoveš?", "An deinem Flughafen ist niemand online. Wen rufst du?",
      [o("The next higher station, e.g. the area control", "Sledeću višu stanicu, npr. oblasnu kontrolu", "Die nächsthöhere Station, z. B. die Bezirkskontrolle"), o("Nobody, just fly", "Nikoga, samo letim", "Niemanden, einfach fliegen"), o("Any station worldwide", "Bilo koju stanicu na svetu", "Irgendeine Station weltweit")], 0,
      o("Top-down: a higher station covers the positions below it. If none is online, use UNICOM 122.800.", "Odozgo nadole: viša stanica pokriva pozicije ispod. Ako nema nikoga, UNICOM 122.800.", "Top-down: eine höhere Station deckt die Positionen darunter ab. Ist keiner online, UNICOM 122.800.")),
    q("What is a TSAT?", "Šta je TSAT?", "Was ist eine TSAT?",
      [o("Target start-up approval time", "Ciljno vreme odobrenja pokretanja", "Zielzeit für die Anlassfreigabe"), o("Take-off time", "Vreme poletanja", "Startzeit"), o("Taxi speed", "Brzina taksiranja", "Rollgeschwindigkeit")], 0,
      o("With CDM you request start-up within a few minutes around your TSAT.", "Uz CDM tražiš pokretanje u nekoliko minuta oko svog TSAT-a.", "Mit CDM fragst du das Anlassen innerhalb weniger Minuten um deine TSAT an.")),
    q("How do you read back a squawk code?", "Kako ponavljaš squawk kod?", "Wie liest du einen Squawk zurück?",
      [o("Digit by digit", "Cifru po cifru", "Ziffer für Ziffer"), o("As one number", "Kao jedan broj", "Als eine Zahl"), o("Not at all", "Nikako", "Gar nicht")], 0,
      o("“Squawk four five two one, ASL500” – each digit on its own.", "„Squawk četiri pet dva jedan, ASL500“ – svaka cifra posebno.", "„Squawk four five two one, ASL500“ – jede Ziffer einzeln.")),
  ] },
  { id: "planning", title: o("Flight planning", "Planiranje leta", "Flugplanung"), text: o("Reading the OFP: fuel, weights and the route string.", "Čitanje OFP-a: gorivo, težine i ruta.", "Den OFP lesen: Sprit, Gewichte und die Route."), qs: [
    q("What is the trip fuel?", "Šta je trip gorivo?", "Was ist der Trip Fuel?",
      [o("Fuel from take-off to landing", "Gorivo od poletanja do sletanja", "Sprit vom Start bis zur Landung"), o("Fuel for taxi", "Gorivo za taksiranje", "Sprit zum Rollen"), o("All fuel on board", "Sve gorivo u avionu", "Der gesamte Sprit an Bord")], 0,
      o("Block fuel = taxi + trip + contingency + alternate + final reserve + extra.", "Blok gorivo = taksi + trip + rezerva za nepredviđeno + alternativa + konačna rezerva + dodatno.", "Block Fuel = Taxi + Trip + Contingency + Alternate + Final Reserve + Extra.")),
    q("What does ZFW stand for?", "Šta znači ZFW?", "Wofür steht ZFW?",
      [o("Zero fuel weight", "Težina bez goriva", "Gewicht ohne Treibstoff"), o("Zone flight weather", "Vreme u zoni leta", "Zonenflugwetter"), o("Zulu flight window", "Zulu prozor leta", "Zulu-Flugfenster")], 0,
      o("The weight of the aircraft with load but without usable fuel.", "Težina aviona sa teretom ali bez upotrebljivog goriva.", "Das Gewicht des beladenen Flugzeugs ohne ausfliegbaren Treibstoff.")),
    q("Why do you plan an alternate?", "Zašto planiraš alternativni aerodrom?", "Warum plant man einen Ausweichflughafen?",
      [o("In case you cannot land at the destination", "Ako ne možeš da sletiš na odredište", "Falls man am Ziel nicht landen kann"), o("For a cheaper route", "Za jeftiniju rutu", "Für eine billigere Route"), o("To fly faster", "Da letiš brže", "Um schneller zu fliegen")], 0,
      o("Weather, a closed runway or traffic can force a diversion – the fuel for it is planned.", "Vreme, zatvorena pista ili saobraćaj mogu da nateraju na skretanje – gorivo za to je planirano.", "Wetter, eine gesperrte Piste oder Verkehr können eine Umleitung erzwingen – der Sprit dafür ist eingeplant.")),
    q("In a route string, what is DCT?", "Šta je DCT u ruti?", "Was bedeutet DCT in einer Route?",
      [o("Direct to the next point", "Direktno do sledeće tačke", "Direkt zum nächsten Punkt"), o("Departure clearance", "Odobrenje za odlazak", "Abflugfreigabe"), o("Descent", "Spuštanje", "Sinkflug")], 0,
      o("DCT links two points without an airway.", "DCT spaja dve tačke bez vazdušnog puta.", "DCT verbindet zwei Punkte ohne Luftstraße.")),
    q("The final reserve of a jet is usually fuel for …", "Konačna rezerva mlaznog aviona je obično gorivo za …", "Die Final Reserve eines Jets reicht meist für …",
      [o("30 minutes holding", "30 minuta čekanja", "30 Minuten Warteschleife"), o("5 minutes", "5 minuta", "5 Minuten"), o("2 hours", "2 sata", "2 Stunden")], 0,
      o("30 minutes holding at 1500 ft above the alternate.", "30 minuta čekanja na 1500 ft iznad alternativnog aerodroma.", "30 Minuten Warten in 1500 ft über dem Ausweichflughafen.")),
  ] },
  { id: "charts", title: o("Chart reading", "Čitanje karata", "Karten lesen"), text: o("SID, STAR and approach – which chart answers which question.", "SID, STAR i prilaz – koja karta odgovara na koje pitanje.", "SID, STAR und Anflug – welche Karte welche Frage beantwortet."), qs: [
    q("What is a SID?", "Šta je SID?", "Was ist eine SID?",
      [o("A standard departure route", "Standardna odlazna ruta", "Eine Standardabflugstrecke"), o("A standard arrival", "Standardni dolazak", "Ein Standardanflug"), o("A taxi route", "Ruta taksiranja", "Ein Rollweg")], 0,
      o("SID = Standard Instrument Departure, STAR = Standard Arrival Route.", "SID = standardni instrumentalni odlazak, STAR = standardna dolazna ruta.", "SID = Standard Instrument Departure, STAR = Standard Arrival Route.")),
    q("On an ILS chart, what is the DA?", "Šta je DA na ILS karti?", "Was ist die DA auf einer ILS-Karte?",
      [o("The altitude to decide: land or go around", "Visina odluke: sletanje ili produženje", "Die Höhe der Entscheidung: landen oder durchstarten"), o("The departure altitude", "Visina odlaska", "Die Abflughöhe"), o("The airport elevation", "Nadmorska visina aerodroma", "Die Flughafenhöhe")], 0,
      o("Without the required visual reference at the DA you go around.", "Bez potrebne vizuelne reference na DA, produžavaš.", "Ohne die nötige Sicht an der DA wird durchgestartet.")),
    q("What does the MSA on an approach chart give you?", "Šta ti daje MSA na karti prilaza?", "Was zeigt die MSA auf einer Anflugkarte?",
      [o("A safe altitude within 25 NM", "Sigurnu visinu u krugu od 25 NM", "Eine sichere Höhe im Umkreis von 25 NM"), o("The maximum speed", "Najveću brzinu", "Die Höchstgeschwindigkeit"), o("The missed approach", "Produženi prilaz", "Den Fehlanflug")], 0,
      o("Minimum sector altitude: at least 1000 ft above obstacles within 25 NM.", "Minimalna visina sektora: najmanje 1000 ft iznad prepreka u krugu od 25 NM.", "Mindestsektorhöhe: mindestens 1000 ft über Hindernissen im Umkreis von 25 NM.")),
    q("A speed restriction “MAX 210” at a waypoint means …", "Ograničenje „MAX 210“ na tački znači …", "Eine Beschränkung „MAX 210“ an einem Wegpunkt heißt …",
      [o("not faster than 210 kt IAS", "ne brže od 210 kt IAS", "nicht schneller als 210 kt IAS"), o("exactly 210 kt", "tačno 210 kt", "genau 210 kt"), o("at least 210 kt", "najmanje 210 kt", "mindestens 210 kt")], 0,
      o("MAX is an upper limit for the indicated airspeed.", "MAX je gornja granica za indiciranu brzinu.", "MAX ist eine Obergrenze für die angezeigte Fahrt.")),
  ] },
  { id: "srpski", title: o("Serbian for the crew", "Srpski za posadu", "Serbisch für die Crew"), lang: true, text: o("The words you hear on board an Air Serbia flight.", "Reči koje čuješ u avionu Air Serbia.", "Die Wörter, die man an Bord eines Air-Serbia-Flugs hört."), qs: [
    q("“Dobar dan” means …", "„Dobar dan“ znači …", "„Dobar dan“ heißt …", [o("Good day", "Dobar dan", "Guten Tag"), o("Good night", "Laku noć", "Gute Nacht"), o("Thank you", "Hvala", "Danke")], 0, o("Dobar dan – the everyday greeting.", "Dobar dan – svakodnevni pozdrav.", "Dobar dan – der Gruß für den Tag.")),
    q("“Hvala” means …", "„Hvala“ znači …", "„Hvala“ heißt …", [o("Please", "Molim", "Bitte"), o("Thank you", "Hvala", "Danke"), o("Sorry", "Izvinite", "Entschuldigung")], 1, o("Hvala – thank you. Hvala lepo – thank you very much.", "Hvala – hvala. Hvala lepo – puno hvala.", "Hvala – danke. Hvala lepo – vielen Dank.")),
    q("“Vežite pojaseve” is the request to …", "„Vežite pojaseve“ je molba da …", "„Vežite pojaseve“ ist die Bitte, …",
      [o("fasten your seat belts", "vežete pojaseve", "sich anzuschnallen"), o("switch off phones", "isključite telefone", "Handys auszuschalten"), o("open the window blind", "otvorite roletnu", "die Blende zu öffnen")], 0, o("Pojas = seat belt.", "Pojas = sigurnosni pojas.", "Pojas = Sicherheitsgurt.")),
    q("“Sletanje” is …", "„Sletanje“ je …", "„Sletanje“ ist …", [o("the landing", "sletanje", "die Landung"), o("the take-off", "poletanje", "der Start"), o("the gate", "izlaz", "das Gate")], 0, o("Poletanje = take-off, sletanje = landing.", "Poletanje = take-off, sletanje = landing.", "Poletanje = Start, sletanje = Landung.")),
    q("“Kapetan” and “kopilot” are …", "„Kapetan“ i „kopilot“ su …", "„Kapetan“ und „kopilot“ sind …", [o("captain and first officer", "kapetan i prvi oficir", "Kapitän und Erster Offizier"), o("cabin crew", "kabinsko osoblje", "Kabinenpersonal"), o("ground staff", "zemaljsko osoblje", "Bodenpersonal")], 0, o("Posada = crew.", "Posada = crew.", "Posada = Crew.")),
    q("“Beograd” is the Serbian name of …", "„Beograd“ je srpsko ime za …", "„Beograd“ ist der serbische Name von …", [o("Belgrade", "Beograd", "Belgrad"), o("Bucharest", "Bukurešt", "Bukarest"), o("Budapest", "Budimpešta", "Budapest")], 0, o("Beograd – “white city”, the hub of Air Serbia (LYBE).", "Beograd – „beli grad“, čvorište Air Serbie (LYBE).", "Beograd – „weiße Stadt“, das Drehkreuz von Air Serbia (LYBE).")),
  ] },
];

const P = () => store.get("asl.academy", {}); // { courseId: { best: n, answers: {i: chosenIndex} } }
let cur = null, idx = 0;
const done = (c) => Object.keys(P()[c.id]?.answers || {}).length;
const right = (c) => Object.entries(P()[c.id]?.answers || {}).filter(([i, a]) => c.qs[i]?.ok === a).length;

export function render(body, ctx) {
  if (!body._ac) { body._ac = true; body.addEventListener("click", (e) => {
    const s = e.target.closest("[data-course]"); if (s) { cur = s.dataset.course; idx = Math.min(done(COURSES.find((c) => c.id === cur)), COURSES.find((c) => c.id === cur).qs.length - 1); ctx.changed("view"); return; }
    const a = e.target.closest("[data-ans]"); if (a) { const p = P(), c = COURSES.find((x) => x.id === cur); (p[cur] ||= { answers: {} }).answers[idx] = +a.dataset.ans; store.set("asl.academy", p); ctx.changed("view"); return; }
    if (e.target.closest("[data-next]")) { idx++; ctx.changed("view"); return; }
    if (e.target.closest("[data-again]")) { const p = P(); delete p[cur]; store.set("asl.academy", p); idx = 0; ctx.changed("view"); return; }
    if (e.target.closest("[data-leave]")) { cur = null; ctx.changed("view"); }
  }); }
  const c = COURSES.find((x) => x.id === cur);
  if (ctx.tab === "badges") { body.innerHTML = badges(); return; }
  if (!c) {
    body.innerHTML = `<div class="ac-grid">${COURSES.map((x) => { const n = x.qs.length, d = done(x); return `<button class="card ac-c" data-course="${x.id}"><span class="tag">${x.lang ? t("Language") : t("Course")}</span><h3>${esc(loc(x.title))}</h3><p class="dim">${esc(loc(x.text))}</p>
      <div class="ac-bar"><i style="width:${Math.round((d / n) * 100)}%"></i></div><small class="dim">${t("{a} of {b} questions", { a: d, b: n })}${d === n ? " · " + t("{n} right", { n: right(x) }) : ""}</small></button>`; }).join("")}</div>
      <p class="dim ac-note">${t("Practice in the pad. The official training of Air Serbia Virtual comes from the VA staff.")}</p>`;
    return;
  }
  const ans = P()[c.id]?.answers || {};
  if (idx >= c.qs.length) {
    body.innerHTML = `<div class="card ac-end"><h2>${esc(loc(c.title))}</h2><p class="ac-score">${right(c)} / ${c.qs.length}</p><p class="dim">${right(c) === c.qs.length ? t("Perfect – every answer right.") : t("Look at the explanations and try again.")}</p>
      <button class="btn" data-again>${t("Start again")}</button> <button class="btn pri" data-leave>${t("All courses")}</button></div>`;
    return;
  }
  const Q = c.qs[idx], chosen = ans[idx];
  body.innerHTML = `<div class="ac-q"><div class="ac-top"><button class="btn small" data-leave>${t("All courses")}</button><span class="dim">${esc(loc(c.title))} · ${idx + 1} / ${c.qs.length}</span></div>
    <div class="ac-bar"><i style="width:${Math.round((idx / c.qs.length) * 100)}%"></i></div>
    <h2>${esc(loc(Q.q))}</h2><div class="ac-ans">${Q.a.map((a, i) => `<button class="ac-a${chosen == null ? "" : i === Q.ok ? " ok" : i === chosen ? " bad" : ""}" data-ans="${i}" ${chosen == null ? "" : "disabled"}>${esc(loc(a))}</button>`).join("")}</div>
    ${chosen == null ? "" : `<div class="card ac-why"><b>${chosen === Q.ok ? t("Right.") : t("Not quite.")}</b> ${esc(loc(Q.why))}</div><button class="btn pri" data-next>${idx + 1 < c.qs.length ? t("Next question") : t("Finish")}</button>`}</div>`;
}
function badges() {
  const total = COURSES.reduce((n, c) => n + c.qs.length, 0), d = COURSES.reduce((n, c) => n + done(c), 0), r = COURSES.reduce((n, c) => n + right(c), 0);
  const perfect = COURSES.filter((c) => right(c) === c.qs.length).length;
  const B = [[t("First steps"), t("Answer your first question."), d > 0], [t("Course complete"), t("Finish a whole course."), COURSES.some((c) => done(c) === c.qs.length)],
    [t("Perfect course"), t("Every answer of a course right."), perfect > 0], [t("Academy graduate"), t("Every course perfect."), perfect === COURSES.length]];
  return `<div class="card"><div class="lbl">${t("Your progress")}</div><p class="ac-score">${d} / ${total}</p><p class="dim">${t("{n} right", { n: r })}</p></div>
    <div class="card"><div class="lbl" style="margin-bottom:10px">${t("Badges")}</div><div class="ac-badges">${B.map(([n, x, ok]) => `<div class="ac-b${ok ? " on" : ""}"><span>${ok ? "★" : "☆"}</span><div><b>${esc(n)}</b><small>${esc(x)}</small></div></div>`).join("")}</div></div>`;
}
export function summary() { const total = COURSES.reduce((n, c) => n + c.qs.length, 0), d = COURSES.reduce((n, c) => n + done(c), 0); return [t("Academy"), t("{a} of {b} questions", { a: d, b: total })]; }
