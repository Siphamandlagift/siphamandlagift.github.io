import re

with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/js/main.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace getDefaultUsers implementation to just return []
pattern = re.compile(r'function getDefaultUsers\(\) \{[\s\S]*?return \[[\s\S]*?\];\s*\}')
content = pattern.sub('function getDefaultUsers() {\n            return [];\n        }', content)

with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/js/main.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Dummy data cleared from main.js!")
