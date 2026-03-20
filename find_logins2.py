import re

with open('js/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# show me the literal exact login credentials required to bypass the system
start = text.find('// Fallback to local demo data')
if start != -1:
    print(text[start:start+1000])

start = text.find('if (username ===')
if start != -1:
    print(text[start:start+1000])
