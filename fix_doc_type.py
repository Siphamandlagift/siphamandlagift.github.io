with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix doc.type being undefined throwing an error
text = text.replace("doc.type.toUpperCase()", "(doc.type || '').toUpperCase()")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Protected doc.type calls")