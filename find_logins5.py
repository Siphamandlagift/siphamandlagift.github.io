import re

with open('js/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# show me all event listeners for load
for m in re.finditer(r'document\.addEventListener\(["\']DOMContentLoaded["\']', text):
    start = m.start()
    print(text[start:start+500])
    print("-----")
