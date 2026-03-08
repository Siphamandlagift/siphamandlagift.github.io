import re

content = open('index.html', encoding='utf-8', errors='ignore').read()

# Emojis for Badges
replacements = {
    'â‰¡Æ’Ã…Ã ': '🚀',
    'Î“Â¡Ã‰': '⭐',
    'â‰¡Æ’Ã„Â»': '🎯',
    'â‰¡Æ’ÃœÃ‡': '🌟'
}

for old, new in replacements.items():
    content = content.replace(old, new)

open('index.html', 'w', encoding='utf-8').write(content)
print("done")
