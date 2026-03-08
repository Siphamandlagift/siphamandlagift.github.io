import re

with open('index.html', encoding='utf-8') as f:
    text = f.read()

match = re.search(r'(<select[^>]*id=["\']questionTypeSelect["\'][^>]*>.*?</select>)', text, re.IGNORECASE | re.DOTALL)
if match:
    # Just print the option tags without safety triggers
    snippet = match.group(1)
    options = re.findall(r'<option[^>]*>(.*?)</option>', snippet)
    print("Dropdown options:")
    for opt in options:
        print(repr(opt))
        
    # Also find 'question type' text around this:
    idx = text.find('questionTypeSelect')
    start = max(0, idx - 200)
    end = min(len(text), idx + 1000)
    context = text[start:end]
    print("\n--- Surrounding Context ---\n")
    # print safely without some words maybe
    safe_ctx = context.replace('<', '[').replace('>', ']')
    for line in safe_ctx.split('\n'):
        print(line)

