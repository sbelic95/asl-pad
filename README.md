# ASL Pad

Crew-Pad für virtuelle **Air Serbia**-Flüge im Flugsimulator (MSFS 2024, VATSIM). Läuft im Browser auf dem iPad,
am besten als App auf dem Home-Bildschirm (Safari → Teilen → Zum Home-Bildschirm).

> Inoffizielles Fanprojekt. Nicht mit Air Serbia verbunden. Nur für die Flugsimulation, nicht für die echte Navigation.

Es gibt keinen Demo-Modus: Das Pad zeigt immer den eigenen Flug aus SimBrief und VATSIM. Den Demoflug JU500 (`js/demo.js`) gibt es nur für den automatischen Test auf dem eigenen Rechner (`localhost`).

## Was drin ist

| Teil | Inhalt |
|---|---|
| **Sperrbildschirm** | Uhr, Flug- und Zeit-Widgets, Hinweise (TSAT, Fuel Check fällig, Stand, ATIS) und die Live-Aktivität des Flugs unten (Strecke, nächster Wegpunkt, FL, FOB, verbleibende NM). Nach oben wischen oder tippen entsperrt. |
| **Home** | Begrüßung, Widgets (Flug, Zeiten, Wetter, Kalender), drei App-Seiten mit Punkten (Betrieb · Netzwerk & Wetter · Werkzeuge & Gerät; wischen oder Punkte tippen), Board und Dock. Rote Badges zeigen offene Punkte. |
| **Gerät** | Statusleiste oben rechts herunterziehen/tippen = **Kontrollzentrum** (hell/dunkel, Nicht stören, Mitteilungen, Sprache, Helligkeit, Sperren, Status von VATSIM/SimBrief/Konto/Hoppie). Oben links = **Mitteilungszentrale** (To-do und alle Hinweise der Apps, `js/notify.js`). **keine PIN** (Wischen öffnet das Pad), **Face ID** vor ASL Ops und Manuals ist nur gespielt (Animation, 10 Minuten gültig). |
| **ASL Fly** | Übersicht (Flughäfen mit Wetter und Piste, Phase, nächster Wegpunkt, ETA, OUT/OFF/ON/IN, Treibstoff), Zeiten, Flugplan mit ETA/ATA je Wegpunkt, Karte mit Route, geflogenem Weg und Vertikalprofil, Wetter (METAR, TAF, ATIS), Treibstoff mit Fuel Checks. |
| **ASL Ops** | Reiter **Dienstplan** (Dashboard-Buchungen + OFP zu Diensten: Meldezeit −60 min, Turnaround, Dienstzeit, Dienstende +30 min, Check-in), **Crew Desk** (Posteingang, Vorflug-Liste, Wetter, NOTAMs aus dem OFP), **Bericht** (tatsächliche Zeiten und Sprit der letzten 72 h; „Times missing“ als Hinweis). Reiter Operations: Dienst-Leiste, To-do, Abflug (Stand, Piste, SID, vIFF-CDM: EOBT/TOBT/TSAT/TTOT/CTOT, Frequenzen) und Ankunft (Stand-Prognose, Piste, STAR, ATIS, Frequenzen). Reiter **Flotte** mit den SimBrief-Airframes der A319 YU-APA bis YU-APE und eigenen Flugzeugen. |
| **Logbuch** | Jeder Flug wird beim On-Block eingetragen. Statistik, Details mit Streckenkarte, Flug von Hand eintragen, CSV-Export, Sicherung und Import (JSON). |
| **Aerodrom (Airport)** | Rollkarte von LYBE, LYNI und LYKV (Pisten, Rollwege mit Schildern, Stände, Haltepunkte, Hot Spots, VATSIM-Verkehr – unsere in Rot) mit **Rollweg** vom Stand zur Piste bzw. vom Abrollweg zum Stand und den Haltepunkten; **LYBE-Briefing** aus [`va/airports/LYBE.json`](va/airports/LYBE.json); **Stände** mit Spannweite, Einweisung, passt / belegt. |
| **Preuzimanja (Downloads)** | Links der VA aus [`va/downloads.json`](va/downloads.json): ACARS (Pflicht), Crew Lounge, Liveries, SimBrief, VATSIM, SCG vACC. Reiter **Promene** mit allen Updates. |
| **Neue Apps (2.0)** | **VATSIM Radar** / **IVAO Radar** (`js/apps/radar.js`, ein Modul, zwei Netze), **Weather** (nur Air-Serbia-Ziele aus `va/routes.json`, Szenen nach METAR), **Calendar**, **Clock** (Zulu, Weltuhr, Stoppuhr, Timer, Wecker), **Calculator**, **Kneeboard** (Freigabe, ATIS, Notizen, Zeichenblock je Flug), **Manuals** (nur Links aus [`va/manuals.json`](va/manuals.json)), **App Store** (Apps ein-/ausblenden, `settings.appsOff`). |
| **ASL Fly → VDGS** | Standanzeige wie am Gate (`js/apps/vdgs.js`): Stand, Zeiten zuerst von VATSIM (vIFF CDM, auch Frankfurt/Heathrow), sonst aus dem SimBrief-OFP; Frankfurt verlangt eine TOBT (Knopf zum VATSIM-VDGS); Countdown bis zum Anlassfenster (TSAT −5/+5 min, sonst −5/+6 um CTOT−EXOT, TOBT oder EOBT), EOBT/TOBT/TSAT/TTOT/CTOT, Piste, SID, ATIS und welche Frequenz jetzt und als nächste; in der Luft der Ankunftsstand. Eine Zeile davon steht auch in der Übersicht. |
| **ASL Fly → Runways** | Gegen-/Rücken- und Seitenwind je Piste aus dem aktuellen METAR (Pistenliste aus SimBriefs Runway Analysis; reine Geometrie, keine Performance). |
| **Zurück** | Das App-Logo oben links (z. B. „‹ ASL Ops“) führt in jeder App zurück zum Home-Bildschirm, wie ein Tipp auf den Home-Balken unten. |
| **Einstellungen** | SimBrief-Name oder Pilot-ID, VATSIM-CID, Sprache (Englisch, Srpski, Deutsch), kg / t / lb, hell / dunkel, **Hintergrund** für Sperr- und Home-Bildschirm (sechs Vorlagen oder ein eigenes Foto vom Gerät, abdunkelbar), Auto-Sperre. |

