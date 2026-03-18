import re

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's find rendering section, perhaps near unction renderStudentAssignmentsList
target_func = r'function renderStudentAssignmentsList\(\) \{[^\}]*\}'

render_my_grades_func = """
        function renderMyGrades() {
            const container = document.getElementById('myGradesListContainer');
            if (!container) return;

            if (!loggedInUser || loggedInUser.role !== 'Student') {
                container.innerHTML = '<div class="text-center py-8 text-gray-500">Only students have grades.</div>';
                return;
            }

            // Get all graded assignments for the logged-in student
            const gradedAssignments = (typeof allAssignmentsData !== 'undefined' ? allAssignmentsData : []).filter(a =>
                String(a.assignedStudentId) === String(loggedInUser.id) &&
                (a.status === 'Graded' || (a.score !== undefined && a.status === 'Completed'))
            );

            if (gradedAssignments.length === 0) {
                container.innerHTML = 
                    <div class="text-center py-8 text-gray-500">
                        <i class="las la-graduation-cap text-4xl mb-3 text-gray-400"></i>
                        <p>No graded assignments found.</p>
                    </div>;
                return;
            }

            // Create a table for the grades
            let html = 
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignment Title</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Graded Date</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comments</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
            ;

            gradedAssignments.forEach(a => {
                const courseName = a.courseId ? ((allCoursesData || []).find(c => String(c.id) === String(a.courseId))?.title || 'Unknown Course') : 'General Assignment';
                const scoreText = a.score !== undefined ? \ / \ : 'N/A';
                const feedbackText = a.feedback || "No comments.";
                const dateText = a.gradedDate || a.submissionDate || "N/A";
                
                let scoreColor = 'text-green-600';
                if (a.score !== undefined && a.totalMarks) {
                    const pct = a.score / a.totalMarks;
                    if (pct < 0.5) scoreColor = 'text-red-600';
                    else if (pct < 0.75) scoreColor = 'text-orange-500';
                }

                html += 
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">\</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">\</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold \">\</td>
                        <td class="px-6 py-4 text-sm text-gray-500 mx-w-xs truncate" title="\">\</td>
                    </tr>
                ;
            });

            html += 
                        </tbody>
                    </table>
                </div>
            ;

            container.innerHTML = html;
        }
"""

# Replace the empty renderStudentAssignmentsList with both itself and the new function
replacement = """function renderStudentAssignmentsList() {
            // This function would be implemented if there's a standalone student assignments view
            // Currently assignments are shown within courses in the course viewer
        }
""" + render_my_grades_func

new_text = re.sub(target_func, replacement, text)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_text)

print('Injected renderMyGrades')
