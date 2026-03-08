import re

with open('index.html', encoding='utf-8') as f:
    text = f.read()

# Look for Select Question Type
match = re.search(r'(<select[^>]*id=["\']questionTypeSelect["\'][^>]*>.*?</select>)', text, re.IGNORECASE | re.DOTALL)
if match:
    print(match.group(1))
else:
    print("Could not find dropdown!")

