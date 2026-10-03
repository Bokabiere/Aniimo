from bs4 import BeautifulSoup
import json
import re
import os

html_file = r"C:\Users\y007\.gemini\antigravity\brain\8ff53348-84e1-4828-af4a-4e7ac4c38a10\.system_generated\steps\182\content.md"
with open(html_file, 'r', encoding='utf-8', errors='replace') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

db_path = r"c:\IA\Projets\Aniimo\logis-manager\src\data\recettes.json"
if os.path.exists(db_path):
    with open(db_path, 'r', encoding='utf-8') as f:
        existing_recipes = json.load(f)
else:
    existing_recipes = []

existing_names = {r['nom'] for r in existing_recipes}
new_recipes = []
r_id = 100

articles = soup.find_all(class_=re.compile(r'\bfac\b'))

for art in articles:
    h3 = art.find(['h3', 'h4', 'h2'])
    if not h3: continue
    structure_name = h3.get_text(strip=True)
    
    tiers = art.find_all('div')
    for tier in tiers:
        if not tier.get('class') or 'fac__tier' not in tier.get('class'): continue
        prods = tier.find_all('li')
        for prod in prods:
            classes = prod.get('class', [])
            if 'fac__prod--recipe' not in classes: continue
            
            output_name = "Unknown"
            spans = prod.find_all('span')
            for s in spans:
                txt = s.get_text(strip=True)
                if txt:
                    output_name = txt
                    break
            
            if output_name in existing_names: continue

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
                            inputs[m.group(1).strip()] = int(m.group(2))

            new_recipes.append({
                "id": f"r{r_id}",
                "nom": output_name,
                "structure": structure_name,
                "w": 1,
                "h": 1,
                "tempsMin": 30, # Cannot scrape easily from DOM
                "input": inputs,
                "output": { output_name: 1 },
                "profit": 0,
                "capacite": "Fabrication",
                "color": "bg-slate-600"
            })
            existing_names.add(output_name)
            r_id += 1

existing_recipes.extend(new_recipes)

with open(db_path, 'w', encoding='utf-8') as f:
    json.dump(existing_recipes, f, indent=2, ensure_ascii=False)

print(f"Added {len(new_recipes)} new recipes to db.")
