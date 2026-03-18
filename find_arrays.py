import re

with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/js/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's find global arrays initialized with data (like const notificationsData = [...])
matches = re.findall(r'(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*\[\s*\{', text)
print("Found these populated arrays in main.js:", set(matches))
