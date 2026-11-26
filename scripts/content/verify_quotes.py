"""Checks every Smith quote in the codex verbatim against the Project Gutenberg text of
The Wealth of Nations (ebook #3300), and marks each one verified or not (GDD §3 accuracy rules).
Ghazali quotes are left as they are: they must be checked by hand against the Dar al-Minhaj edition."""
import json, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "wealth_of_nations_pg3300.txt"
CODEX = ROOT / "src" / "content" / "codex.json"
URLS = ["https://www.gutenberg.org/cache/epub/3300/pg3300.txt", "https://gutenberg.pglaf.org/3/3/0/3300/3300-0.txt"]

def norm(s: str) -> str:
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", s).strip().lower()

def main() -> int:
    if not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        for url in URLS:  # the main site sometimes refuses automated clients; the PGLAF mirror is official
            if subprocess.run(["curl", "-sSfL", "-o", str(RAW), url]).returncode == 0:
                break
        else:
            raise SystemExit("could not download the Gutenberg text")
    text = norm(RAW.read_text(encoding="utf-8", errors="replace"))
    codex = json.loads(CODEX.read_text())
    bad = 0
    for e in codex:
        q = e.get("quote") or {}
        if q.get("lang") != "en" or not q.get("text"):
            continue
        ok = norm(q["text"]) in text
        q["status"] = "verified-gutenberg" if ok else "not-found"
        print(("ok      " if ok else "MISSING ") + e["id"] + ": " + q["text"][:70])
        bad += 0 if ok else 1
    CODEX.write_text(json.dumps(codex, ensure_ascii=False, indent=2) + "\n")
    print("quotes:", "all verified" if not bad else f"{bad} not found")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
