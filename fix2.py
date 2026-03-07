import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Make sure all options inputs are radios, not checkboxes
html = html.replace('type="radio" name="mcAnswer" value="0" class="h-4 w-4 text-emerald-600 border-gray-300 rounded cursor-pointer" disabled', 'type="radio" name="mcAnswer" value="0" class="h-4 w-4 text-emerald-600 border-gray-300 rounded-full cursor-pointer"')
html = html.replace('type="radio" name="mcAnswer" value="1" class="h-4 w-4 text-emerald-600 border-gray-300 rounded cursor-pointer" disabled', 'type="radio" name="mcAnswer" value="1" class="h-4 w-4 text-emerald-600 border-gray-300 rounded-full cursor-pointer"')
html = html.replace('type="radio" name="mcAnswer" value="${optionCount}" class="h-4 w-4 text-emerald-600 border-gray-300 rounded cursor-pointer" disabled>', 'type="radio" name="mcAnswer" value="${optionCount}" class="h-4 w-4 text-emerald-600 border-gray-300 rounded-full cursor-pointer">')

# Let's fix up single-selection logic for mcAnswer checkbox since the previous step failed maybe
html = re.sub(r'\s*// Enforce single selection for multiple choice[\s\S]*?\}\);', '', html)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
