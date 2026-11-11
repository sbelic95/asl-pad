# ASL Pad

Crew-Pad für virtuelle **Air Serbia**-Flüge im Flugsimulator (MSFS 2024, VATSIM). Läuft im Browser auf dem iPad,
am besten als App auf dem Home-Bildschirm (Safari → Teilen → Zum Home-Bildschirm).

> Inoffizielles Fanprojekt. Nicht mit Air Serbia verbunden. Nur für die Flugsimulation, nicht für die echte Navigation.

**Ausprobieren ohne Flug:** `…/asl-pad/?demo` (JU500 Belgrad – New York im Flug) oder `…/asl-pad/?demo=ground` (am Gate in Belgrad). Das gilt nur für diesen Aufruf; `?demo=off` schaltet eine gespeicherte Demo aus.

## Was drin ist

| Teil | Inhalt |
|---|---|
| **Sperrbildschirm** | Uhr, Flug- und Zeit-Widgets, Hinweise (TSAT, Fuel Check fällig, Stand, ATIS) und die Live-Aktivität des Flugs unten (Strecke, nächster Wegpunkt, FL, FOB, verbleibende NM). Nach oben wischen oder tippen entsperrt. |
| **Home** | Begrüßung, Widgets, App-Raster und Dock. Rote Badges zeigen offene Punkte. |
| **ASL Fly** | Übersicht (Flughäfen mit Wetter und Piste, Phase, nächster Wegpunkt, ETA, OUT/OFF/ON/IN, Treibstoff), Zeiten, Flugplan mit ETA/ATA je Wegpunkt, Karte mit Route, geflogenem Weg und Vertikalprofil, Wetter (METAR, TAF, ATIS), Treibstoff mit Fuel Checks. |
| **ASL Ops** | Dienst-Leiste, To-do, Abflug (Stand, Piste, SID, vIFF-CDM: EOBT/TOBT/TSAT/TTOT/CTOT, Frequenzen) und Ankunft (Stand-Prognose, Piste, STAR, ATIS, Frequenzen). Reiter **Flotte** mit den SimBrief-Airframes der A319 YU-APA bis YU-APE und eigenen Flugzeugen. |
| **Logbuch** | Jeder Flug wird beim On-Block eingetragen. Statistik, Details mit Streckenkarte, Flug von Hand eintragen, CSV-Export, Sicherung und Import (JSON). |
| **Cabin / VDGS** | Öffnet die Air-Serbia-Kabinenanzeige und das VDGS aus `vdgs-slot-board` mit dem Rufzeichen des Flugs. |
| **Home-Knopf** | Oben links in jeder App; führt zurück zum Home-Bildschirm (wie ein Tipp auf den Home-Balken unten). |
| **Einstellungen** | SimBrief-Name oder Pilot-ID, VATSIM-CID, Sprache (Englisch, Srpski, Deutsch), kg / t / lb, hell / dunkel, **Hintergrund** für Sperr- und Home-Bildschirm (sechs Vorlagen oder ein eigenes Foto vom Gerät, abdunkelbar), Auto-Sperre, Demo. |

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
js/demo.js            Demoflug JU500
sw.js                 Offline-Hülle (die App selbst, keine Live-Daten)
```

Neue Texte: englisch im Code mit `t("…")` schreiben und in `js/i18n-dict.js` für `SR` und `DE` ergänzen.

Lizenzen der verwendeten Bibliotheken und Daten: [LIZENZEN.md](LIZENZEN.md).
