with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# 1. const correctAnswer = document.querySelector('input[name="tfAnswer"]:checked')?.value;
text = re.sub(
    r'const correctAnswer = document\.querySelector\(\'input\[name="tfAnswer"\]:checked\'\)\?\.value;',
    r'''const _tfChecked = document.querySelector('input[name="tfAnswer"]:checked');\n                const correctAnswer = _tfChecked ? _tfChecked.value : undefined;''',
    text
)

# 2. const courseName = row.querySelector('td:nth-child(2)')?.textContent.toLowerCase() || '';
text = re.sub(
    r'const courseName = row\.querySelector\(\'td:nth-child\(2\)\'\)\?\.textContent\.toLowerCase\(\) \|\| \'\';',
    r"const _c2 = row.querySelector('td:nth-child(2)'); const courseName = _c2 && _c2.textContent ? _c2.textContent.toLowerCase() : '';",
    text
)

# 3. const description = row.querySelector('td:nth-child(3)')?.textContent.toLowerCase() || '';
text = re.sub(
    r'const description = row\.querySelector\(\'td:nth-child\(3\)\'\)\?\.textContent\.toLowerCase\(\) \|\| \'\';',
    r"const _c3 = row.querySelector('td:nth-child(3)'); const description = _c3 && _c3.textContent ? _c3.textContent.toLowerCase() : '';",
    text
)

# 4. const creator = row.querySelector('td:nth-child(7)')?.textContent.toLowerCase() || '';
text = re.sub(
    r'const creator = row\.querySelector\(\'td:nth-child\(7\)\'\)\?\.textContent\.toLowerCase\(\) \|\| \'\';',
    r"const _c7 = row.querySelector('td:nth-child(7)'); const creator = _c7 && _c7.textContent ? _c7.textContent.toLowerCase() : '';",
    text
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Removed ?. usages")