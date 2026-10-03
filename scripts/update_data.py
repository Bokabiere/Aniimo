#!/usr/bin/env python3
"""Point d'entrée unique pour mettre à jour et contrôler les données de logis-manager.

    python scripts/update_data.py check            # compare src/data aux références (code retour 1 si écart)
    python scripts/update_data.py apply            # montre ce qui serait corrigé (aucune écriture)
    python scripts/update_data.py apply --write    # applique les corrections (sauvegarde d'abord les fichiers)
    python scripts/update_data.py report           # états des lieux : recettes, gabarits, éléments non vérifiés

Les valeurs de référence vivent dans scripts/reference/*.json (source et date de vérification
indiquées dans chaque fichier). Quand le jeu change : mettez ces fichiers à jour, lancez
`apply --write`, puis `npm test`. Aucune dépendance : bibliothèque standard uniquement.
"""
import argparse
import datetime
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"
REF = Path(__file__).resolve().parent / "reference"


# ---------------------------------------------------------------- utilitaires
def read_text(path):
    return path.read_bytes().decode("utf-8")


def write_text(path, text):
    path.write_bytes(text.encode("utf-8"))


def eol(text):
    return "\r\n" if "\r\n" in text else "\n"


def load_json(path):
    return json.loads(read_text(path))


def ref(name):
    return load_json(REF / name)


def dump_standard(data, newline):
    """Format de recettes.json / graines_db.json : indent 2, accents conservés."""
    return json.dumps(data, ensure_ascii=False, indent=2).replace("\n", newline)


def dump_aniimo(rows):
    out = []
    for a in rows:
        out.append(
            '  { "nom": %s "capacite": %s "nivMax": %d, "element": %s "elements": %s, "score": %d }'
            % (
                (json.dumps(a["nom"], ensure_ascii=False) + ",").ljust(14),
                (json.dumps(a["capacite"], ensure_ascii=False) + ",").ljust(13),
                a["nivMax"],
                (json.dumps(a["element"], ensure_ascii=False) + ",").ljust(11),
                json.dumps(a.get("elements", [a["element"]]), ensure_ascii=False),
                a["score"],
            )
        )
    return "[\n" + ",\n".join(out) + "\n]\n"


def dump_niveaux(rows):
    out = []
    for n in rows:
        mat = ""
        if n.get("materiaux"):
            mat = ", \"materiaux\": [" + ", ".join(
                '{ "nom": %s, "qte": %d }' % (json.dumps(m["nom"], ensure_ascii=False), m["qte"])
                for m in n["materiaux"]
            ) + "]"
        out.append(
            "  { %s %s %s %s %s %s \"argile\": %d%s }"
            % (
                ('"niveau": %d,' % n["niveau"]).ljust(13),
                ('"aniimo": %d,' % n["aniimo"]).ljust(13),
                ('"dureeMin": %s,' % json.dumps(n["dureeMin"])).ljust(18),
                ('"pieces": %d,' % n["pieces"]).ljust(19),
                ('"bois": %d,' % n["bois"]).ljust(13),
                ('"sable": %d,' % n["sable"]).ljust(14),
                n["argile"],
                mat,
            )
        )
    return "[\n" + ",\n".join(out) + "\n]\n"


# ---------------------------------------------------------------- corrections
class Change:
    def __init__(self, fichier, libelle):
        self.fichier, self.libelle = fichier, libelle

    def __str__(self):
        return f"  {self.fichier}: {self.libelle}"


def plan_elements():
    rows = load_json(DATA / "aniimo_db.json")
    ref_el = ref("aniimo_elements.json")["elements"]
    changes, unverified = [], []
    # Nouveaux Aniimo (fiches relevées sur aniimotools.dev)
    connus = {a["nom"] for a in rows}
    for n in ref("aniimo_nouveaux.json")["aniimo"]:
        if n["nom"] not in connus:
            rows.append(dict(n))
            changes.append(Change("aniimo_db.json", f"{n['nom']} : ajouté ({n['element']}, {n['capacite']})"))
    for a in rows:
        wanted = ref_el.get(a["nom"])
        if wanted is None:
            unverified.append(a["nom"])
            a.setdefault("elements", [a["element"]])
            continue
        if a["element"] not in wanted:
            changes.append(Change("aniimo_db.json", f"{a['nom']} : {a['element']} → {wanted[0]}"))
            a["element"] = wanted[0]
        if a.get("elements") != wanted:
            changes.append(Change("aniimo_db.json", f"{a['nom']} : elements {a.get('elements')} → {wanted}"))
            a["elements"] = list(wanted)
    return rows, changes, unverified


def plan_niveaux():
    rows = load_json(DATA / "niveaux.json")
    wanted = {n["niveau"]: n for n in ref("rv_levels.json")["niveaux"]}
    changes = []
    for i, n in enumerate(rows):
        w = wanted.get(n["niveau"])
        if w is None:
            continue
        for key, val in w.items():
            if n.get(key) != val:
                changes.append(Change("niveaux.json", f"niveau {n['niveau']} : {key} {n.get(key)} → {val}"))
                rows[i][key] = val
    return rows, changes


