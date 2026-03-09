import re

file_path = 'c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

pattern = re.compile(r'    const courseAssignmentsList = allAssignmentsData \? allAssignmentsData\.filter\(a =>\s*a\.courseId === courseId && a\.assignedStudentId === loggedInUser\.id\s*\) : \[\];\s*const hasAssignments = courseAssignmentsList\.length > 0;')

new_logic = """    // Auto-generate missing assignments from course templates just-in-time
    if (typeof loggedInUser !== 'undefined' && loggedInUser && loggedInUser.role === 'student' && course && course.assignments && course.assignments.length > 0) {
        let wasUpdated = false;
        
        course.assignments.forEach(template => {
            const exists = (typeof allAssignmentsData !== 'undefined' ? allAssignmentsData : []).find(a =>
                a.assignedStudentId === loggedInUser.id &&
                a.courseId === courseId &&
                a.title === template.title
            );

            if (!exists) {
                const newAssignment = {
                    id: Date.now() + loggedInUser.id + Math.floor(Math.random() * 10000),
                    type: template.type || 'regular',
                    title: template.title,
                    instructions: template.instructions || '',
                    dueDate: template.dueDate || new Date().toISOString().slice(0, 10),
                    courseId: courseId,
                    courseName: course.name,
                    documents: template.documents || [],
                    totalMarks: template.totalMarks || 100,
                    questions: template.questions || [],
                    assignedStudentId: loggedInUser.id,
                    creatorId: course.creatorId || loggedInUser.id,
                    status: (template.type === 'mark-as-read') ? 'Pending Read' : 'Assigned',
                    submissionDate: null,
                    score: null,
                    feedback: null,
                    creationDate: new Date().toISOString().slice(0, 10)
                };
                if (typeof allAssignmentsData !== 'undefined') {
                    allAssignmentsData.push(newAssignment);
                } else {
                    window.allAssignmentsData = [newAssignment];
                }
                wasUpdated = true;
            }
        });
        if (wasUpdated && typeof saveToLocalStorage === 'function') {
            saveToLocalStorage();
        }
    }

    const courseAssignmentsList = (typeof allAssignmentsData !== 'undefined' ? allAssignmentsData : []).filter(a =>
        a.courseId === courseId && a.assignedStudentId === loggedInUser.id
    );
    const hasAssignments = courseAssignmentsList.length > 0;"""

if pattern.search(text):
    text = pattern.sub(new_logic, text)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print('Regex applied successfully!')
else:
    print('Pattern not matched.')
