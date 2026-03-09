import re
with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'(<ul[^>]*flex[^>]*border-b[^>]*>[\s\S]*?</ul>)', text)
if m:
    with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/tab_example.txt', 'w', encoding='utf-8') as f:
        f.write(m.group(1))
    print('Saved')
else:
    print('Not found')
