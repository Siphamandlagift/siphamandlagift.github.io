with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if "document.getElementById('createCourseForm').addEventListener('submit'" in line:
        for j in range(i, i+30):
            print(str(j+1) + ': ' + lines[j].rstrip())
        break
