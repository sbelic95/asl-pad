# ASL Pad – Hinweise für Claude

Crew-Pad (iPad-Web-App) für **virtuelle Air-Serbia-Flüge** im MSFS 2024 mit SimBrief und VATSIM. Inoffizielles Fanprojekt.
Der Nutzer (sbelic95) schreibt Deutsch; antworte auf Deutsch. Die Oberfläche ist Englisch und umschaltbar auf Srpski und Deutsch.

- Repo: `sbelic95/asl-pad`, Branch `main`. Seite: `https://sbelic95.github.io/asl-pad/` (GitHub Pages aus `main`, Ordner `/`, seit 11.11.2026 an)
- **Keinen Demo-Modus für Nutzer** (Wunsch des Nutzers, dauerhaft): kein Schalter in den Einstellungen, auf der echten Seite wird `settings.demo` immer gelöscht.
  `?demo` / `?demo=ground` (JU500 LYBE–KJFK) wirkt nur auf `localhost` für Tests (`DEV` in `js/data.js`); dazu `&lang=sr|de`, `&app=fly&tab=perf`, `&unlock`
- Zurück zum Home-Bildschirm: das App-Logo oben links (`.app-name` in `js/main.js`) – so gewünscht, keinen extra Home-Knopf einbauen.
- Schwesterprojekt: `sbelic95/vdgs-slot-board` (VDGS, Kabinenanzeige `/airserbia/`). Von dort kommen Standdaten
  (Branch `stands`), Pisten (Branch `atc`) und VATSIM-UK-Stände (Branch `data`); `js/stands.js` ist aus dessen `index.html` übernommen.
- Was die Apps können und wie der Code aufgebaut ist: [README.md](README.md). Lizenzen: [LIZENZEN.md](LIZENZEN.md).

## Regeln für den Code

- Kein Build, kein Framework: statische Dateien, ES-Module, nur Bibliotheken aus `vendor/` (Leaflet, Schriften). Keine CDNs.
- Jeder neue Text in der Oberfläche: englisch mit `t("…")` schreiben **und** in `js/i18n-dict.js` bei `SR` und `DE` ergänzen
  (Platzhalter wie `{n}` gleich lassen). Der Test prüft das.
- Apps sind Module in `js/apps/` mit `tabs`, `render(body, ctx)`, optional `summary()`; eingetragen in `js/main.js` (`APPS`) und `js/home.js` (`HOME_APPS`).
  `render` baut `innerHTML` neu (alle 10 s und bei jeder Datenänderung); Klicks per Delegation mit `data-do`. Die Karte (`js/apps/map.js`) behält ihre Leaflet-Instanz.
- Nie `scrollIntoView` benutzen: es verschiebt das ganze Pad. Stattdessen `scrollTop` des `.app-body` setzen.
- Speicher nur über `store` aus `js/util.js`, Schlüssel beginnen mit `asl.`. Flugzustand: `asl.flight.<cs>.<dep>.<arr>.<tag>`, Logbuch `asl.logbook` (Demo: `asl.logbook.demo`).
- Neue Dateien in `sw.js` in die Liste `SHELL` aufnehmen und bei Änderungen an der Offline-Hülle `CACHE` hochzählen (`asl-pad-v2`, …).
- Marke: Farben Stratosphere `#002E5D`, Sky `#0059C2`, Beacon Red `#E3001F`. Das Air-Serbia-Logo wird nur zur Laufzeit von
  `pics.avs.io` geladen und nie ins Repo gelegt. Keine Namen aus LH Virtual übernehmen (flySmart, padOS, Contrail); unsere heißen ASL Pad, ASL Fly, ASL Ops, Logbook.
- Performance (V1/VR/V2, Landestrecke) wird **nicht selbst gerechnet**, sondern aus SimBriefs Runway Analysis (`tlr` im OFP) gelesen (`normTlr` in `js/ofp.js`, Anzeige `js/apps/perf.js`).

## Home-Bildschirm (1.3)

Mitteilungen/Tipps aus `va/notices.json` (pflegt die VA-Leitung selbst; keine erfundenen VA-Mitteilungen eintragen), VATSIM-Events aus
Branch `data` (`events.json`, Workflow `vatsim-events.yml`). `S.events` sind die Flugereignisse – die VATSIM-Events heißen `S.vatEvents`.

