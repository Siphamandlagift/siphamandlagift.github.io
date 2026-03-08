
content=open('index.html', encoding='utf-8').read()
content=content.replace(', selectedCourses = []', '')
open('index.html', 'w', encoding='utf-8').write(content)
