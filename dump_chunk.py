import re

with open('index.html', encoding='utf-8') as f:
    text = f.read()

idx = text.find('questionTypeSelect')
start = max(0, idx - 500)
end = min(len(text), idx + 1000)

chunk = text[start:end]
with open('dropdown_chunk.txt', 'w', encoding='utf-8') as f:
    f.write(chunk)
