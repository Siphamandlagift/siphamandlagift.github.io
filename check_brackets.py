import re

with open('js/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# removing strings to not count braces inside strings
text = re.sub(r"'[^']*'", "", text)
text = re.sub(r'"[^"]*"', "", text)
text = re.sub(r"`[^`]*`", "", text)
text = re.sub(r"//.*", "", text)

lines = text.split("\n")
indent = 0
for i, line in enumerate(lines):
    indent += line.count('{')
    indent -= line.count('}')
    if indent < 0:
        print(f"Negative indent at line {i+1}")
print(f"Final indent: {indent}")
