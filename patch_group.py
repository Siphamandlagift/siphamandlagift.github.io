import re
with open("index.html", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("""            const courseChecks = document.querySelectorAll('input[name="groupCourseCheck"]:checked');\n""", "")
text = text.replace("""            const courses = Array.from(courseChecks).map(cb => cb.value);\n""", "")
text = text.replace("""                    group.courses = courses;\n""", "")
text = text.replace(""",\n                    courses: courses""", "")
text = text.replace("""            syncGroupTrainings();\n""", "")

with open("index.html", "w", encoding="utf-8") as f:
    f.write(text)

