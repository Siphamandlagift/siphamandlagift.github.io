import re
with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Clear the React Project dummy text that I see is still there.
# Look for the immediate containing elements for the remaining block in the file.
text = re.sub(r'(<a href="#" class="block px-4 py-3[^>]*>.*?React Project assignment is due in 3 days.*?</a>)', r'', text, flags=re.DOTALL)
text = re.sub(r'(<p class="text-sm text-gray-600">React Project assignment is due in 3 days</p>)', r'', text, flags=re.DOTALL)
text = re.sub(r'(<div class="bg-white rounded-lg shadow p-6\s+border-l-4 border-red-500 hover:shadow-lg transition">.*?View Assignment \?.*?</button>\s*</div>\s*</div>)', r'', text, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done individual purge 2!')
