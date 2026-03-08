import re
content=open('index.html', encoding='utf-8').read()
content=re.sub(r'const courseContainer = document.getElementById\(\'groupCoursesList\'\);', '', content)
open('index.html', 'w', encoding='utf-8').write(content)
