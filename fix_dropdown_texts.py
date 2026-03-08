import re

with open('index.html', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# I will replace these options directly without relying on matching the exact weird characters just in case they are parsed differently.
# But using re.sub with just the values is cleaner:

replacements = {
    r'<option value="">.*?</option>': '<option value="">-- Select type to begin --</option>',
    r'<option value="multiple-choice">.*?</option>': '<option value="multiple-choice">✅ Multiple Choice</option>',
    r'<option value="true-false">.*?</option>': '<option value="true-false">⚖️ True/False</option>',
    r'<option value="matching">.*?</option>': '<option value="matching">🔀 Matching</option>',
    r'<option value="fill-in-blank">.*?</option>': '<option value="fill-in-blank">✏️ Fill in the Blank</option>',
    r'<option value="ordering">.*?</option>': '<option value="ordering">🔢 Ordering/Sequence</option>'
}

for pattern, replacement in replacements.items():
    text = re.sub(pattern, replacement, text)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Dropdown text fixed.")