Doppeltipp auf den Home-Balken unten öffnet den **App-Umschalter** mit Miniaturen der offenen Apps (Karte nach oben wischen oder × schließt sie).
Einfacher Tipp führt zum Home-Bildschirm.

## Datenquellen (alle ohne Schlüssel, direkt aus dem Browser)

- **SimBrief** – neuester OFP (`xml.fetcher.php?json=v2`), alle 5 Minuten
- **VATSIM** – Position, Prefiles, ATIS und Lotsen (`data.vatsim.net/v3`), alle 20 Sekunden; METAR von `metar.vatsim.net`
- **vIFF CDM** – Slot-Zeiten vor dem Abflug
- **Standdaten** – aus dem Branch `stands` von `sbelic95/vdgs-slot-board` (OpenStreetMap), sonst direkt über Overpass; Pisten aus dem Branch `atc`
- **VATSIM UK** – echte Stand-Zuweisungen in Großbritannien (Branch `data`)
- Karte: OpenStreetMap-Kacheln (`tile.openstreetmap.org`, ohne Schlüssel – CARTO verlangt seit 11/2026 einen API-Schlüssel), im dunklen Look per CSS-Filter abgedunkelt, darunter die eigene Natural-Earth-Karte (`baseLayer` in `js/apps/map.js`)
- TAF der Wetter-App: aviationweather.gov über den Branch `wx` (`taf.json`, Workflow `sigmets.yml`), weil aviationweather.gov keinen Browserzugriff (CORS) erlaubt

Alles, was die App sich merkt (Einstellungen, Flugzustand, Fuel Checks, Logbuch), liegt nur im Browser des Geräts (`localStorage`).
Vor einem Gerätewechsel im Logbuch **Sicherung** drücken und auf dem neuen Gerät **Importieren**.

## Aufbau

Kein Build-Schritt: statische Dateien, ES-Module, GitHub Pages.

```
index.html            Gerüst (Statusleiste, Sperrbildschirm, Home, Apps, Umschalter)
css/pad.css           Aussehen (Air-Serbia-Farben, hell und dunkel)
js/main.js            Shell: Sperren/Entsperren, Apps öffnen, Umschalter, Auto-Sperre, Hinweise
js/data.js            Daten-Zentrale und Abfragen (SimBrief, VATSIM, METAR, CDM, Stände)
js/ofp.js             SimBrief-OFP → Flugmodell
js/flight.js          Position auf der Route, Flugphase, Zeiten, Fuel Checks, Logbuch-Eintrag
js/stands.js          Stand-Prognose (aus dem VDGS übernommen)
js/wx.js              METAR, Flugkategorien, ATIS, Piste nach Wind
js/lock.js, home.js   Sperrbildschirm und Home
js/wall.js            Hintergrund: Vorlagen und eigenes Foto (verkleinert, in localStorage "asl.wall.photo")
js/apps/*.js          ASL Fly (+ Karte), ASL Ops, Logbuch, Einstellungen
js/i18n*.js           Übersetzungen (Schlüssel ist der englische Text)
js/demo.js            Demoflug JU500, nur für den Test (localhost)
sw.js                 Offline-Hülle (die App selbst, keine Live-Daten)
```

