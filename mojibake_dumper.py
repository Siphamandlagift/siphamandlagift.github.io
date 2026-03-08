import re

with open('index.html', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# find other possible mojibake like Γ, â, Ã etc.
matches = re.findall(r'.{0,30}(?:Î“|â‰|Ã…|Γ).{0,30}', text)

with open('mojibake_out.txt', 'w', encoding='utf-8') as f:
    f.write(f"Found {len(matches)} matches.\n")
    for m in sorted(set(matches)):
        f.write(repr(m) + "\n")
