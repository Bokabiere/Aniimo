import sys
sys.stdout.reconfigure(encoding='utf-8')
import json

db_path = r"c:\IA\Projets\Aniimo\logis-manager\src\data\recettes.json"
with open(db_path, 'r', encoding='utf-8') as f:
    recipes = json.load(f)

print(f"Initial recipes: {len(recipes)}")

# 1. Clean seeds from Farm and Pépinière recipes so they are recognized as root producers
for r in recipes:
    if r.get('structure') in ['Ferme', 'Pépinière']:
        cleaned_inputs = {}
        for inp, qty in r.get('input', {}).items():
            # If the input is a seed/grain, remove it
            if any(s in inp.lower() for s in ['graine', 'pépin', 'pepin']):
                continue
            cleaned_inputs[inp] = qty
        r['input'] = cleaned_inputs

# 2. Add base extraction recipes that were missing from Puits, Mine, Zone de coupe, etc.
existing_outputs = set()
for r in recipes:
    for out in r.get('output', {}).keys():
        existing_outputs.add(out.lower())

base_additions = [
    # Zone de coupe
    {
        "id": "base_bois_bloc",
        "nom": "Bloc de bois",
        "structure": "Zone de coupe",
        "w": 2, "h": 2, "tempsMin": 15,
        "input": {},
        "output": { "Bloc de bois": 10 },
        "profit": 20,
        "capacite": "Culture",
        "color": "bg-amber-800"
    },
    {
        "id": "base_bois",
        "nom": "Bois",
        "structure": "Zone de coupe",
        "w": 2, "h": 2, "tempsMin": 15,
        "input": {},
        "output": { "Bois": 10 },
        "profit": 20,
        "capacite": "Culture",
        "color": "bg-amber-800"
    },

    # Puits
    {
        "id": "base_eau_puits",
        "nom": "Eau de puits",
        "structure": "Puits",
        "w": 1, "h": 1, "tempsMin": 10,
        "input": {},
        "output": { "Eau de puits": 15 },
        "profit": 15,
        "capacite": "Transport",
        "color": "bg-blue-600"
    },
    {
        "id": "base_eau_fraiche",
        "nom": "Eau fraîche",
        "structure": "Puits",
        "w": 1, "h": 1, "tempsMin": 15,
        "input": {},
        "output": { "Eau fraîche": 15 },
        "profit": 20,
        "capacite": "Transport",
        "color": "bg-blue-500"
    },
    {
        "id": "base_eau_minerale",
        "nom": "Eau minérale naturelle",
        "structure": "Puits",
        "w": 1, "h": 1, "tempsMin": 20,
        "input": {},
        "output": { "Eau minérale naturelle": 15 },
        "profit": 25,
        "capacite": "Transport",
        "color": "bg-cyan-500"
    },
    {
        "id": "base_eau_rocheuse",
        "nom": "Eau de source des profondeurs rocheuses",
        "structure": "Puits",
        "w": 1, "h": 1, "tempsMin": 25,
        "input": {},
        "output": { "Eau de source des profondeurs rocheuses": 15 },
        "profit": 30,
        "capacite": "Transport",
        "color": "bg-teal-500"
    },
    {
        "id": "base_sel",
        "nom": "Sel de mer",
        "structure": "Puits",
        "w": 1, "h": 1, "tempsMin": 15,
        "input": {},
        "output": { "Sel de mer": 10 },
        "profit": 15,
        "capacite": "Transport",
        "color": "bg-slate-200 text-slate-800"
    },

    # Mine
    {
        "id": "base_roche",
        "nom": "Roche",
        "structure": "Mine",
        "w": 2, "h": 2, "tempsMin": 10,
        "input": {},
        "output": { "Roche": 12 },
        "profit": 15,
        "capacite": "Transport",
        "color": "bg-stone-600"
    },
    {
        "id": "base_argile",
        "nom": "Argile",
        "structure": "Mine",
        "w": 2, "h": 2, "tempsMin": 15,
        "input": {},
        "output": { "Argile": 8 },
        "profit": 25,
        "capacite": "Transport",
        "color": "bg-orange-800"
    },
    {
        "id": "base_sable",
        "nom": "Sable minéral",
        "structure": "Mine",
        "w": 2, "h": 2, "tempsMin": 15,
        "input": {},
        "output": { "Sable minéral": 8 },
        "profit": 25,
        "capacite": "Transport",
        "color": "bg-amber-600"
    },
    {
        "id": "base_coquillage",
        "nom": "Coquillage",
        "structure": "Mine",
        "w": 2, "h": 2, "tempsMin": 20,
        "input": {},
        "output": { "Coquillage": 6 },
        "profit": 30,
        "capacite": "Transport",
        "color": "bg-pink-300 text-pink-900"
    },
    {
        "id": "base_cuivre",
        "nom": "Minerai de cuivre",
        "structure": "Mine",
        "w": 2, "h": 2, "tempsMin": 20,
        "input": {},
        "output": { "Minerai de cuivre": 6 },
        "profit": 35,
        "capacite": "Transport",
        "color": "bg-orange-600"
    },
    {
        "id": "base_quartz",
        "nom": "Minerai de quartz",
        "structure": "Mine",
        "w": 2, "h": 2, "tempsMin": 25,
        "input": {},
        "output": { "Minerai de quartz": 4 },
        "profit": 45,
        "capacite": "Transport",
        "color": "bg-violet-300 text-violet-900"
    },
    {
        "id": "base_gemme",
        "nom": "Gemme",
        "structure": "Mine",
        "w": 2, "h": 2, "tempsMin": 30,
        "input": {},
        "output": { "Gemme": 2 },
        "profit": 60,
        "capacite": "Transport",
        "color": "bg-emerald-500"
    },
    {
        "id": "base_aromathyste",
        "nom": "Aromathyste",
        "structure": "Mine",
        "w": 2, "h": 2, "tempsMin": 25,
        "input": {},
        "output": { "Aromathyste": 4 },
        "profit": 40,
        "capacite": "Transport",
        "color": "bg-purple-600"
    },

    # Autres ressources primaires
    {
        "id": "base_laine",
        "nom": "Laine",
        "structure": "Lit de Cumulaine",
        "w": 2, "h": 2, "tempsMin": 20,
        "input": {},
        "output": { "Laine": 4 },
        "profit": 30,
        "capacite": "Repos",
        "color": "bg-slate-100 text-slate-800"
    },
    {
        "id": "base_petales",
        "nom": "Pétales",
        "structure": "Ferme",
        "w": 2, "h": 2, "tempsMin": 15,
        "input": {},
        "output": { "Pétales": 10 },
        "profit": 20,
        "capacite": "Culture",
        "color": "bg-rose-400"
    },
    {
        "id": "base_perle",
        "nom": "Perle",
        "structure": "Mine",
        "w": 2, "h": 2, "tempsMin": 25,
        "input": {},
        "output": { "Perle": 2 },
        "profit": 50,
        "capacite": "Transport",
        "color": "bg-slate-100 text-slate-800"
    },
    {
        "id": "base_ecailles",
        "nom": "Écailles",
        "structure": "Mine",
        "w": 2, "h": 2, "tempsMin": 20,
        "input": {},
        "output": { "Écailles": 4 },
        "profit": 30,
        "capacite": "Transport",
        "color": "bg-cyan-600"
    },
    {
        "id": "base_etoile",
        "nom": "Étoile",
        "structure": "Hamac d'astrechute",
        "w": 2, "h": 2, "tempsMin": 30,
        "input": {},
        "output": { "Étoile": 2 },
        "profit": 50,
        "capacite": "Repos",
        "color": "bg-yellow-300 text-yellow-900"
    }
]

added_count = 0
for b in base_additions:
    out_key = list(b['output'].keys())[0].lower()
    if out_key not in existing_outputs:
        recipes.append(b)
        existing_outputs.add(out_key)
        added_count += 1
        print(f"Added base producer: {b['nom']} ({b['structure']})")

print(f"Total base producers added: {added_count}")
print(f"Total recipes in DB now: {len(recipes)}")

# Check remaining missing inputs
all_outputs = set()
for r in recipes:
    for out in r.get('output', {}).keys():
        all_outputs.add(out.lower())

still_missing = set()
for r in recipes:
    for inp in r.get('input', {}).keys():
        if inp.lower() not in all_outputs:
            still_missing.add(inp)

print(f"Remaining missing inputs: {len(still_missing)}")
if still_missing:
    print("Still missing:", sorted(still_missing))

with open(db_path, 'w', encoding='utf-8') as f:
    json.dump(recipes, f, indent=2, ensure_ascii=False)
print("Updated recettes.json successfully!")
