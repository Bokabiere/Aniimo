import sys
sys.stdout.reconfigure(encoding='utf-8')
from bs4 import BeautifulSoup
import json, re

html_file = r"C:\Users\y007\.gemini\antigravity\brain\8ff53348-84e1-4828-af4a-4e7ac4c38a10\.system_generated\steps\518\content.md"
with open(html_file, 'r', encoding='utf-8', errors='replace') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')
for tag in soup(['script','style','meta','head','link']): tag.decompose()
main = soup.find('main') or soup.body
text = main.get_text(separator='\n', strip=True)
lines = [l for l in text.split('\n') if l.strip()]

# Extract all level blocks
levels = {}
current_level = None
i = 0
while i < len(lines):
    l = lines[i]
    m = re.match(r'^Camping-car niveau (\d+)$', l)
    if m:
        current_level = int(m.group(1))
        levels[current_level] = {'aniimo': 0, 'duree': '', 'pieces_logis': 0, 'bois': 0, 'sable': 0, 'argile': 0, 'autres': [], 'avant': [], 'debloque': []}
        # Read aniimo count from next line
        if i+1 < len(lines) and 'Aniimo' in lines[i+1]:
            m2 = re.match(r'^(\d+) Aniimo', lines[i+1])
            if m2:
                levels[current_level]['aniimo'] = int(m2.group(1))
    
    if current_level and 'Durée:' in l:
        levels[current_level]['duree'] = l.replace('Durée:', '').strip()
    
    if current_level and l == 'Pièce de logis' and i+1 < len(lines):
        m2 = re.match(r'^×(\d[\d\s]*)$', lines[i+1])
        if m2:
            levels[current_level]['pieces_logis'] = int(m2.group(1).replace(' ',''))
    
    if current_level and l == 'Bloc de bois' and i+1 < len(lines):
        m2 = re.match(r'^×(\d[\d\s]*)$', lines[i+1])
        if m2:
            levels[current_level]['bois'] = int(m2.group(1).replace(' ',''))
    
    if current_level and l == 'Sable minéral' and i+1 < len(lines):
        m2 = re.match(r'^×(\d[\d\s]*)$', lines[i+1])
        if m2:
            levels[current_level]['sable'] = int(m2.group(1).replace(' ',''))
    
    i += 1

for lvl, data in sorted(levels.items()):
    print(f"Niv.{lvl}: {data['aniimo']} aniimo | Durée: {data['duree']} | Pièces: {data['pieces_logis']} | Bois: {data['bois']} | Sable: {data['sable']}")
