import re

with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add editingCourseId
if 'let editingCourseId = null;' not in text:
    text = text.replace('let allCoursesData = [];', 'let allCoursesData = [];\n        let editingCourseId = null;')

# 2. Add editCourse and deleteCourse functions
funcs = \"\"\"
        function editCourse(courseId, event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            const course = allCoursesData.find(c => c.id === courseId);
            if (!course) return;
            
            editingCourseId = course.id;
            
            // Switch to create tab
            if (typeof switchMyCourseTab === 'function') switchMyCourseTab('create');
            if (typeof showSection === 'function') showSection('my-coursesContent');
            
            const submitBtn = document.querySelector('#createCourseForm button[type=\"submit\"]');
            if (submitBtn) submitBtn.innerHTML = '<i class=\"fas fa-save mr-2\"></i>Update Course';
            
            document.getElementById('courseNameInput').value = course.name || '';
            document.getElementById('courseDescriptionInput').value = course.description || '';
            
            const picturePreview = document.getElementById('coursePicturePreview');
            if (picturePreview) picturePreview.src = course.picture || \"https://placehold.co/400x200/e2e8f0/64748b?text=Course+Image\";
            
            const deadlineInput = document.getElementById('courseCompletionDeadlineInput');
            if (deadlineInput) deadlineInput.value = course.completionDeadline || '';
            
            // Restore arrays
            currentCourseVideos = [...(course.videos || [])];
            currentCoursePdfFileName = course.pdfFileName || '';
            currentCourseQuestions = [...(course.questions || [])];
            currentCourseAssignments = [...(course.assignments || [])];
            
            // Re-render sub components
            if (typeof renderVideosList === 'function') renderVideosList();
            if (typeof renderCourseQuestions === 'function') renderCourseQuestions();
            if (typeof renderCourseAssignments === 'function') renderCourseAssignments();
            
            window.scrollTo(0, 0);
        }

        function deleteCourse(courseId, event) {
            if (event) {
                event.stopPropagation();
                event.preventDefault();
            }
            if (confirm('Are you sure you want to delete this course?')) {
                const index = allCoursesData.findIndex(c => c.id === courseId);
                if (index > -1) {
                    allCoursesData.splice(index, 1);
                    saveToLocalStorage();
                    
                    if (typeof renderTrainingManagerCoursesTable === 'function') renderTrainingManagerCoursesTable();
                    if (typeof renderAllExistingCoursesTable === 'function') renderAllExistingCoursesTable();
                    if (typeof populateLinkedCoursesSelection === 'function') populateLinkedCoursesSelection();
                    if (typeof populateReportCourseSelect === 'function') populateReportCourseSelect();
                    if (typeof renderCoursesForAssignmentTable === 'function') renderCoursesForAssignmentTable();
                    if (typeof updateDashboardStats === 'function') updateDashboardStats();
                    
                    showMessageModal('Course Deleted', 'The course has been successfully deleted.');
                }
            }
        }
\"\"\"

if 'function deleteCourse' not in text:
    text = text.replace('// Function to get default courses', funcs + '\n        // Function to get default courses')

# 3. Patch the 'Edit' and 'Delete' anchors in renderTrainingManagerCoursesTable
old_action_cell = '''<td class=\"px-6 py-4 whitespace-nowrap text-sm font-medium\">
                            <a href=\"#\" class=\"text-indigo-600 hover:text-indigo-900 mr-3\">Edit</a>
                            <a href=\"#\" class=\"text-red-600 hover:text-red-900\">Delete</a>
                        </td>'''
new_action_cell = '''<td class=\"px-6 py-4 whitespace-nowrap text-sm font-medium\">
                            <a href=\"#\" onclick=\"editCourse(, event)\" class=\"text-indigo-600 hover:text-indigo-900 mr-3\">Edit</a>
                            <a href=\"#\" onclick=\"deleteCourse(, event)\" class=\"text-red-600 hover:text-red-900\">Delete</a>
                        </td>'''
if old_action_cell in text:
    # replace all occurences
    text = text.replace(old_action_cell, new_action_cell)

# 4. Modify form submit block (we match regex block for newCourse)
block_regex = re.compile(r'const newCourse = \{[\s\S]*?resetCourseForm\(\);\s*\}\);', re.MULTILINE)

new_form_logic = \"\"\"if (editingCourseId) {
                const courseIndex = allCoursesData.findIndex(c => c.id === editingCourseId);
                if (courseIndex !== -1) {
                    allCoursesData[courseIndex] = {
                        ...allCoursesData[courseIndex],
                        name: courseName,
                        description: courseDescription,
                        videos: [...currentCourseVideos],
                        pdfFileName: currentCoursePdfFileName,
                        picture: coursePicture,
                        questions: [...currentCourseQuestions],
                        assignments: [...currentCourseAssignments],
                        completionDeadline: completionDeadline || null
                    };
                    
                    if (documentsArray.length > 0) {
                         if (!allCoursesData[courseIndex].documents) allCoursesData[courseIndex].documents = [];
                         let newDocs = allCoursesData[courseIndex].documents.filter(d => !d.isRequired);
                         newDocs.push(documentsArray[0]);
                         allCoursesData[courseIndex].documents = newDocs;
                    }
                    
                    saveToLocalStorage();
                    showMessageModal('Course Updated', Course \"\\" has been successfully updated.);
                }
                editingCourseId = null;
                const submitBtn = document.querySelector('#createCourseForm button[type=\"submit\"]');
                if (submitBtn) submitBtn.innerHTML = '<i class=\"fas fa-plus-circle mr-2\"></i>Create Course';
                
            } else {
                const newCourse = {
                    id: Date.now(),
                    name: courseName,
                    description: courseDescription,
                    videos: [...currentCourseVideos],
                    pdfFileName: currentCoursePdfFileName,
                    picture: coursePicture,
                    questions: [...currentCourseQuestions],
                    assignments: [...currentCourseAssignments],
                    documents: documentsArray,
                    readStatus: false,
                    creatorId: loggedInUser.id,
                    completionDeadline: completionDeadline || null
                };
                allCoursesData.push(newCourse);
                saveToLocalStorage(); 
                
                const videoText = currentCourseVideos.length > 0 ? \ video(s) : 'no videos';
                const questionText = currentCourseQuestions.length > 0 ? \ question(s) : 'no questions';
                const assignmentText = currentCourseAssignments.length > 0 ? , \ assignment(s) : '';
                
                showMessageModal('Course Created Successfully!', 
                    Course \"\\" has been created.
                );
            }

            if (typeof renderTrainingManagerCoursesTable === 'function') renderTrainingManagerCoursesTable();
            if (typeof renderAllExistingCoursesTable === 'function') renderAllExistingCoursesTable();
            if (typeof populateLinkedCoursesSelection === 'function') populateLinkedCoursesSelection();
            if (typeof populateReportCourseSelect === 'function') populateReportCourseSelect();
            if (typeof renderCoursesForAssignmentTable === 'function') renderCoursesForAssignmentTable();
            if (typeof updateDashboardStats === 'function') updateDashboardStats();
            
            resetCourseForm();
        });\"\"\"

if 'if (editingCourseId)' not in text:
    text = block_regex.sub(new_form_logic, text)

with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print('Patch applied successfully')
