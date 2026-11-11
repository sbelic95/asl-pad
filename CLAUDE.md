# ASL Pad – Hinweise für Claude

Crew-Pad (iPad-Web-App) für **virtuelle Air-Serbia-Flüge** im MSFS 2024 mit SimBrief und VATSIM. Inoffizielles Fanprojekt.
Der Nutzer (sbelic95) schreibt Deutsch; antworte auf Deutsch. Die Oberfläche ist Englisch und umschaltbar auf Srpski und Deutsch.

- Repo: `sbelic95/asl-pad`, Branch `main`. Seite: `https://sbelic95.github.io/asl-pad/` (GitHub Pages aus `main`, Ordner `/`)
- Ausprobieren: `?demo` (JU500 LYBE–KJFK im Flug), `?demo=ground` (am Gate; beides nur für diesen Aufruf, `?demo=off` löscht eine gespeicherte Demo), dazu `&lang=sr|de`, `&app=fly&tab=perf`, `&unlock`
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

## Testen

```
node tests/smoke.mjs                 # Fluglogik, Übersetzungen, alle Apps und Reiter im Browser
node tests/smoke.mjs --shots shots/  # dazu Screenshots (iPad 1180x820) – Ordner nicht committen
```
Braucht Playwright mit Chromium für den Browser-Teil. SimBrief, VATSIM, Kartenkacheln und das Logo sind in Testumgebungen
meist nicht erreichbar; darum läuft der Test mit dem Demoflug. Screenshots vor dem Zeigen selbst ansehen.

## Commits

Autor `sbelic95 <119758002+sbelic95@users.noreply.github.com>`. Nach dem Push prüfen, ob die Seite neu gebaut wurde
(Actions-Lauf „pages-build-deployment“ mit dem neuen Commit).

## Offen

- **GitHub Pages einschalten** (Settings → Pages → Deploy from a branch → `main` / root). Stand 11.11.2026 noch aus; per API vom Agenten aus gesperrt, das muss der Nutzer tun.
- Feldnamen der SimBrief-Runway-Analysis (`tlr.takeoff.runway[].speeds_v1` usw.) stammen aus einem Forenbeispiel; mit einem echten OFP des Nutzers gegenprüfen (Einheiten: Längen in m?).
- Ideen: Live-FOB und Position aus dem Simulator über die Bridge des VDGS (`bridge/vdgs_bridge.py`), weitere SimBrief-Airframes (A320, A330, ATR) in `FLEET` in `js/apps/ops.js`, Push-Hinweise.
