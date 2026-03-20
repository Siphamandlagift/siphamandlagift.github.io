import re

with open('js/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Check DOMContentLoaded
start = text.find('document.addEventListener("DOMContentLoaded"')
if start != -1:
    print(text[start:start+1000])
