"""Step 5 of the data pipeline: every bundled observed value must match the raw source."""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import build

def main():
    failures = 0
    for cfg_path in sorted((build.HERE / "scenarios").glob("*.json")):
        cfg = json.loads(cfg_path.read_text())
        bundle = json.loads((build.OUT / f"{cfg['id']}.json").read_text())
        for name, spec in cfg["series"].items():
            raw = build.extract(spec)
            for y, v, kind in bundle["series"][name]["points"]:
                if kind == "observed" and abs(raw[y] - v) > 1e-3 * max(1, abs(raw[y])):
                    print(f"MISMATCH {cfg['id']}.{name} {y}: bundle {v} vs source {raw[y]}")
                    failures += 1
    print("data check:", "FAIL" if failures else "ok")
    return 1 if failures else 0

if __name__ == "__main__":
    sys.exit(main())
