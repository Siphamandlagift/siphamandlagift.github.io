import sys

with open('index.html', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the UI element in the group modal
ui_str = '''                                    <div class="mb-4">
                                        <label class="block text-sm font-medium text-gray-700 mb-2">Assign Courses to Group</label>
                                        <div class="p-3 border border-gray-200 rounded-md h-48 overflow-y-auto bg-gray-50">
                                            <div id="groupCoursesList" class="flex flex-col space-y-2">
                                                <!-- Dynamic Course Checkboxes -->
                                            </div>
                                        </div>
                                    </div>'''
content = content.replace(ui_str, "")

# 2. In `editGroup(groupId)` :  `renderGroupModalCheckboxes(group.learners || [], group.courses || []);`
content = content.replace('renderGroupModalCheckboxes(group.learners || [], group.courses || []);', 
                          'renderGroupModalCheckboxes(group.learners || []);')

# 3. function definition
content = content.replace('function renderGroupModalCheckboxes(selectedLearners = [], selectedCourses = []) {',
                          'function renderGroupModalCheckboxes(selectedLearners = []) {')

# 4. Remove the logic loading course checkboxes
js_remove = '''
            const courseContainer = document.getElementById('groupCoursesList');
            courseContainer.innerHTML = '';

            allCoursesData.forEach(course => {
                const checked = selectedCourses.includes(course.id) ? 'checked' : '';
                courseContainer.innerHTML += `
                    <label class="inline-flex items-center mt-2">
                        <input type="checkbox" name="groupCourseCheck" value="${course.id}" class="form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded" ${checked}>
                        <span class="ml-2 text-sm text-gray-700">${course.title}</span>
                    </label>
                `;
            });
'''
content = content.replace(js_remove, "")

# 5. In saveLearnerGroup()
content = content.replace("""            const courseChecks = document.querySelectorAll('input[name="groupCourseCheck"]:checked');""", "")
content = content.replace("""            const courses = Array.from(courseChecks).map(cb => cb.value);""", "")

# 6. Assignment in edit
content = content.replace("""                    group.courses = courses;""", "")
# Assignment in create
content = content.replace(""",
                    courses: courses""", "")

# 7. Remove the sync function call
content = content.replace("            syncGroupTrainings();\n", "")
content = content.replace("                syncGroupTrainings();\n", "")

# 8. Remove the syncGroupTrainings function entirely!
# Wait, let's just make it empty rather than regex deleting it, to be safe.
empty_func = """        function syncGroupTrainings() {
            // Disabled: groups no longer assign courses explicitly.
        }"""

import re
content = re.sub(r'function syncGroupTrainings\(\) \{[\s\S]*?if \(newAssignments\.length > 0\) \{[\s\S]*?loadAllAssignmentsTable\(\);\s*\}\s*\}\s*\}', empty_func, content)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Safely decoupled courses from groups!")
