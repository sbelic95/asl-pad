"""US CTAF per airport from OurAirports (public domain): python tools/build-ctaf.py <airports.csv> <airport-frequencies.csv> > ctaf-us.json
CTAF where the airport has one; else the tower frequency (in the US the CTAF of a towered airport when the tower is closed)."""
import csv, json, sys

us = {}
with open(sys.argv[1], encoding="utf-8") as f:
    for r in csv.DictReader(f):
        if r["iso_country"] in ("US", "PR", "VI", "GU", "AS", "MP") and r["type"] != "closed":
            us[r["ident"]] = r.get("gps_code") or r["ident"]
out = {}
with open(sys.argv[2], encoding="utf-8") as f:
    rows = [r for r in csv.DictReader(f) if r["airport_ident"] in us]
for kind in ("CTAF", "TWR"):
    for r in rows:
        if r["type"] != kind or "ALT" in (r["description"] or "").upper(): continue
        try: mhz = float(r["frequency_mhz"])
        except ValueError: continue
        if not 108 <= mhz <= 137: continue
        for ident in {r["airport_ident"], us[r["airport_ident"]]}:
            if ident and ident not in out: out[ident] = [f"{mhz:.3f}", 0 if kind == "CTAF" else 1]
json.dump({"_src": "OurAirports (public domain); [MHz, 0 = CTAF, 1 = tower frequency (CTAF when the tower is closed)]", **dict(sorted(out.items()))}, sys.stdout, separators=(",", ":"))
