import sys
sys.stdout.reconfigure(encoding='utf-8')
import json

recettes = json.load(open('src/data/recettes.json', encoding='utf-8'))
graines = json.load(open('src/data/graines_db.json', encoding='utf-8'))

for g in graines[:20]:
    c_name = g['culture'].lower().strip()
    match = None
    for r in recettes:
        r_name = r['nom'].lower().strip()
        if r_name == c_name or r_name == f'champ {c_name}' or r_name == f'arbre à {c_name}' or c_name in r_name:
            match = r
            break
    if match:
        print(f"OK: {g['culture']} -> {match['nom']} ({match['id']}, {match['structure']})")
    else:
        print(f"MISSING: {g['culture']}")
