"""Télécharge les miniatures des Aniimo dans public/aniimo/ (usage hors ligne, plus rapide).

    python scripts/telecharger_miniatures.py

Source : aniimotools.dev. Les fichiers déjà présents sont ignorés. Relancer `npm run build` ensuite.
"""
import re
import sys
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
HOTE = "https://aniimotools.dev/assets/creatures/thumb/"

source = (RACINE / "src/lib/miniatures.js").read_text(encoding="utf-8")
bloc = source.split("export const SLUGS")[1].split("};")[0]
slugs = sorted(set(re.findall(r":\s*'([a-z0-9-]+)'", bloc)))

dest = RACINE / "public" / "aniimo"
dest.mkdir(parents=True, exist_ok=True)
ok = ko = 0
for slug in slugs:
    f = dest / f"{slug}.webp"
    if f.exists() and f.stat().st_size > 0:
        continue
    try:
        req = urllib.request.Request(HOTE + slug + ".webp", headers={"User-Agent": "Mozilla/5.0"})
        f.write_bytes(urllib.request.urlopen(req, timeout=30).read())
        ok += 1
    except Exception as e:  # noqa: BLE001
        ko += 1
        print(f"échec {slug}: {e}", file=sys.stderr)
print(f"{ok} téléchargées, {ko} en échec, {len(slugs)} au total → {dest}")
