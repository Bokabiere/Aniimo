from bs4 import BeautifulSoup
import re

html_file = r"C:\Users\y007\.gemini\antigravity\brain\8ff53348-84e1-4828-af4a-4e7ac4c38a10\.system_generated\steps\182\content.md"

with open(html_file, 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')

element = soup.find(string=re.compile("Farine"))
if element:
    parent = element.find_parent('article') or element.find_parent('li') or element.find_parent('div', class_=re.compile('fac'))
    if parent:
        print(parent.prettify())
