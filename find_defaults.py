import re

with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/js/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's find all function names that start with getDefault
matches = re.findall(r'function\s+(getDefault[a-zA-Z0-9_]+)\s*\(', text)
print("Found these default data functions:", matches)