def plan_graines():
    rows = load_json(DATA / "graines_db.json")
    changes = []
    for fix in ref("graines_niveaux.json")["niveaux"]:
        hit = [g for g in rows if g["raw_text"].startswith(fix["match"])]
        if not hit:
            changes.append(Change("graines_db.json", f"{fix['match']} : ligne introuvable (référence obsolète ?)"))
        for g in hit:
            if g["niveau_requis"] != fix["niveau_requis"]:
                changes.append(Change("graines_db.json", f"{fix['match']} : niveau {g['niveau_requis']} → {fix['niveau_requis']}"))
                g["niveau_requis"] = fix["niveau_requis"]
    return rows, changes


def plan_recettes():
    rows = load_json(DATA / "recettes.json")
    by_id = {r["id"]: r for r in rows}
    changes = []
    for rid, fields in ref("recettes_overrides.json")["recettes"].items():
        r = by_id.get(rid)
        if r is None:
            changes.append(Change("recettes.json", f"{rid} : recette introuvable"))
            continue
        for key, val in fields.items():
            if r.get(key) != val:
                changes.append(Change("recettes.json", f"{rid} ({r['nom']}) : {key} {r.get(key)} → {val}"))
                r[key] = val
    return rows, changes


def plan_all():
    el_rows, el_ch, unverified = plan_elements()
    nv_rows, nv_ch = plan_niveaux()
    gr_rows, gr_ch = plan_graines()
    re_rows, re_ch = plan_recettes()
    return {
        "aniimo_db.json": (el_rows, el_ch),
        "niveaux.json": (nv_rows, nv_ch),
        "graines_db.json": (gr_rows, gr_ch),
        "recettes.json": (re_rows, re_ch),
    }, unverified


def serialize(name, rows, original_text):
    nl = eol(original_text)
    if name == "aniimo_db.json":
        return dump_aniimo(rows).replace("\n", nl)
    if name == "niveaux.json":
        return dump_niveaux(rows).replace("\n", nl)
    tail = nl if original_text.endswith("\n") else ""
    return dump_standard(rows, nl) + tail


def roundtrip_ok(name):
    """Vérifie que l'écriture reproduit le fichier actuel à l'octet près (sinon on n'écrit pas)."""
    path = DATA / name
    text = read_text(path)
    return serialize(name, json.loads(text), text) == text


# ---------------------------------------------------------------- commandes
def cmd_check(_args):
    plan, unverified = plan_all()
    total = 0
    for name, (_rows, changes) in plan.items():
        if changes:
            print(f"✗ {name} : {len(changes)} écart(s) avec la référence")
            for c in changes:
                print(c)
            total += len(changes)
        else:
            print(f"✓ {name}")
    if unverified:
        print(f"ℹ {len(unverified)} Aniimo sans référence d'élément : {', '.join(unverified)}")
    if total:
        print(f"\n{total} écart(s). Lancez « python scripts/update_data.py apply --write » pour les corriger.")
        return 1
    print("\nDonnées conformes aux références.")
    return 0


def cmd_apply(args):
    plan, _ = plan_all()
    todo = {n: p for n, p in plan.items() if p[1]}
    if not todo:
        print("Rien à corriger : les données sont déjà conformes.")
        return 0
    for name, (_rows, changes) in todo.items():
        print(f"{name} : {len(changes)} correction(s)")
        for c in changes:
            print(c)
    if not args.write:
        print("\nSimulation uniquement. Ajoutez --write pour appliquer.")
        return 0
    for name in todo:
        if not roundtrip_ok(name):
            print(f"✗ {name} : le format actuel n'est pas reproductible à l'identique, écriture annulée.", file=sys.stderr)
            return 2
    backup = DATA / f"_backup_{datetime.date.today().isoformat()}"
    backup.mkdir(exist_ok=True)
    for name, (rows, _c) in todo.items():
        target = DATA / name
        if not (backup / name).exists():
            shutil.copy2(target, backup / name)
        write_text(target, serialize(name, rows, read_text(target)))
        json.loads(read_text(target))  # contrôle de validité
    print(f"\n✓ Corrections écrites. Originaux sauvegardés dans {backup.relative_to(ROOT)}")
    return 0


def cmd_report(_args):
    rec = load_json(DATA / "recettes.json")
    gabarits = [r for r in rec if re.fullmatch(r"r\d{3}", r["id"]) and r["w"] == 1 and r["h"] == 1 and r["tempsMin"] == 30 and r["profit"] == 0]
    structures = sorted({r["structure"] for r in gabarits})
    print(f"Recettes : {len(rec)} dont {len(gabarits)} gabarits à compléter (1×1, 30 min, profit 0)")
    print(f"  structures concernées ({len(structures)}) : {', '.join(structures)}")
    _, _, unverified = plan_elements()
    print(f"Aniimo : {len(load_json(DATA / 'aniimo_db.json'))} dont {len(unverified)} sans référence ({', '.join(unverified) or '—'})")
    gr = load_json(DATA / "graines_db.json")
    verified = len(ref("graines_niveaux.json")["niveaux"])
    print(f"Graines : {len(gr)} lignes, {verified} niveaux requis vérifiés en ligne")
    print(f"Niveaux : {len(load_json(DATA / 'niveaux.json'))} niveaux (2 à 20)")
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check", help="compare les données aux références").set_defaults(fn=cmd_check)
    a = sub.add_parser("apply", help="corrige les données d'après les références")
    a.add_argument("--write", action="store_true", help="écrit réellement les fichiers")
    a.set_defaults(fn=cmd_apply)
    sub.add_parser("report", help="état des lieux des données").set_defaults(fn=cmd_report)
    args = p.parse_args()
    sys.exit(args.fn(args))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
