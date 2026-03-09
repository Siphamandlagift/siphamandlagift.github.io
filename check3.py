
with open('temp_check_0.js', 'r', encoding='utf-8') as f:
    text = f.read()
import re
matches = re.finditer(r'type:\s*[\x27\x22].*?[\x27\x22]', text)
for m in list(matches)[:20]:
    print(m.group(0))