## VA-Dateien (`va/`)

`notices.json` (Mitteilungen, Tipps, Crew-Info je Phase), `downloads.json` (App Preuzimanja), `ranks.json` (Karriere; Ränge sind ein
Vorschlag, bis die VA-Leitung sie bestätigt). Nur echte, geprüfte Links und keine erfundenen VA-Inhalte. Karriere ist lokal je Gerät –
offizielle Ränge/Stunden gäbe es erst mit einer Anbindung an die Crew Lounge der VA (airserbiavirtual.online).

## App „Airport“ (1.5)

`js/apps/airport.js` + `js/ground.js`: Rollkarte (Leaflet ohne Kacheln) aus Branch `ground` (Workflow `ground-data.yml`), Rollwege per Dijkstra,
Briefing aus `va/airports/<ICAO>.json`. Keine Karten oder Texte von Jeppesen/Navigraph ins Repo – nur Fakten in eigenen Worten.
Der Name „flySmart“ wird nicht verwendet (siehe Marke). Getestet mit `ground/LYBE.json`: jede Stand–Pisten-Kombination hat eine Route.

## 1.6

Kartenwerkzeuge in `js/apps/map.js`, SIGMETs aus Branch `wx` (`js/sigmet.js`), Kälte-Korrektur `js/cold.js` (ICAO-Formel; bei 0 °C/1000 ft = +60 ft wie die ICAO-Tabelle).
EOSID/NADP nur echte Verfahren der Airline in `procedures` – nichts erfinden.

## 1.7 Buchung

`js/booking.js`: Flugvorschläge aus `va/routes.json` (Vorschlag, bis die VA-Leitung bestätigt – keine Linien erfinden), Buchung → SimBrief → Plan-Karte
mit Sprit ±. Sprit/Gewichte nur als Summen aus dem OFP, keine Performance. Kein LH-Layout nachbauen, eigener Stil.

## 1.8 Funk, ACARS, Cabin

Keine VDGS-App mehr im Pad (Wunsch des Nutzers): Frequenz-Führer `js/atc.js`, Hoppie `js/hoppie.js` → ASL Fly Reiter „radio“; Passagier-Ansicht = App `cabin`.

## 2.0 (nach dem LH-Virtual-Pad-Guide, eigener Stil)

Apps-Gruppen in `home.js` (`GROUPS`, `HOME_APPS[].g`, `core` = nicht entfernbar), App Store `js/apps/store.js`. Geräte-Oberfläche `js/device.js`
(PIN = VATSIM-CID des Kontos, Face ID nur gespielt, Kontroll-/Mitteilungszentrale), Mitteilungen nur über `notify()` aus `js/notify.js`.
Dienstplan/Crew Desk/Bericht in `js/crew.js`. Namen bewusst eigen: „Crew Desk“ statt „eDesk“. Manuals nur als Links (`va/manuals.json`, kein PDF ins Repo).
Karten: nur OpenStreetMap-Kacheln über `baseLayer()` in `js/apps/map.js` (CARTO braucht seit 11/2026 einen Schlüssel – nicht mehr verwenden). VDGS-Anzeige = ASL Fly Reiter `vdgs` (`js/apps/vdgs.js`): Zeiten zuerst von VATSIM (vIFF CDM von VATSIM Spain, `viff-system.network/ifps/callsign` – deckt auch EDDF/EGLL ab; vACDM Germany ist eingestellt), sonst aus SimBrief (Wunsch des Nutzers). EDDF verlangt immer eine TOBT (`REQ_TOBT`), gesetzt wird sie im VATSIM-VDGS `vdgs.vatsimspain.es`.
Server `server/worker.js` (Cloudflare) ist vorbereitet, aktiv erst mit `url` in `va/server.json` – braucht das Cloudflare-Konto des Nutzers. Ground (GSX) kommt später.

## 2.1 Geräterahmen

