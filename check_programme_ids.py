import re
with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

funcs = set(re.findall(r'function (\w*Programme\w*)\(', text))
print("Functions:", funcs)

ids = set(re.findall(r'id=\"([a-zA-Z0-9_\-]*[pP]rogramme[a-zA-Z0-9_\-]*)\"', text))
print("\nIDs:")
for id in sorted(ids):
    print(id)