Neue Texte: englisch im Code mit `t("…")` schreiben und in `js/i18n-dict.js` für `SR` und `DE` ergänzen.

Lizenzen der verwendeten Bibliotheken und Daten: [LIZENZEN.md](LIZENZEN.md).

## Mitteilungen, Tipps und VATSIM-Events (Home-Bildschirm)

- **Mitteilungen und Tipp des Tages** stehen in [`va/notices.json`](va/notices.json). Die Leitung der VA bearbeitet die Datei direkt auf GitHub
  (Stift-Symbol, Texte auf `sr`/`en`/`de`, `until` = bis wann sichtbar). Das Pad lädt sie alle 15 Minuten; ungelesene haben einen roten Punkt.
- **VATSIM-Events** holt der Ablauf [`.github/workflows/vatsim-events.yml`](.github/workflows/vatsim-events.yml) alle 30 Minuten von my.vatsim.net
  in den Branch `data` (`events.json`). Events in Serbien und an den Flughäfen des eigenen Flugs stehen zuerst.

## Karriere, Crew-Info, Hintergrund „Nebo gde si“ (1.4)

- **Karriere:** Rang nach Blockzeit im Logbuch dieses Geräts, mit den Rängen aus [`va/ranks.json`](va/ranks.json). Die Ränge dort sind ein
  **Vorschlag** – die Leitung der VA soll sie bestätigen oder ändern. Bei einem neuen Rang kommt einmal ein Glückwunsch-Brief.
- **Crew-Info:** Tipps in `va/notices.json` mit `"phase"` erscheinen in dieser Flugphase statt des Tipps des Tages.
- **Home-Bildschirm anpassen:** Einstellungen → Početni ekran (Wetter, Karriere, Mitteilungen, Events ein/aus).
- **Hintergrund „Nebo gde si“:** folgt Ortszeit und Wetter am Abflugort (bis zum Start), dann am Ziel.

## Rollkarte und Rollwege (1.5)

- Bodendaten aus OpenStreetMap holt [`.github/workflows/ground-data.yml`](.github/workflows/ground-data.yml) wöchentlich in den Branch `ground`
  (`ground/<ICAO>.json`); weitere Flughäfen in `AIRPORTS` im Workflow und in `GROUND_AIRPORTS` in `js/ground.js` eintragen.
- `js/ground.js` baut daraus ein Rollweg-Netz und sucht den kürzesten Weg; Pisten nur zum Kreuzen (bzw. als Notlösung), die eigene Start-/Landepiste nie.
  Lose Rollweg-Enden bis 120 m vor einer Piste werden mit ihr verbunden (in OSM enden bei LYBE z. B. R1–R4 und D5–D7 knapp davor).
- Das Briefing steht in `va/airports/<ICAO>.json` (sr/en), nur Fakten in eigenen Worten. LYBE folgt der VFR AIP von SMATSA (smatsa.rs, AD 2 LYBE, AIRAC AMDT 10/26) – bei neuen AIRAC-Ständen dort nachsehen.

## Flugkarte, SIGMETs und Kälte-Korrektur (1.6)

- Flugkarte: **MESSEN** (zwei Punkte: NM, Kurs, Zeit bei aktueller GS), **RINGE** (25/50/100/200 NM ums Flugzeug), **Direct to** im Wegpunkt-Fenster
  (Kurs, Entfernung, Zeit, Ersparnis gegenüber der Route), **SIGMET**-Ebene. Unter Wetter: SIGMETs auf der Route.
- SIGMETs holt [`.github/workflows/sigmets.yml`](.github/workflows/sigmets.yml) alle 30 Minuten von aviationweather.gov in den Branch `wx`.
- Performance: **Temperaturkorrektur** nach ICAO (PANS-OPS) bei 0 °C und darunter, am Abflug- und Zielflughafen (`js/cold.js`).
- Abflugverfahren der Airline (NADP, EOSID) kann die VA-Leitung in `va/airports/<ICAO>.json` unter `procedures` eintragen.

## Flugvorschlag, Buchung und Plan-Karte (1.7)

- **Vorschlag für dich** (Home und ASL Ops, `js/booking.js`): ein Flug aus `va/routes.json` – zuerst zurück nach Belgrad, wenn der letzte
  Logbuch-Flug woanders endete; sonst bevorzugt VATSIM-Events am Ziel (nächste 12 h), noch nicht geflogene Strecken und den meistgeflogenen Typ.
  Dazu ein freies Rufzeichen (nicht online und nicht vorab angemeldet auf VATSIM, `S.inUse`) und wann man zurück in Belgrad ist (grobe Blockzeit).
