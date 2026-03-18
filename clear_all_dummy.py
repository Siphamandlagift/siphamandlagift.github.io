import re

with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/js/main.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all getDefault* implementations to just return []
pattern = re.compile(r'function (getDefault[a-zA-Z0-9_]+)\(\)\s*\{[\s\S]*?return \[[\s\S]*?\];\s*\}')
content = pattern.sub(r'function \1() {\n            return [];\n        }', content)

# Clear specific global variables that hold lists of fake data, but KEEP the array structure so code doesn't crash
patterns_to_clear = [
    (r'(const sampleNotifications\s*=\s*)\[[\s\S]*?\];', r'\1[];'),
    (r'(const oldNotifications\s*=\s*)\[[\s\S]*?\];', r'\1[];'),
    (r'(const calendarEvents\s*=\s*)\[[\s\S]*?\];', r'\1[];'),
    (r'(const studentCourses\s*=\s*)\[[\s\S]*?\];', r'\1[];'),
    (r'(let studentBadgesData\s*=\s*)\[[\s\S]*?\];', r'\1[];')
]

for p, r in patterns_to_clear:
    content = re.sub(p, r, content)

with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/js/main.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Cleared remaining dummy data in main.js!")
