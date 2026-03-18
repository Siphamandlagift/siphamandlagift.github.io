import re
with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r'(<span class="ml-2 text-gray-700 hidden\s*md:inline" id="topNavUsername">).*?(</span>)', r'\g<1>\g<2>', text)
text = re.sub(r'(<p class="text-sm font-semibold\s*text-gray-900" id="dropdownUserName">).*?(</p>)', r'\g<1>\g<2>', text)
text = re.sub(r'(<p class="text-xs text-gray-500" id="dropdownUserEmail">).*?(</p>)', r'\g<1>\g<2>', text)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done wiping profile placeholders in index.html!')