- `va/routes.json`: **nur das Air-Serbia-Netz** (`airports` + `routes`, jede Strecke in beide Richtungen, `season` summer/winter), ab Belgrad und Niš.
  Vorschläge und Buchung erlauben nichts anderes (Rufzeichen nur ASL…). Ein **Vorschlag**, bis die VA-Leitung ihn bestätigt (wie `ranks.json`).
- **Buchung** in vier Schritten: Flug → Flugzeug, Zeit und Rufzeichen → SimBrief öffnet sich ausgefüllt (`dispatch.simbrief.com/options/custom`) →
  Plan laden → in der Plan-Karte bei VATSIM vorab anmelden (Link aus dem OFP). Die Buchung liegt in `asl.booking`.
- **Plan-Karte**: Wetter an beiden Enden, Stände, Sprit (Rollen, Strecke, Reserven, Extra mit Minuten), ZFW/TOW/LDW gegen die Höchstwerte.
  Block Fuel mit + und − (100 kg bzw. 200 lb, nicht unter den Plan ohne Extra) – nur Summen aus dem OFP, keine eigene Performance (`asl.fuelAdj`).
- Karten des Home-Bildschirms lassen sich in den Einstellungen sortieren (`settings.homeOrder`).

## Funk, ACARS, Cabin und Konto (1.8, 2.4)

- Die alte eingebettete VDGS-App ist entfernt; ihre Funktionen sind jetzt eigene Module:
  - **ASL Fly → „Radio & ACARS“** (`js/apps/radio.js`): Slot-Status (vIFF CDM) vor dem Off-Block, **Frequenz-Führer** (`js/atc.js`, aus dem VDGS übernommen:
    VATSpy-Luftraumgrenzen, TRACON-Bereiche aus `vdgs-slot-board` Zweig `atc`, VATSIM top-down, UNICOM 122.800) und **Hoppie ACARS/CPDLC**
    (`js/hoppie.js`: peek alle 60 s, PDC-Anfrage als Telex, METAR/TAF/ATIS per inforeq, Telex, CPDLC-Logon/-Logoff, Antworten WILCO/UNABLE/…).
    In der Übersicht eine Funk-Zeile; Frequenzwechsel und neue Nachrichten erscheinen als Hinweise (Sperrbildschirm, Badges).
  - **Cabin** (`js/apps/cabin.js`): eigene Passagier-App im Air-Serbia-Look – Flugkarte (km/h, m, Außentemperatur, Ortszeiten), Ziel (Ortszeit, Wetter),
    Anschlussflüge und Ankünfte (VATSIM, `S.board` in `data.js`), Diashow.
- **Konto** (`js/account.js`, seit 2.4; vAMSYS ist seit 2.6 ganz entfernt): Anmeldung mit VATSIM-CID + PIN gegen das Piloten-Dashboard
  (`https://airserbia-virtual.pages.dev`, Token in `asl.account`). Übernimmt Profil (SimBrief, CID, IVAO, Hoppie), VATSIM-Rating und die Buchungen
  (`pilot()`: Crew-Ausweis, Dienstplan, Kalender, Home-Karte „Your booking“). Der Sperrbildschirm hat keine PIN (Wischen öffnet das Pad).

## Server (2.0, vorbereitet)

`server/` enthält einen Cloudflare Worker für die Synchronisierung zwischen Geräten (Logbuch, Kalender, Wecker, Check-ins),
Anmeldung über den Konto-Token (der Worker fragt das Dashboard, wer es ist → VATSIM-CID). Er ist aus, solange `url` in [`va/server.json`](va/server.json) leer ist. Einschalten: [server/README.md](server/README.md).
Push an ein geschlossenes Pad und E-Mail brauchen noch VAPID-Schlüssel bzw. einen Mail-Dienst.

## Datenschutz

[`privacy.html`](privacy.html) (EN/SR/DE, Sprache per `?lang=` oder wie im Pad): was das Pad speichert (nur im Browser), welche Dienste es abfragt
und was die Konto-Anmeldung (Dashboard) liest. Link in den Einstellungen unter „About“. Bei neuer Datennutzung zuerst diese Seite anpassen.

## Ein Update machen

1. Änderung bauen und testen (`node tests/smoke.mjs`).
2. In `js/whatsnew.js` oben einen neuen Eintrag anlegen (Version, Datum, Neuerungen je App, englisch in `t()`),
   die Texte in `js/i18n-dict.js` bei `SR` und `DE` ergänzen und in `sw.js` den `CACHE` hochzählen.
3. Nach `main` bringen. Beim nächsten Öffnen zeigt das Pad allen einmal **„Šta je novo“**
   (später wieder unter Einstellungen → Über die App).
4. Grafik für Discord (1920×1080) erzeugen: `node tools/whatsnew-card.mjs sr whatsnew-sr.png` (oder `de`, `en`). Die PNG nicht committen.
