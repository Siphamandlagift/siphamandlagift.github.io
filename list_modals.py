with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
modals = re.findall(r'id=\"(.*?Modal.*?)\"', text, re.IGNORECASE)
print(set(modals))
