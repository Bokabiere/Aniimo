import sys
sys.stdout.reconfigure(encoding='utf-8')
from bs4 import BeautifulSoup
import json

html_file = r"C:\Users\y007\.gemini\antigravity\brain\8ff53348-84e1-4828-af4a-4e7ac4c38a10\.system_generated\steps\438\content.md"
with open(html_file, 'r', encoding='utf-8', errors='replace') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')
for tag in soup(['script', 'style', 'meta', 'head', 'link']):
    tag.decompose()

main = soup.find('main') or soup.body
text = main.get_text(separator='\n', strip=True)
lines = [l for l in text.split('\n') if l.strip()]

# Print lines 100-370
for i, l in enumerate(lines[100:380], start=100):
    print(f"[{i}] {l}")
