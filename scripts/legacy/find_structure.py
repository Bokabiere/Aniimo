from bs4 import BeautifulSoup
import re

html_file = r"C:\Users\y007\.gemini\antigravity\brain\8ff53348-84e1-4828-af4a-4e7ac4c38a10\.system_generated\steps\182\content.md"
with open(html_file, 'r', encoding='utf-8', errors='replace') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')
card = soup.find(id='fac-1020009')
if card:
    print("CARD HTML preview:")
    print(str(card)[:1500])
    print("PARENT:")
    print(card.parent.name, card.parent.get('class'))
    # Preceding siblings or headers
    prev = card.find_previous(['h1', 'h2', 'h3', 'header'])
    if prev:
        print("PREVIOUS HEADER:", prev.get_text(strip=True))
