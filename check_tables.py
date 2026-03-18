import re
with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'<tbody id="userTableBody".*?</tbody>', text, re.DOTALL)
if m:
    print('userTableBody:', m.group(0)[:500])

for match in re.finditer(r'<tbody.*?</tbody>', text, re.DOTALL):
    if 'Smith' in match.group() or 'Doe' in match.group() or 'td' in match.group():
        print("Found possible dummy tbody:", match.group(0)[:200])

