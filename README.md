# ASL Pad

Crew-Pad für virtuelle **Air Serbia**-Flüge im Flugsimulator (MSFS 2024, VATSIM). Läuft im Browser auf dem iPad,
am besten als App auf dem Home-Bildschirm (Safari → Teilen → Zum Home-Bildschirm).

> Inoffizielles Fanprojekt. Nicht mit Air Serbia verbunden. Nur für die Flugsimulation, nicht für die echte Navigation.

Es gibt keinen Demo-Modus: Das Pad zeigt immer den eigenen Flug aus SimBrief und VATSIM. Den Demoflug JU500 (`js/demo.js`) gibt es nur für den automatischen Test auf dem eigenen Rechner (`localhost`).

## Was drin ist

| Teil | Inhalt |
|---|---|
| **Sperrbildschirm** | Uhr, Flug- und Zeit-Widgets, Hinweise (TSAT, Fuel Check fällig, Stand, ATIS) und die Live-Aktivität des Flugs unten (Strecke, nächster Wegpunkt, FL, FOB, verbleibende NM). Nach oben wischen oder tippen entsperrt. |
| **Home** | Begrüßung, Widgets, App-Raster und Dock. Rote Badges zeigen offene Punkte. |
| **ASL Fly** | Übersicht (Flughäfen mit Wetter und Piste, Phase, nächster Wegpunkt, ETA, OUT/OFF/ON/IN, Treibstoff), Zeiten, Flugplan mit ETA/ATA je Wegpunkt, Karte mit Route, geflogenem Weg und Vertikalprofil, Wetter (METAR, TAF, ATIS), Treibstoff mit Fuel Checks. |
| **ASL Ops** | Dienst-Leiste, To-do, Abflug (Stand, Piste, SID, vIFF-CDM: EOBT/TOBT/TSAT/TTOT/CTOT, Frequenzen) und Ankunft (Stand-Prognose, Piste, STAR, ATIS, Frequenzen). Reiter **Flotte** mit den SimBrief-Airframes der A319 YU-APA bis YU-APE und eigenen Flugzeugen. |
| **Logbuch** | Jeder Flug wird beim On-Block eingetragen. Statistik, Details mit Streckenkarte, Flug von Hand eintragen, CSV-Export, Sicherung und Import (JSON). |
| **Aerodrom (Airport)** | Rollkarte von LYBE, LYNI und LYKV (Pisten, Rollwege mit Schildern, Stände, Haltepunkte, Hot Spots, VATSIM-Verkehr – unsere in Rot) mit **Rollweg** vom Stand zur Piste bzw. vom Abrollweg zum Stand und den Haltepunkten; **LYBE-Briefing** aus [`va/airports/LYBE.json`](va/airports/LYBE.json); **Stände** mit Spannweite, Einweisung, passt / belegt. |
| **Preuzimanja (Downloads)** | Links der VA aus [`va/downloads.json`](va/downloads.json): ACARS (Pflicht), Crew Lounge, Liveries, SimBrief, VATSIM, SCG vACC. Reiter **Promene** mit allen Updates. |
| **Cabin / VDGS** | Öffnet die Air-Serbia-Kabinenanzeige und das VDGS aus `vdgs-slot-board` mit dem Rufzeichen des Flugs. |
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
- Karte: CARTO-Kacheln auf OpenStreetMap

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

## Flugkarte, SIGMETs und Kälte-Korrektur (1.6)

- Flugkarte: **MESSEN** (zwei Punkte: NM, Kurs, Zeit bei aktueller GS), **RINGE** (25/50/100/200 NM ums Flugzeug), **Direct to** im Wegpunkt-Fenster
  (Kurs, Entfernung, Zeit, Ersparnis gegenüber der Route), **SIGMET**-Ebene. Unter Wetter: SIGMETs auf der Route.
- SIGMETs holt [`.github/workflows/sigmets.yml`](.github/workflows/sigmets.yml) alle 30 Minuten von aviationweather.gov in den Branch `wx`.
- Performance: **Temperaturkorrektur** nach ICAO (PANS-OPS) bei 0 °C und darunter, am Abflug- und Zielflughafen (`js/cold.js`).
- Abflugverfahren der Airline (NADP, EOSID) kann die VA-Leitung in `va/airports/<ICAO>.json` unter `procedures` eintragen.

## Ein Update machen

1. Änderung bauen und testen (`node tests/smoke.mjs`).
2. In `js/whatsnew.js` oben einen neuen Eintrag anlegen (Version, Datum, Neuerungen je App, englisch in `t()`),
   die Texte in `js/i18n-dict.js` bei `SR` und `DE` ergänzen und in `sw.js` den `CACHE` hochzählen.
3. Nach `main` bringen. Beim nächsten Öffnen zeigt das Pad allen einmal **„Šta je novo“**
   (später wieder unter Einstellungen → Über die App).
4. Grafik für Discord (1920×1080) erzeugen: `node tools/whatsnew-card.mjs sr whatsnew-sr.png` (oder `de`, `en`). Die PNG nicht committen.
