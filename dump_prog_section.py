import re
with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'(<section.*?id="programme-managementContent"[\s\S]*?(?=</section>)\s*</section>)', text)
if m:
    with open('programme_man.txt', 'w', encoding='utf-8') as f:
        f.write(m.group(1))
    print('Saved section')
else:
    m = re.search(r'(<div.*?id="programme-managementContent"[\s\S]{1,4000})', text)
    if m:
        with open('programme_man.txt', 'w', encoding='utf-8') as f:
            f.write(m.group(1))
        print('Saved div preview')