`js/frame.js`: Auf großen Computer-Bildschirmen (ab 1400×880, nicht als installierte App, nicht auf Touch-Geräten) liegt das Pad als Tablet
auf einem Tisch: Rahmen `#device` um `#pad`, Sperrtaste oben (`.dv-power`), Helligkeitstasten rechts (`.dv-vol`), Crew-Ausweis `#crewcard`
links (Name/Rating/CID aus dem Konto, Flug aus dem OFP). Einstellung `settings.frame` = auto | on | off. Bei 1180×820 (Test) gibt es keinen Rahmen.
Statusleiste mit Netz und Akku (`navigator.getBattery`, nur wenn der Browser ihn liefert – nie erfinden). Zeigerpositionen immer relativ
zum Pad rechnen (`getBoundingClientRect`), nicht zum Fenster. Eigenes Design, nicht das Gerät von LH Virtual nachbauen.

## 2.2 Neue Apps (Funktionen wie im LH-Virtual-Pad, eigener Stil und eigene Namen)

Startseite „Crew & community“ (`GROUPS` in `home.js`): Mail (`js/apps/mail.js`: nur echte Quellen – `va/notices.json`, Willkommensbrief,
Monatsübersicht aus dem Logbuch), Messages (Mitteilungen + Hoppie-ACARS als Unterhaltungen, nur lesen), Academy (Kurse dreisprachig im Modul,
Fortschritt `asl.academy`; kein offizielles VA-Training), News (`sim-news.yml` → Branch `news`, nur Titel, Teaser ≤ 160 Zeichen, Quelle, Link),
Photos (IndexedDB `asl.photos` – Bilder sind zu groß für localStorage), Scenery (Wischen durch `va/routes.json`, Link zur Suche auf flightsim.to).
Werkzeuge: Reference (Alphabet, Umrechner, Codes, Lichtsignale, METAR), Browser (Links in neuem Tab – die Dienste erlauben keine Einbettung).
Home-Spalten scrollen innen (`.hm-widgets`, `.hm-main`), damit das Dock nie abgeschnitten wird. Nicht übernommen: Partner-Apps von LH Virtual.

## 2.3 Turnaround (GSX) und Fenix EFB

Live-Daten kommen von der VDGS-Bridge (`vdgs-slot-board/bridge/vdgs_bridge.py`): Sie liefert das Pad unter `http://<PC>:8770/pad/`
aus (von GitHub Pages, mit Offline-Kopie; Test: `--pad-dir`), dann fragt `js/sim.js` `/sim` alle 2 s ab. Von github.io aus geht das
nur mit Bridge-Adresse in den Einstellungen (`settings.bridge`) und wenn der Browser es erlaubt (https → Heimnetz ist meist blockiert).
GSX: L:-Variablen `FSDT_GSX_*` (Namen, Status 1–7 und Menünummern wie im freien Fenix2GSX), Dienste rufen über `/gsx/call`
(Menü öffnen `FSDT_GSX_MENU_OPEN=1`, Auswahl `FSDT_GSX_MENU_CHOICE = Nummer−1`). Fenix: Port 8083 (EFB als Webseite, GraphQL
`dataRef(name)`; Fenix veröffentlicht die Namen nicht – nur echte, geprüfte Namen in `FENIX_REFS` eintragen).
Namen bewusst eigen: „Turnaround“ (nicht „Ground“), „Fenix EFB“ (das EFB gehört Fenix Simulations, das Pad öffnet es nur).
Testen ohne Simulator: Bridge mit `--test-gsx --pad-dir <pad>` starten und `http://localhost:8770/pad/?demo=ground&unlock` öffnen.

## 2.4 Checklist, Landing, Konto

- **Checklist** (`js/apps/checklist.js`) und **Landing** (`js/apps/landing.js`): Inhalte nur aus Unterlagen der VA, je Typ in `va/checklists.json`
  (heute A320-Familie, Karte Februar 2022) und `va/landing.json` (heute Embraer E190/E195: Windgrenzen, Autobrake, Vapp). Typauswahl `js/fleet.js`.
  Für andere Typen nichts erfinden – die VA trägt sie ein. Windrechner (aus der Excel-Tabelle der VA) für alle Typen; Seite über 360° korrekt.
  Start-/Landeperformance bleibt SimBriefs Runway Analysis (ASL Fly → Performance). Die Embraer-Diagramme (S. 4–9) sind nicht übernommen.
