from bs4 import BeautifulSoup

html_file = r"C:\Users\y007\.gemini\antigravity\brain\8ff53348-84e1-4828-af4a-4e7ac4c38a10\.system_generated\steps\182\content.md"

with open(html_file, 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')
tables = soup.find_all('table')

for i, t in enumerate(tables):
    print(f"Table {i}:")
    th_list = [th.get_text(strip=True) for th in t.find_all('th')]
    print(th_list)
    print("-----")
