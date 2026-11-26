"""Step 1 of the data pipeline (GDD section 10): download each source into data/raw,
recording the fetch date and a SHA-256 so every bundle is pinned to an exact file."""
import hashlib, json, pathlib, subprocess, sys, urllib.request, datetime

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
SOURCES = json.loads((pathlib.Path(__file__).parent / "sources.json").read_text())

def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for key, src in SOURCES.items():
        dest = RAW / src["file"]
        if not dest.exists() or "--force" in sys.argv:
            print(f"fetching {key} …")
            try:
                req = urllib.request.Request(src["url"], headers={"User-Agent": "needle-and-pin-data-pipeline"})
                with urllib.request.urlopen(req, timeout=120) as r:
                    dest.write_bytes(r.read())
            except Exception as e:  # some hosts reject Python's TLS handshake; curl copes
                print(f"  urllib failed ({e.__class__.__name__}), retrying with curl")
                subprocess.run(["curl", "-sSfL", "-o", str(dest), src["url"]], check=True)
        sha = hashlib.sha256(dest.read_bytes()).hexdigest()
        manifest[key] = {"file": src["file"], "sha256": sha, "bytes": dest.stat().st_size,
                         "fetched": datetime.date.fromtimestamp(dest.stat().st_mtime).isoformat()}
        print(f"  {key}: {dest.stat().st_size} bytes sha256={sha[:12]}")
    (RAW / "manifest.json").write_text(json.dumps(manifest, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())
