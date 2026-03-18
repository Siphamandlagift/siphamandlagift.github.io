import re

with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/js/main.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Make course form listener use the new API hook
# Locate where new course gets pushed into the fake data
pattern = re.compile(
    r"(// Create new course object\s*const newCourse = \{\s*id: [^\n]+,\s*name: name,\s*description: description,[\s\S]*?)(allCoursesData\.push\(newCourse\);\s*saveToLocalStorage\(\);\s*renderCoursesTable\(\);)",
    re.MULTILINE
)

replacement = r'''\1
                // NEW: Send this true data object to Python backend instead of just array!
                if (typeof window.addCourseToDatabase === 'function') {
                    window.addCourseToDatabase(newCourse);
                } else {
                    allCoursesData.push(newCourse);
                }
                saveToLocalStorage();
                renderCoursesTable();'''

content = pattern.sub(replacement, content)

# 2. Hook up fetchCoursesFromBackend on initial initialization
# Locate fetchUsersFromBackend() call near document ready
init_pattern = re.compile(r"if\s*\(typeof window.fetchUsersFromBackend\s*===\s*'function'\)\s*\{\s*window.fetchUsersFromBackend\(\);\s*\}")
init_replace = r"if (typeof window.fetchUsersFromBackend === 'function') { window.fetchUsersFromBackend(); }\n        if (typeof window.fetchCoursesFromBackend === 'function') { window.fetchCoursesFromBackend(); }"

content = re.sub(init_pattern, init_replace, content)

with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/js/main.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated js/main.js to hook into Course backend.")