- **Konto** (`js/account.js`): Anmeldung mit VATSIM-CID + PIN gegen das Pilot-Dashboard (`https://airserbia-virtual.pages.dev`, Token statt Cookie,
  `asl.account`); das Profil (SimBrief, CID, IVAO, Hoppie) wird übernommen. Auf localhost zum Testen `asl.dash` = lokales Dashboard.
- **Nur ASL-Flugpläne**: `pollSimbrief` lädt nur OFPs, deren Callsign mit `ASL` beginnt (`S.ofpErr = "notasl"`).

## 2.5 Bildschirm an, Töne

`js/wake.js`: Screen Wake Lock (iPad ab iOS 16.4), Einstellung `settings.awake` (Standard an), nach Hintergrund/erster Berührung neu holen.
`js/sound.js`: Töne nur per Web Audio, eigene Klänge (keine Aufnahmen): `cpdlc` (ATC-Gong bei CPDLC aus `js/hoppie.js`), `msg`, `atis`, `slot`;
iOS braucht die erste Berührung. `js/alerts.js`: Ton + Mitteilung bei Änderung von TSAT/CTOT/TOBT/Off-Block (3 h vor Off-Block) und neuer ATIS.

## 2.6 Ohne vAMSYS, echte ATIS

**vAMSYS ist ganz entfernt** (Wunsch des Nutzers, dauerhaft: „es wird nichts über vAMSYS gemacht“). Es gibt nur noch das Konto (`js/account.js`,
VATSIM-CID + PIN gegen das Dashboard); `pilot()` liefert Name, CID, VATSIM-Rating und die Dashboard-Buchungen für Crew-Ausweis, Dienstplan,
Kalender und Home. Keine Pflicht-Anmeldung (der alte vAMSYS-Schalter ist weg). Nichts mehr mit vAMSYS einbauen.
ATIS: VATSIM zuerst; ist keine online, die echte D-ATIS von `atis.info/api/<ICAO>` (nur US-Flughäfen, `realAtis` in `js/data.js`,
`a.real = true`); sonst die Piste aus dem echten METAR-Wind (`runwayFromWind`). Europa hat keine freie echte ATIS – nicht scrapen.
Hoppie-Feld ist `type=text` mit `class="masked"` (kein „Passwort speichern?“ des Browsers); nur CID+PIN ist ein echtes Login-Formular.

## Updates

Jede sichtbare Neuerung als neuer Eintrag oben in `js/whatsnew.js` (nur, was das Pad wirklich kann). Das Pad zeigt ihn einmal
nach dem Update („What's new“, `asl.seen`); `node tools/whatsnew-card.mjs sr out.png` macht daraus die Discord-Grafik.
Eigener Stil in Air-Serbia-Farben, nicht das Layout oder die Texte von LH Virtual nachbauen.

## Testen

```
node tests/smoke.mjs                 # Fluglogik, Übersetzungen, alle Apps und Reiter im Browser
node tests/smoke.mjs --shots shots/  # dazu Screenshots (iPad 1180x820) – Ordner nicht committen
```
Braucht Playwright mit Chromium für den Browser-Teil. SimBrief, VATSIM, Kartenkacheln und das Logo sind in Testumgebungen
meist nicht erreichbar; darum läuft der Test mit dem Demoflug (nur auf localhost möglich). Screenshots vor dem Zeigen selbst ansehen.

## Commits

Autor `sbelic95 <119758002+sbelic95@users.noreply.github.com>`. Nach dem Push prüfen, ob die Seite neu gebaut wurde
(Actions-Lauf „pages-build-deployment“ mit dem neuen Commit).

## Offen

- Feldnamen der SimBrief-Runway-Analysis (`tlr.takeoff.runway[].speeds_v1` usw.) stammen aus einem Forenbeispiel; mit einem echten OFP des Nutzers gegenprüfen (Einheiten: Längen in m?).
- Ideen: Live-FOB, Position und COM1 aus dem Simulator über die Bridge des VDGS (`bridge/vdgs_bridge.py`; braucht http im Heimnetz), weitere SimBrief-Airframes (A320, A330, ATR) in `FLEET` in `js/apps/ops.js`, Push-Hinweise.
