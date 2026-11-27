#!/usr/bin/env python3
"""Air Serbia Virtual schedule → ASL Pad.

Reads the vAMSYS import files of the VA (CSV) and writes the pad's network files:
  va/routes.json  airports, routes (both ways, with the types flown) and every scheduled flight
  va/fleet.json   every aircraft with registration and type

    python3 tools/import-schedule.py <folder with the CSVs>

Expected files in the folder (the month in the name may change):
  ASL_Passenger_Schedule_*.csv, ASL_airports_*.csv, ASL_fleet_*.csv, ASL_Aircraft_*.csv
Times in the schedule are UTC, as in vAMSYS. Run it again whenever the VA publishes a new schedule.
"""
import csv, glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

def one(folder, pattern):
    hits = sorted(glob.glob(os.path.join(folder, pattern)))
    if not hits:
        sys.exit("missing " + pattern + " in " + folder)
    return hits[-1]

def rows(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def main(folder):
    sched, apts, fleet, acs = (one(folder, p) for p in ("ASL_Passenger_Schedule_*.csv", "ASL_airports_*.csv", "ASL_fleet_*.csv", "ASL_Aircraft_*.csv"))
    db = json.load(open(os.path.join(ROOT, "airports.json"), encoding="utf-8"))  # [lat, lon, city, tz] by ICAO
    old = {}
    try:
        old = json.load(open(os.path.join(ROOT, "va", "routes.json"), encoding="utf-8")).get("airports", {})
    except Exception:
        pass
    type_of = {r["Name"].strip(): r["Type Code"].strip() for r in rows(fleet)}

    airports = {}
    for r in rows(apts):
        icao = r["ICAO/IATA"].strip().upper()
        d = db.get(icao)
        if not d:
            print("not in airports.json, skipped:", icao)
            continue
        city = old.get(icao, {}).get("name") or (d[2] or "").replace("-", " ") or r["Name"].strip()
        airports[icao] = {"name": city, "full": r["Name"].strip(), "lat": round(d[0], 2), "lon": round(d[1], 2)}

    flights, pairs = [], {}
    for r in rows(sched):
        if r.get("Is Hidden", "").upper() == "TRUE" or r.get("_delete", "").upper() == "TRUE":
            continue
        dep, arr = r["Departure Airport (ICAO/IATA)"].strip().upper(), r["Arrival Airport (ICAO/IATA)"].strip().upper()
        if dep not in airports or arr not in airports:
            print("airport missing, flight skipped:", r["Flight Number"], dep, arr)
            continue
        fleet_name = r["Fleet IDs"].split("@")[0].strip()
        typ = type_of.get(fleet_name, "")
        days = sorted({DAYS.index(x.strip().lower()) + 1 for x in r["Service Days"].split(",") if x.strip().lower() in DAYS})
        rem = r.get("Remarks", "").strip()
        term = gate = ""
        for part in rem.split("|"):
            p = part.strip()
            if p.lower().startswith("departure terminal"):
                term = p[len("departure terminal"):].strip()
            elif p.lower().startswith("departure gate"):
                gate = p[len("departure gate"):].strip()
        flights.append({"no": r["Flight Number"].strip(), "cs": r["Callsign"].strip(), "dep": dep, "arr": arr,
                        "std": r["Departure Time (HH:MM)"].strip(), "sta": r["Arrival Time (HH:MM)"].strip(),
                        "blk": r["Flight Length (HH:MM)"].strip(), "nm": int(r["Flight Distance (NM)"] or 0) or None,
                        "days": days, "type": typ, "fleet": fleet_name, "term": term, "gate": gate})
        key = tuple(sorted((dep, arr)))
        pairs.setdefault(key, set()).add(typ)

    order = ["A319", "A320", "E195", "AT76", "A332"]
    routes = [{"from": a, "to": b, "types": sorted(t for t in ts if t) or ["A319"]} for (a, b), ts in sorted(pairs.items())]
    for r in routes:
        r["types"].sort(key=lambda t: order.index(t) if t in order else 99)
    flights.sort(key=lambda f: (f["dep"] != "LYBE", f["dep"], f["std"], f["no"]))
    used = {f["dep"] for f in flights} | {f["arr"] for f in flights}
    out = {
        "_help": "Red letenja Air Serbia Virtual (iz vAMSYS uvoza VA). Ne menjaj ručno – pokreni: python3 tools/import-schedule.py <folder sa CSV>. Vremena su UTC.",
        "proposal": False, "source": os.path.basename(sched), "base": "LYBE",
        "airports": {k: v for k, v in sorted(airports.items()) if k in used},
        "routes": routes, "flights": flights,
    }
    json.dump(out, open(os.path.join(ROOT, "va", "routes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    aircraft = []
    for r in rows(acs):
        if r.get("_delete", "").upper() == "TRUE":
            continue
        name = r["Name"].strip()
        aircraft.append({"reg": r["Registration"].strip().upper(), "type": type_of.get(name, ""), "name": name, "selcal": r.get("SELCAL", "").strip()})
    aircraft.sort(key=lambda a: (order.index(a["type"]) if a["type"] in order else 99, a["reg"]))
    json.dump({"_help": "Flota Air Serbia Virtual (iz vAMSYS uvoza VA). Pokreni tools/import-schedule.py za novu verziju.",
               "source": os.path.basename(acs), "aircraft": aircraft},
              open(os.path.join(ROOT, "va", "fleet.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(flights), "flights,", len(routes), "routes,", len(out["airports"]), "airports,", len(aircraft), "aircraft")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
