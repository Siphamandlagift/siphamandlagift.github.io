import re

with open('index.html', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# find other possible mojibake like Î“, â‰, etc.
matches = re.findall(r'.{0,20}(?:Î“|â‰|Ã…|Ã|Γ).{0,20}', text)

print(f"Found {len(matches)} matches.")
for m in set(matches):
    print(repr(m))
