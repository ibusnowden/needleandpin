"""Checks every Arabic Ghazali quotation in the codex against the text of the edition it cites,
fetched from al-Maktaba al-Shamila (Ihya': Dar al-Ma'rifa, Beirut, book 9472; al-Mustasfa: ed.
'Abd al-Shafi, Dar al-Kutub al-'Ilmiyya, book 5459). Matching ignores diacritics and alif/ya/ta-marbuta
spelling variants. Each "…"-separated segment must appear on the cited page or the next one.
Sets status "verified-dar-al-marifa" or "not-found". (A Dar al-Minhaj cross-check is still a manual step.)"""
import html, json, pathlib, re, subprocess, sys, time

ROOT = pathlib.Path(__file__).resolve().parents[2]
CODEX = ROOT / "src" / "content" / "codex.json"
CACHE = ROOT / "data" / "raw" / "shamela"
TASH = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")

def norm(s):
    s = TASH.sub("", s)
    s = re.sub("[إأآٱ]", "ا", s).replace("ى", "ي").replace("ة", "ه")
    s = re.sub(r"[^ء-ي ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def page(book, pid):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{book}-{pid}.txt"
    if not f.exists():
        s = subprocess.run(["curl", "-sL", "-A", "Mozilla/5.0", f"https://shamela.ws/book/{book}/{pid}"], capture_output=True, text=True).stdout
        m = re.search(r'class="nass[^"]*"[^>]*>(.*?)<div class="text-center', s, re.S) or re.search(r'class="nass[^"]*"[^>]*>(.*)', s, re.S)
        f.write_text(html.unescape(re.sub(r"<[^>]+>", " ", m.group(1))) if m else "")
        time.sleep(0.4)
    txt = f.read_text()
    txt = re.split(r"تحميل الصفحة التالية|تحميل الصفحة السابقة", txt)[0]  # drop the site's navigation
    return norm(txt.replace("الصفحة الحالية:", ""))

def main():
    codex = json.loads(CODEX.read_text())
    bad = 0
    for e in codex:
        q = e.get("quote") or {}
        if q.get("lang") != "ar" or not q.get("text"):
            continue
        m = re.match(r"https://shamela.ws/book/(\d+)/(\d+)", e.get("read") or "")
        if not m:
            print("NO SOURCE", e["id"]); bad += 1; continue
        book, pid = m.group(1), int(m.group(2))
        hay = page(book, pid) + " " + page(book, pid + 1)
        segs = [norm(s) for s in q["text"].split("…") if norm(s)]
        ok = all(s in hay for s in segs)
        if q["status"] != "verified-edition":
            q["status"] = "verified-dar-al-marifa" if ok else "not-found"
        print(("ok      " if ok else "MISSING ") + e["id"])
        bad += 0 if ok else 1
    CODEX.write_text(json.dumps(codex, ensure_ascii=False, indent=2) + "\n")
    print("ghazali quotes:", "all found" if not bad else f"{bad} problems")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main())
