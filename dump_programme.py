import re

file_path = 'c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'(<div id="programmeManagement".*?</div>\s*</div>\s*</div>)', text, re.DOTALL)
if m:
    with open('programme_block.txt', 'w', encoding='utf-8') as out:
        out.write(m.group(1))
    print('Found one div')
else:
    # try another match
    m = re.search(r'<div id="programmeManagement"[\s\S]{1,8000}?(?=<!--)', text)
    if m:
        with open('programme_block.txt', 'w', encoding='utf-8') as out:
            out.write(m.group(0))
        print('Found with fallback')
