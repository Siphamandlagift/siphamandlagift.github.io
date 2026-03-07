import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Make sure all options inputs are radios, not checkboxes
html = html.replace('type="checkbox" name="mcAnswer" disabled class=', 'type="radio" name="mcAnswer" class=')
html = html.replace('type="checkbox" name="mcAnswer" class=', 'type="radio" name="mcAnswer" class=')
html = html.replace('type="checkbox" name="mcAnswer"', 'type="radio" name="mcAnswer"')

# The updateMultipleChoiceAnswerSelectionState function logic
html = re.sub(r'\s*function updateMultipleChoiceAnswerSelectionState\(\) \{[\s\S]*?(?=\s*function )', '\n\n', html)

# Remove calls to it
html = html.replace('updateMultipleChoiceAnswerSelectionState();\n', '')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
