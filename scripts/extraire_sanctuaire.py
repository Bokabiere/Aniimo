"""Extrait les plans du Sanctuaire perdu (usage personnel, avec accord de l'auteur d'AniimoTools).

Source : https://aniimotools.dev/fr/map/lost-sanctum/
Produit : src/data/sanctuaire_plans.json + public/aniimo/sanctuaire/*.webp
"""
import json
import re
import urllib.request
from pathlib import Path

BASE = "https://aniimotools.dev"
URL = BASE + "/fr/map/lost-sanctum/"
RACINE = Path(__file__).resolve().parent.parent
SORTIE_JSON = RACINE / "src" / "data" / "sanctuaire_plans.json"
DOSSIER_IMG = RACINE / "public" / "aniimo" / "sanctuaire"

UA = {"User-Agent": "Mozilla/5.0 (usage personnel)"}


def telecharger(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    html = telecharger(URL).decode("utf-8")
    (DOSSIER_IMG / "maps").mkdir(parents=True, exist_ok=True)
    (DOSSIER_IMG / "marks").mkdir(parents=True, exist_ok=True)

    plans = {}
    for bloc in re.split(r'<button type="button" class="ls-card"', html)[1:]:
        bloc = bloc.split("</button>")[0]
        m = re.match(r'\s*data-plan="(\d+)" data-dir="(\w+)"', bloc)
        if not m or m.group(1) in plans:
            continue
        pid, direction = m.group(1), m.group(2)
        numero = re.search(r"<b>Plan (\d+)</b>", bloc).group(1)
        libelle = re.search(r'ls-card__dir">([^<]*)<', bloc).group(1)
        rare = "plus rare" in bloc.lower() or "ls-card__rare" in bloc
        ratio = re.search(r"--r:([\d.]+)", bloc)

        pic = bloc.split('class="ls-card__plate"')[0]
        pins = []
        for t in re.finditer(
            r'<img class="ls-card__pin[^"]*" src="/assets/lost-sanctum/marks/([\w-]+)\.webp" '
            r'style="left:([\d.]+)%;top:([\d.]+)%"', pic):
            pins.append({"type": t.group(1), "x": float(t.group(2)), "y": float(t.group(3))})
        depart = re.search(r'ls-card__start" style="left:([\d.]+)%;top:([\d.]+)%', pic)

        plate = bloc.split('class="ls-card__counts"')[-1]
        comptes = {}
        for c in re.finditer(r'marks/([\w-]+)\.webp"[^>]*>(\d+)</span>|chest-gold\.webp"[^>]*>(\d+)</span>', plate):
            if c.group(1):
                comptes[c.group(1)] = int(c.group(2))
            else:
                comptes["chest-gold"] = int(c.group(3))

        plans[pid] = {
            "id": pid,
            "numero": int(numero),
            "direction": direction,
            "libelle": libelle,
            "rare": bool(rare),
            "ratio": float(ratio.group(1)) if ratio else None,
            "image": f"aniimo/sanctuaire/maps/{pid}-thumb.webp",
            "depart": {"x": float(depart.group(1)), "y": float(depart.group(2))} if depart else None,
            "pins": pins,
            "comptes": comptes,
        }

    liste = sorted(plans.values(), key=lambda p: p["numero"])
    SORTIE_JSON.write_text(json.dumps(liste, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(liste)} plans -> {SORTIE_JSON}")

    assets = set(re.findall(r'/assets/lost-sanctum/((?:maps|marks)/[\w-]+\.webp)', html))
    assets |= {"chest-gold.webp", "chest-blue.webp", "chest-green.webp", "chest-purple.webp"}
    for a in sorted(assets):
        dest = DOSSIER_IMG / a
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            dest.write_bytes(telecharger(f"{BASE}/assets/lost-sanctum/{a}"))
    print(f"{len(assets)} images -> {DOSSIER_IMG}")


if __name__ == "__main__":
    main()
