"""Steps 2-4 of the data pipeline (GDD section 10): clean, map to the game, bundle.

For each scenario config in scripts/data/scenarios/*.json this reads the pinned raw files,
extracts the configured series, marks every value as observed / interpolated, and writes a
compact JSON bundle to src/data/ghost/<id>.json. No runtime API calls: the game ships this."""
import json, pathlib, subprocess, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from xlsx import read_sheet

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "src" / "data" / "ghost"
HERE = pathlib.Path(__file__).parent
SOURCES = json.loads((HERE / "sources.json").read_text())
MANIFEST = json.loads((RAW / "manifest.json").read_text())

_cache = {}

def maddison():
    if "m" not in _cache:
        rows = read_sheet(RAW / SOURCES["maddison_2023"]["file"], "Full data")
        hdr = rows[0]
        idx = {h: i for i, h in enumerate(hdr)}
        data = {}
        for r in rows[1:]:
            if not r or len(r) <= idx["year"]:
                continue
            for var in ("gdppc", "pop"):
                i = idx[var]
                if i < len(r) and r[i] is not None:
                    data.setdefault((r[idx["countrycode"]], var), {})[int(r[idx["year"]])] = float(r[i])
        _cache["m"] = data
    return _cache["m"]

def clio():
    if "c" not in _cache:
        rows = read_sheet(RAW / SOURCES["clio_real_wage"]["file"], "Data Clio Infra Format")
        hdr = rows[0]
        data = {}
        for r in rows[1:]:
            if not r or len(r) < 2:
                continue
            ser = {int(hdr[i]): float(r[i]) for i in range(2, len(r)) if r[i] is not None}
            data[r[1]] = ser
        _cache["c"] = data
    return _cache["c"]

def allen():
    """Allen's workbook is legacy .xls (BIFF); scripts/data/xls_to_json.mjs converts it."""
    if "a" not in _cache:
        out = subprocess.run(["node", str(HERE / "xls_to_json.mjs"), str(RAW / SOURCES["allen_labourers"]["file"])],
                             check=True, capture_output=True, text=True).stdout
        rows = json.loads(out)
        # Row 9 (0-based 8) holds city names; the WELFARE RATIOS block starts where row 7 says so.
        block = next(i for i, v in enumerate(rows[6]) if v == "WELFARE RATIOS")
        cities = {v: i for i, v in enumerate(rows[8]) if isinstance(v, str) and i >= block}
        data = {}
        for r in rows[9:]:
            if not r or not isinstance(r[0], (int, float)):
                continue
            for city, i in cities.items():
                if i < len(r) and isinstance(r[i], (int, float)) and r[i] > 0:
                    data.setdefault(city, {})[int(r[0])] = float(r[i])
        _cache["a"] = data
    return _cache["a"]

def extract(spec):
    if spec["source"] == "allen_labourers":
        return allen().get(spec["city"], {})
    if spec["source"] == "maddison_2023":
        return maddison().get((spec["country"], spec["variable"]), {})
    if spec["source"] == "clio_real_wage":
        return clio().get(spec["country"], {})
    raise ValueError(spec["source"])

def fill(observed, start, end):
    """Annual series over [start, end] that lies inside the observed span; gaps are linearly
    interpolated and flagged. Years outside the observed span are omitted, never extrapolated."""
    years = sorted(y for y in observed if start <= y <= end)
    if not years:
        return []
    out = []
    for y in range(years[0], years[-1] + 1):
        if y in observed:
            out.append([y, round(observed[y], 4), "observed"])
        else:
            lo = max(k for k in years if k < y)
            hi = min(k for k in years if k > y)
            v = observed[lo] + (observed[hi] - observed[lo]) * (y - lo) / (hi - lo)
            out.append([y, round(v, 4), "interpolated"])
    return out

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for cfg_path in sorted((HERE / "scenarios").glob("*.json")):
        cfg = json.loads(cfg_path.read_text())
        bundle = {"scenario": cfg["id"], "label": cfg["label"], "startYear": cfg["startYear"],
                  "endYear": cfg["endYear"], "series": {}, "sources": {}}
        for name, spec in cfg["series"].items():
            pts = fill(extract(spec), cfg["startYear"], cfg["endYear"])
            src = SOURCES[spec["source"]]
            bundle["series"][name] = {"units": spec["units"], "source": spec["source"], "points": pts}
            bundle["sources"][spec["source"]] = {"title": src["title"], "citation": src["citation"],
                                                 "license": src["license"], "url": src["landing"],
                                                 "sha256": MANIFEST[spec["source"]]["sha256"],
                                                 "fetched": MANIFEST[spec["source"]]["fetched"]}
            print(f"{cfg['id']}.{name}: {len(pts)} points "
                  f"({sum(p[2]=='observed' for p in pts)} observed)"
                  + (f", {pts[0][0]}-{pts[-1][0]}" if pts else ""))
        (OUT / f"{cfg['id']}.json").write_text(json.dumps(bundle, separators=(",", ":")))
    return 0

if __name__ == "__main__":
    sys.exit(main())
