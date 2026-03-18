import re
with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'<div id="dashboardContent".*?<!-- Users Content', text, re.DOTALL)
if m:
    with open('dashboard_dump.txt', 'w', encoding='utf-8') as out:
        out.write(m.group(0))
    print("Dumped dashboardContent")
