import re
with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r'(<p class="text-2xl font-semibold text-gray-800 mb-6" id="certificateStudentName">).*?(</p>)', r'\g<1>\g<2>', text)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done cert!')
