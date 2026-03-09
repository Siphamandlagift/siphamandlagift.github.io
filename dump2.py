import re
with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'(<div id="programme-managementContent" class="content-section">[\s\S]*?<!-- Assign Students to Programmes Modal -->)', text)
if m:
    with open('programme_man.txt', 'w', encoding='utf-8') as f:
        f.write(m.group(1))
    print('Saved')
