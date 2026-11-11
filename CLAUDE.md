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
- Ideen: Live-FOB und Position aus dem Simulator über die Bridge des VDGS (`bridge/vdgs_bridge.py`), weitere SimBrief-Airframes (A320, A330, ATR) in `FLEET` in `js/apps/ops.js`, Push-Hinweise.
