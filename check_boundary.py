import re

file_path = 'c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

start = text.find('id="programme-managementContent"')
subtext = text[start:start+10000]

m = re.search(r'(<!-- Existing Programmes Table -->[\s\S]*?</div>\s*</div>\s*</div>\s*</div>)', subtext)

if m:
    print('Found Existing table end! Length:', len(m.group(1)))
    print('Ending snippet:', m.group(1)[-100:])
else:
    print('Did not find the end of Existing Programmes Table')

