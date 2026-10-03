from bs4 import BeautifulSoup

html_file = r"C:\Users\y007\.gemini\antigravity\brain\8ff53348-84e1-4828-af4a-4e7ac4c38a10\.system_generated\steps\182\content.md"

with open(html_file, 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

# Find all headings h3/h4 that might precede the tables
for t in soup.find_all('table'):
    prev = t.find_previous(['h2', 'h3', 'h4'])
    print("Structure:", prev.get_text(strip=True) if prev else "None")
    
    rows = t.find_all('tr')
    if len(rows) > 1:
        cols = rows[1].find_all(['td', 'th'])
        print([c.get_text(strip=True) for c in cols])
    print("-----")
