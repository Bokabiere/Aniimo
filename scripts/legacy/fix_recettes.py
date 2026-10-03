import sys
sys.stdout.reconfigure(encoding='utf-8')
from bs4 import BeautifulSoup
import json, re

html_file = r"C:\Users\y007\.gemini\antigravity\brain\8ff53348-84e1-4828-af4a-4e7ac4c38a10\.system_generated\steps\182\content.md"
with open(html_file, 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

curated_file = r"c:\IA\Projets\Aniimo\logis-manager\src\data\recettes.json"
with open(curated_file, 'r', encoding='utf-8') as f:
    existing = json.load(f)

# Keep the base curated recipes from r1 to r18
base_recipes = [r for r in existing if r.get('id', '').startswith('r') and int(r.get('id')[1:]) <= 18]
print(f"Base curated recipes kept: {len(base_recipes)}")
for b in base_recipes:
    print(f"  {b['id']}: {b['nom']} ({b['structure']})")

known_names = {r['nom'].lower().strip() for r in base_recipes}

cards = soup.find_all(class_=re.compile(r'fac__card'))
print(f"Found {len(cards)} fac__card elements")

new_recipes = []
r_id = 100

for card in cards:
    name_el = card.find(class_=re.compile(r'fac__name'))
    if name_el:
        structure_name = name_el.get_text(strip=True)
    else:
        h = card.find(['h2', 'h3', 'h4'])
        structure_name = h.get_text(strip=True) if h else "Autre"
    
    structure_name = structure_name.strip()
    
    tiers = card.find_all(class_=re.compile(r'fac__tier'))
    for tier in tiers:
        prods = tier.find_all('li')
        for prod in prods:
            classes = prod.get('class', [])
            if 'fac__prod--recipe' not in classes:
                continue
            
            name_span = prod.find(class_=re.compile(r'fac__prod-name'))
            if not name_span:
                continue
            output_name = name_span.get_text(strip=True)
            if not output_name:
                continue
            
            clean_name = output_name.strip()
            if clean_name.lower() in known_names:
                continue
            
            title = prod.get('title', '')
            inputs = {}
            if "partir de" in title:
                clean_title = title.split("partir de")[-1]
                parts = clean_title.split("+")
                for p in parts:
                    m = re.search(r'(.*?)[^\w\s]+(\d+)', p.strip())
                    if m:
                        in_name = m.group(1).strip()
                        in_qty = int(m.group(2))
                        inputs[in_name] = in_qty
                    else:
                        m = re.search(r'(.*?)\s+(\d+)$', p.strip())
                        if m:
                            in_name = m.group(1).strip()
                            in_qty = int(m.group(2))
                            inputs[in_name] = in_qty

            new_recipes.append({
                "id": f"r{r_id}",
                "nom": clean_name,
                "structure": structure_name,
                "w": 1,
                "h": 1,
                "tempsMin": 30,
                "input": inputs,
                "output": { clean_name: 1 },
                "profit": 0,
                "capacite": "Fabrication",
                "color": "bg-slate-600"
            })
            known_names.add(clean_name.lower())
            r_id += 1

print(f"Extracted {len(new_recipes)} additional recipes.")
from collections import Counter
structures_counter = Counter(r['structure'] for r in new_recipes)
print("Structures found and counts:")
for s, count in sorted(structures_counter.items()):
    print(f"  {s}: {count}")

all_combined = base_recipes + new_recipes
print(f"Total recipes in DB: {len(all_combined)}")

# Check 'Planches standard'
planches = [r for r in all_combined if 'planche' in r['nom'].lower()]
print(f"Planche recipes in new DB ({len(planches)}):")
for p in planches:
    print(f"  {p['id']}: {p['nom']} ({p['structure']}) -> {p['input']}")

with open(curated_file, 'w', encoding='utf-8') as f:
    json.dump(all_combined, f, indent=2, ensure_ascii=False)
print("Successfully wrote updated recettes.json!")
