from bs4 import BeautifulSoup
import re

html_file = r"C:\Users\y007\.gemini\antigravity\brain\8ff53348-84e1-4828-af4a-4e7ac4c38a10\.system_generated\steps\182\content.md"
with open(html_file, 'r', encoding='utf-8', errors='replace') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')
cards = soup.find_all(class_=re.compile(r'fac__card'))
print(f"Cards found: {len(cards)}")

struct_counts = {}
for card in cards:
    name_el = card.find(class_=re.compile(r'fac__name'))
    name = name_el.get_text(strip=True) if name_el else "Inconnu"
    prods = [p.get_text(strip=True) for p in card.find_all(class_=re.compile(r'fac__prod-name'))]
    struct_counts[name] = len(prods)

for k, v in sorted(struct_counts.items()):
    print(f"{k}: {v} produits")
