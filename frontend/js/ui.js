// --- UI & Rendering Layer ---

function showAssignStudentsModal(programmeId) {
            currentProgrammeIdToAssign = programmeId;
            const programme = allProgramsData.find(p => p.id === programmeId);
            if (!programme) {
                showMessageModal('Error', 'Programme not found.');
                return;
            }
            
            const currentlyAssignedCount = programme.assignedStudentIds.length;
            assignStudentsModalTitle.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <div class="text-lg font-semibold text-gray-900">Assign Students to Programme</div>
                        <div class="text-sm text-gray-600 mt-1">${programme.name}</div>
                    </div>
                    <div class="text-sm bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 px-3 py-1 rounded-full font-medium">
                        Currently assigned: ${currentlyAssignedCount} student(s)
                    </div>
                </div>
            `;
            
            // Clear search input
            document.getElementById('assignStudentsSearch').value = '';
            
            assignStudentsList.innerHTML = ''; // Clear previous list

            
            


            const assignCourseGroupsList = document.getElementById('assignCourseGroupsList');
            const noCourseGroupsAvailableMsg = document.getElementById('noCourseGroupsAvailableMsg');
            if (assignCourseGroupsList) {
                assignCourseGroupsList.innerHTML = '';
                let courseGroupHtml = '';
                
                if (window.allLearnerGroups && allLearnerGroups.length > 0) {
                    noCourseGroupsAvailableMsg.classList.add('hidden');
                    allLearnerGroups.forEach(group => {
                        const lCount = group.learners ? group.learners.length : 0;
                        courseGroupHtml += `
                            <div class="flex items-center justify-between py-2 px-2 hover:bg-gray-50 rounded group-item">
                                <div class="flex items-center space-x-3">
                                    <input type="checkbox" 
                                           value="${group.id}" 
                                           class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded assign-course-group-checkbox cursor-pointer" 
                                           id="assignCourseGroup-${group.id}"
                                           onchange="toggleGroupStudents(this, '${group.id}', 'course')">
                                    <label for="assignCourseGroup-${group.id}" class="text-sm font-medium text-gray-700 cursor-pointer">
                                        ${group.name} 
                                        <span class="text-xs text-gray-500 font-normal ml-1">(${lCount} students)</span>
                                    </label>
                                </div>
                            </div>
                        `;
                    });
                    assignCourseGroupsList.innerHTML = courseGroupHtml;
                } else if (noCourseGroupsAvailableMsg) {
                    noCourseGroupsAvailableMsg.classList.remove('hidden');
                }
            }

const students = allUsersData.filter(user => user.role === 'student');

            if (students.length === 0) {
                noStudentsAvailableMsg.classList.remove('hidden');
                document.getElementById('noStudentsMatchFilter').classList.add('hidden');
            } else {
                noStudentsAvailableMsg.classList.add('hidden');
                document.getElementById('noStudentsMatchFilter').classList.add('hidden');
                students.forEach(student => {
                    // Check if student is already assigned to THIS programme
                    const isAssignedToThisProgramme = programme.assignedStudentIds.includes(student.id);
                    
                    // Calculate student's completion/progress for this programme
                    const enrolledCourses = student.coursesEnrolled.filter(enr => 
                        programme.linkedCourseIds.includes(enr.courseId)
                    );
                    const completedCourses = enrolledCourses.filter(enr => enr.completionDate).length;
                    const totalCourses = programme.linkedCourseIds.length;
                    const progressText = totalCourses > 0 ? `${completedCourses}/${totalCourses} courses completed` : 'No courses';
                    
                    const checkboxDiv = document.createElement('div');
                    checkboxDiv.classList.add('flex', 'items-center', 'justify-between', 'py-2', 'px-2', 'hover:bg-gray-50', 'rounded', 'student-item');
                    const fullName = `${student.name}${student.surname ? ' ' + student.surname : ''}`;
                    checkboxDiv.dataset.studentName = fullName.toLowerCase();
                    checkboxDiv.dataset.studentEmail = student.email.toLowerCase();
                    checkboxDiv.innerHTML = `
                        <div class="flex items-center flex-1">
                            <input type="checkbox" id="assignStudent_${student.id}" value="${student.id}" class="assign-student-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" ${isAssignedToThisProgramme ? 'checked' : ''} onchange="updateSelectedCount()">
                            <label for="assignStudent_${student.id}" class="ml-3 flex-1">
                                <div class="text-sm font-medium text-gray-700">${fullName}</div>
                                <div class="text-xs text-gray-500">${student.email}</div>
                            </label>
                        </div>
                        <div class="text-xs text-gray-600 ml-2">
                            ${isAssignedToThisProgramme ? `<span class="text-blue-600">${progressText}</span>` : ''}
                        </div>
                    `;
                    assignStudentsList.appendChild(checkboxDiv);
                });
            }

            updateSelectedCount();
            assignStudentsModal.classList.remove('hidden');
            assignStudentsModal.classList.add('show');
        }

function renderAssignmentQuestions() {
            const container = document.getElementById('assignmentQuestionsList');
            const noQuestionsMsg = document.getElementById('noQuestionsMessage');
            
            if (!container) return;
            
            container.innerHTML = '';
            
            if (assignmentQuestions.length === 0) {
                if (noQuestionsMsg) noQuestionsMsg.classList.remove('hidden');
                return;
            }
            
            if (noQuestionsMsg) noQuestionsMsg.classList.add('hidden');
            
            assignmentQuestions.forEach(question => {
                const questionDiv = document.createElement('div');
                questionDiv.className = 'bg-white border border-gray-200 rounded-md p-3';
                questionDiv.innerHTML = `
                    <div class="flex items-start gap-2">
                        <div class="flex-shrink-0 w-8 h-8 bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 rounded-full flex items-center justify-center font-bold text-sm">
                            ${question.number}
                        </div>
                        <div class="flex-1">
                            <input type="text" 
                                placeholder="Enter question text (e.g., What are the key safety procedures?)" 
                                value="${question.text}"
                                onchange="updateQuestionText(${question.id}, this.value)"
                                class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2">
                            <div class="flex items-center gap-2">
                                <label class="text-xs text-gray-600">Marks:</label>
                                <input type="number" 
                                    min="0" 
                                    value="${question.marks}"
                                    onchange="updateQuestionMarks(${question.id}, this.value)"
                                    class="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500 text-center">
                            </div>
                        </div>
                        <button type="button" 
                            onclick="removeAssignmentQuestion(${question.id})" 
                            class="flex-shrink-0 text-red-500 hover:text-red-700 focus:outline-none">
                            <i class="las la-trash-alt"></i>
                        </button>
                    </div>
                `;
                container.appendChild(questionDiv);
            });
        }

function renderStudentAssignmentsList() {
            // This function would be implemented if there's a standalone student assignments view
            // Currently assignments are shown within courses in the course viewer
        }

function renderCertificateTemplatesTable() {
            const tableBody = document.getElementById('certTemplatesTableBody');
            
            if (allCertificateTemplatesData.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">No templates created yet. Create a new template above.</td></tr>';
                return;
            }

            tableBody.innerHTML = '';
            allCertificateTemplatesData.forEach(template => {
                const linkedCoursesNames = template.linkedCourseIds.map(id => {
                    const course = allCoursesData.find(c => c.id === id);
                    return course ? course.name : 'Unknown';
                }).join(', ');

                tableBody.innerHTML += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${template.name}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${template.description}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${template.colorScheme}</td>
                        <td class="px-6 py-4 text-sm text-gray-600">${linkedCoursesNames || 'No courses linked'}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button class="text-blue-600 hover:text-blue-900 mr-2">Edit</button>
                            <button class="text-red-600 hover:text-red-900">Delete</button>
                        </td>
                    </tr>
                `;
            });
        }

function renderCalendar() {
            const year = currentCalendarDate.getFullYear();
            const month = currentCalendarDate.getMonth();
            
            // Set month/year display
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'];
            document.getElementById('calendarMonthYear').textContent = monthNames[month] + ' ' + year;
            
            // Get first day of month and number of days
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const daysInPrevMonth = new Date(year, month, 0).getDate();
            
            let calendarDaysHTML = '';
            
            // Previous month's days
            for (let i = firstDay - 1; i >= 0; i--) {
                calendarDaysHTML += `<div class="p-2 text-center text-gray-400 bg-gray-50 rounded">${daysInPrevMonth - i}</div>`;
            }
            
            // Current month's days
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const hasEvent = calendarEvents.some(e => 
                    e.date.getDate() === day && 
                    e.date.getMonth() === month && 
                    e.date.getFullYear() === year
                );
                const isToday = date.toDateString() === new Date().toDateString();
                
                let dayHTML = `<div class="p-2 text-center rounded border-2 cursor-pointer hover:bg-indigo-50 transition`;
                dayHTML += isToday ? ' bg-indigo-100 border-indigo-500' : hasEvent ? ' bg-blue-50 border-blue-300' : ' border-gray-200';
                dayHTML += `" onclick="selectCalendarDate(new Date(${year}, ${month}, ${day}))">${day}`;
                if (hasEvent) {
                    dayHTML += '<span class="block text-xs text-blue-600 font-semibold mt-1">●</span>';
                }
                dayHTML += '</div>';
                calendarDaysHTML += dayHTML;
            }
            
            // Next month's days
            const totalCells = calendarDaysHTML.match(/<div/g).length;
            for (let day = 1; day <= (42 - totalCells - firstDay); day++) {
                calendarDaysHTML += `<div class="p-2 text-center text-gray-400 bg-gray-50 rounded">${day}</div>`;
            }
            
            document.getElementById('calendarDays').innerHTML = calendarDaysHTML;
            
            // Populate upcoming events
            updateUpcomingEvents();
            updateAllEventsList();
        }

function showAddUserModal() {
            addUserModal.classList.remove('hidden');
            addUserModal.classList.add('show');
            userPicturePreview.src = "https://placehold.co/96x96/E0E7FF/4F46E5?text=UP"; // Reset preview on open
        }

function updateCourseQuestionsList() {
            const list = document.getElementById('courseQuestionsList');
            const countBadge = document.getElementById('questionCount');
            list.innerHTML = ''; // Clear existing list

            if (currentCourseQuestions.length === 0) {
                list.innerHTML = '<li class="text-gray-400 text-sm italic flex items-center justify-center py-8"><i class="las la-inbox mr-2"></i>No questions added yet</li>';
                if (countBadge) countBadge.textContent = '0 Questions';
                return;
            }

            // Update count badge
            if (countBadge) {
                const plural = currentCourseQuestions.length === 1 ? 'Question' : 'Questions';
                countBadge.textContent = `${currentCourseQuestions.length} ${plural}`;
            }

            currentCourseQuestions.forEach((q, index) => {
                const listItem = document.createElement('li');
                listItem.classList.add('flex', 'justify-between', 'items-center', 'py-3', 'px-4', 'bg-white', 'rounded-lg', 'border', 'border-gray-200', 'hover:border-emerald-300', 'hover:shadow-sm', 'transition-all');
                
                let questionSummary = '';
                const marksText = `(${q.marks} ${q.marks === 1 ? 'mark' : 'marks'})`;
                let icon = '';
                
                if (q.type === 'multiple-choice') {
                    icon = '📝';
                    questionSummary = `MC: ${q.text.substring(0, 40)}${q.text.length > 40 ? '...' : ''} ${marksText}`;
                } else if (q.type === 'true-false') {
                    icon = '✓';
                    questionSummary = `T/F: ${q.text.substring(0, 40)}${q.text.length > 40 ? '...' : ''} ${marksText}`;
                } else if (q.type === 'matching') {
                    icon = '🔗';
                    questionSummary = `Matching: ${q.pairs.length} pairs ${marksText}`;
                } else if (q.type === 'fill-in-blank') {
                    icon = '✏️';
                    questionSummary = `Fill in Blank: ${q.text.substring(0, 40)}${q.text.length > 40 ? '...' : ''} ${marksText}`;
                } else if (q.type === 'ordering') {
                    icon = '🔢';
                    questionSummary = `Ordering: ${q.correctOrder.length} items ${marksText}`;
                } else if (q.type === 'long-answer') {
                    icon = '📄';
                    questionSummary = `Long Answer: ${q.text.substring(0, 40)}${q.text.length > 40 ? '...' : ''} ${marksText}`;
                }

                listItem.innerHTML = `
                    <div class="flex items-center space-x-3">
                        <span class="flex items-center justify-center w-8 h-8 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 rounded-lg font-bold text-sm">${index + 1}</span>
                        <span class="text-sm text-gray-700 flex items-center"><span class="mr-2">${icon}</span> ${questionSummary}</span>
                    </div>
                    <button type="button" class="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors delete-question-btn" data-index="${index}">
                        <i class="las la-trash"></i>
                    </button>
                `;
                list.appendChild(listItem);
            });

            document.querySelectorAll('.delete-question-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const indexToDelete = parseInt(this.dataset.index);
                    currentCourseQuestions.splice(indexToDelete, 1);
                    updateCourseQuestionsList();
                    showMessageModal('Question Removed', 'Question has been removed from the course.');
                });
            });
        }

function showAssignStudentsToCoursesModal(courseId) {
            currentCourseIdToAssign = courseId;
            const course = allCoursesData.find(c => c.id === courseId);
            if (!course) {
                showMessageModal('Error', 'Course not found.');
                return;
            }
            assignStudentsToCoursesModalTitle.textContent = `Assign Students to: ${course.name}`;
            
            // Clear search input
            document.getElementById('assignStudentsToCoursesSearch').value = '';
            
            assignStudentsToCoursesList.innerHTML = ''; // Clear previous list

            const students = allUsersData.filter(user => user.role === 'student');

            if (students.length === 0) {
                noStudentsAvailableForCourse.classList.remove('hidden');
                document.getElementById('noStudentsMatchCourseFilter').classList.add('hidden');
            } else {
                noStudentsAvailableForCourse.classList.add('hidden');
                document.getElementById('noStudentsMatchCourseFilter').classList.add('hidden');
                students.forEach(student => {
                    // Check if student is already enrolled in THIS course
                    const isEnrolledInThisCourse = student.coursesEnrolled.some(enr => enr.courseId === courseId);
                    
                    // Get enrollment details if enrolled
                    const enrollment = student.coursesEnrolled.find(enr => enr.courseId === courseId);
                    const enrollmentDate = enrollment ? enrollment.enrollmentDate : '';
                    const completionDate = enrollment ? enrollment.completionDate : null;
                    const statusText = completionDate ? 
                        `<span class="text-green-600"><i class="las la-check-circle mr-1"></i>Completed ${completionDate}</span>` : 
                        (isEnrolledInThisCourse ? `<span class="text-blue-600"><i class="las la-clock mr-1"></i>In Progress</span>` : '');
                    
                    const checkboxDiv = document.createElement('div');
                    checkboxDiv.classList.add('flex', 'items-center', 'justify-between', 'py-2', 'px-2', 'hover:bg-gray-50', 'rounded', 'course-student-item');
                    const fullName = `${student.name}${student.surname ? ' ' + student.surname : ''}`;
                    checkboxDiv.dataset.studentName = fullName.toLowerCase();
                    checkboxDiv.dataset.studentEmail = student.email.toLowerCase();
                    checkboxDiv.innerHTML = `
                        <div class="flex items-center flex-1">
                            <input type="checkbox" id="assignCourseStudent_${student.id}" value="${student.id}" class="assign-course-student-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" ${isEnrolledInThisCourse ? 'checked' : ''} onchange="updateCourseSelectedCount()">
                            <label for="assignCourseStudent_${student.id}" class="ml-3 flex-1">
                                <div class="text-sm font-medium text-gray-700">${fullName}</div>
                                <div class="text-xs text-gray-500">${student.email}</div>
                            </label>
                        </div>
                        <div class="text-xs ml-2">
                            ${statusText}
                        </div>
                    `;
                    assignStudentsToCoursesList.appendChild(checkboxDiv);
                });
            }

            updateCourseSelectedCount();
            assignStudentsToCoursesModal.classList.remove('hidden');
            assignStudentsToCoursesModal.classList.add('show');
        }

function renderStudentCertificatesTable() {
            const tableBody = document.getElementById('studentCertificatesTableBody');
            const studentCerts = allCertificatesData.filter(c => c.studentId === loggedInUser.id);
            
            if (studentCerts.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">No certificates earned yet. Complete courses to earn certificates.</td></tr>';
                return;
            }

            tableBody.innerHTML = '';
            studentCerts.forEach(cert => {
                tableBody.innerHTML += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${cert.id}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${cert.courseName}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${cert.issueDate}</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">${cert.status}</span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button onclick="showCertificateViewer('${cert.id}')" class="text-indigo-600 hover:text-indigo-900 mr-3">View</button>
                            <button onclick="downloadCertificate()" class="text-blue-600 hover:text-blue-900">Download</button>
                        </td>
                    </tr>
                `;
            });
        }

function renderCreatedBadgesTable() {
            const tableBody = document.getElementById('createdBadgesTableBody');
            const myBadges = allBadgesData.filter(b => b.creatorId === loggedInUser.id);
            tableBody.innerHTML = '';

            if (myBadges.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">No badges created yet.</td>
                    </tr>
                `;
                return;
            }

            myBadges.forEach(badge => {
                const row = `
                    <tr class="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all duration-300 group border-b border-gray-100/70 last:border-0 hover:shadow-sm relative">
                        <td class="px-6 py-5 whitespace-nowrap text-center">
                            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-300 transform group-hover:-rotate-3 text-4xl">${badge.icon}</div>
                        </td>
                        <td class="px-6 py-5 whitespace-nowrap">
                            <div class="flex flex-col">
                                <span class="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-indigo-800 tracking-tight">${badge.name}</span>
                                <span class="text-xs text-indigo-500/80 font-medium tracking-wide uppercase mt-0.5">ID: ${badge.id.substr(0,8)}</span>
                            </div>
                        </td>
                        <td class="px-6 py-5 whitespace-nowrap hidden sm:table-cell">
                            <div class="inline-flex items-center space-x-1.5 bg-blue-50/80 px-3 py-1.5 text-xs text-blue-700 font-semibold rounded-lg border border-blue-100 group-hover:bg-blue-100 transition-colors">
                                <i class="fas fa-clock opacity-60"></i>
                                <span>${badge.hoursRequired} Hours</span>
                            </div>
                        </td>
                        <td class="px-6 py-5 hidden lg:table-cell">
                            <p class="text-sm text-gray-500 leading-relaxed line-clamp-2 max-w-xs transition-colors group-hover:text-gray-700">${badge.description.substring(0, 60)}${badge.description.length > 60 ? '...' : ''}</p>
                        </td>
                        <td class="px-6 py-5 whitespace-nowrap text-center hidden md:table-cell">
                            <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 font-bold text-sm ring-1 ring-emerald-200 group-hover:bg-emerald-100 transition-colors shadow-sm">
                                ${badge.timesEarned}
                            </span>
                        </td>
                        <td class="px-6 py-5 whitespace-nowrap text-right sticky right-0 bg-white group-hover:bg-blue-50/10 transition-colors">
                            <div class="flex items-center justify-end space-x-2 opacity-100">
                                <button onclick="editBadge('${badge.id}')" class="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 hover:text-indigo-900 transition-all duration-200 hover:scale-105 tooltip" title="Edit Badge">
                                    <i class="fas fa-edit relative group-hover:animate-pulse"></i>
                                </button>
                                <button onclick="deleteBadge('${badge.id}')" class="p-2 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-all duration-200 hover:scale-105 tooltip" title="Delete Badge">
                                    <i class="fas fa-trash-alt relative"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        }

function updateSelectedCount() {
            const checkedBoxes = document.querySelectorAll('.assign-student-checkbox:checked');
            const visibleCheckedBoxes = Array.from(checkedBoxes).filter(cb => 
                cb.closest('.student-item').style.display !== 'none'
            );
            document.getElementById('selectedStudentsCount').textContent = `${visibleCheckedBoxes.length} students selected`;
        }

function renderTMAssignmentsTable() {
            const tbody = document.getElementById('tmAssignmentsTableBody');
            if (!tbody) return;

            const tmAssignments = allAssignmentsData.filter(a => a.creatorId === loggedInUser.id);

            if (tmAssignments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-gray-500 text-sm text-center">No assignments created yet.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            tmAssignments.forEach(assignment => {
                const student = allUsersData.find(u => u.id === assignment.assignedStudentId);
                const studentName = student ? `${student.name}${student.surname ? ' ' + student.surname : ''}` : 'Unknown';

                let statusBadge = '';
                if (assignment.status === 'Submitted') {
                    statusBadge = '<span class="px-2 py-1 bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 text-xs font-semibold rounded-full"><i class="las la-paper-plane mr-1"></i>Submitted</span>';
                } else if (assignment.status === 'Graded') {
                    statusBadge = '<span class="px-2 py-1 bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 text-xs font-semibold rounded-full"><i class="las la-check-circle mr-1"></i>Graded</span>';
                } else if (assignment.status === 'Read') {
                    statusBadge = '<span class="px-2 py-1 bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 text-xs font-semibold rounded-full"><i class="fas fa-eye mr-1"></i>Read</span>';
                } else if (assignment.status === 'Needs Revision') {
                    statusBadge = '<span class="px-2 py-1 bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 text-xs font-semibold rounded-full"><i class="las la-redo mr-1"></i>Needs Revision</span>';
                } else {
                    statusBadge = '<span class="px-2 py-1 bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 text-xs font-semibold rounded-full"><i class="las la-clock mr-1"></i>Assigned</span>';
                }

                const row = tbody.insertRow();
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${assignment.title}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${studentName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(assignment.dueDate).toLocaleDateString()}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${statusBadge}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${assignment.score !== null && assignment.score !== undefined ? `${assignment.score}/${assignment.totalMarks}` : `-/${assignment.totalMarks}`}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button onclick="showViewAssignmentModal(${assignment.id})" class="text-indigo-600 hover:text-indigo-900 mr-3">
                            <i class="fas fa-eye mr-1"></i>${assignment.status === 'Submitted' ? 'Grade' : 'View'}
                        </button>
                    </td>
                `;
            });
        }

function renderProgrammesForAssignmentTable() {
            const tableBody = document.getElementById('programmesForAssignmentTableBody');
            tableBody.innerHTML = '';

            if (allProgramsData.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">No programmes available for assignment. Create programmes first.</td>
                    </tr>
                `;
            } else {
                allProgramsData.forEach(programme => {
                    const row = tableBody.insertRow();
                    row.classList.add('hover:bg-gray-50'); // No click for the row, only the button

                    const linkedCoursesNames = programme.linkedCourseIds.map(id => {
                        const course = allCoursesData.find(c => c.id === id);
                        return course ? course.name : 'Unknown Course';
                    }).join(', ') || 'None';

                    const assignedStudentsNames = programme.assignedStudentIds.map(id => {
                        const student = allUsersData.find(u => u.id === id);
                        return student ? `${student.name}${student.surname ? ' ' + student.surname : ''}` : 'Unknown Student';
                    }).join(', ') || 'None';

                    row.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${programme.name}</td>
                        <td class="px-6 py-4 text-sm text-gray-500">${linkedCoursesNames}</td>
                        <td class="px-6 py-4 text-sm text-gray-500">${assignedStudentsNames}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button class="text-blue-600 hover:text-blue-900 assign-students-btn-trigger" data-programme-id="${programme.id}">Assign/View Students</button>
                        </td>
                    `;
                });
            }

            // Update programme counts for this specific table
            document.getElementById('assignProgrammesTotalCount').textContent = allProgramsData.length;
            document.getElementById('assignProgrammesShowingCount').textContent = allProgramsData.length > 0 ? 1 : 0;
            document.getElementById('assignProgrammesTotalCountDisplay').textContent = allProgramsData.length;

            // Add event listeners for "Assign/View Students" buttons in this new table
            document.querySelectorAll('.assign-students-btn-trigger').forEach(button => {
                button.addEventListener('click', function(e) {
                    e.stopPropagation(); // Prevent row click event if table rows were clickable
                    const programmeId = parseInt(this.dataset.programmeId);
                    showAssignStudentsModal(programmeId);
                });
            });
        }

function showSection(sectionId) {
            // Hide all content sections
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            // Show the requested section
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
                // Update page title
                const pageTitle = document.getElementById('pageTitle');
                if (pageTitle) {
                    // Extract title from section ID, e.g., "user-managementContent" -> "User Management"
                    let titleText = sectionId.replace('Content', '').replace(/-/g, ' ');
                    titleText = titleText.charAt(0).toUpperCase() + titleText.slice(1); // Capitalize first letter
                    // Special handling for the renamed sections
                    
            if (sectionId === 'learner-groupsContent') {
                loadLearnerGroupsTable();
            }
if (sectionId === 'course-contentContent') {
                        pageTitle.textContent = 'Course Content Overview';
                    } else if (sectionId === 'programme-managementContent') {
                        pageTitle.textContent = 'Programme Management';
                    } else if (sectionId === 'assignment-overviewContent') {
                        pageTitle.textContent = 'Student Enrolments';
                    } else if (sectionId === 'profileContent') {
                        pageTitle.textContent = 'User Profile';
                    } else if (sectionId === 'reportsContent') {
                        pageTitle.textContent = 'Reports';
                    } else if (sectionId === 'my-coursesContent') { // New for Training Manager
                         pageTitle.textContent = 'My Courses';
                    }
                    else {
                         pageTitle.textContent = titleText;
                    }
                }
            }

            // Update active state in sidebar
            document.querySelectorAll('.sidebar-item').forEach(item => {
                item.classList.remove('active');
            });
            const activeItem = document.querySelector(`.sidebar-item[data-section="${sectionId.replace('Content', '')}"]`);
            if (activeItem) {
                activeItem.classList.add('active');
            }

            // Logic for populating sections when they are shown
            if (sectionId === 'course-contentContent') { // Admin's view of all courses
                renderAllExistingCoursesTable();
            }
            if (sectionId === 'programme-managementContent') {
                populateLinkedCoursesSelection();
                renderExistingProgramsTable();
            }
            if (sectionId === 'assignment-overviewContent') {
                // Default to overview tab
                switchAssignmentTab('programmes');
            }
            if (sectionId === 'system-settingsContent') {
                loadSystemSettings();
            }
            if (sectionId === 'profileContent') {
                loadProfileSettings();
            }
            if (sectionId === 'dashboardContent') {
                updateDashboardStats();
            }
            if (sectionId === 'reportsContent') {
                populateReportCourseSelect();
                populateReportCompanyFilter();
            }
            if (sectionId === 'my-coursesContent') { // Training Manager's "My Courses"
                renderTrainingManagerCoursesTable();
            }
            if (sectionId === 'assignmentsContent') {
                renderTMAssignmentsTable();
            }
            if (sectionId === 'student-assignmentsContent') {
                renderStudentAssignmentsList();
            }
            if (sectionId === 'enrolled-coursesContent') {
                showStudentCourses('inprogress'); // Default to in-progress courses
            }
            if (sectionId === 'my-programmesContent') {
                showStudentProgrammes(); // Load student's assigned programmes
            }
            if (sectionId === 'messagesContent') { // New: Populate student dropdown for emails
                populateStudentEmailDropdown();
            }

            // Close mobile sidebar if open
            const sidebar = document.getElementById('sidebar');
            if (window.innerWidth <= 1023 && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
            }
        }

function updateDashboardStats() {
            const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser'));
            const totalCoursesElement = document.getElementById('totalCourses');
            const totalStudentsElement = document.getElementById('totalStudents');
            const adminStatsCards = document.getElementById('adminStatsCards');
            const trainingManagerStatsCards = document.getElementById('trainingManagerStatsCards');
            const studentStatsCards = document.getElementById('studentStatsCards');
            const recentActivitySection = document.getElementById('recentActivitySection');
            const recentNotificationsSection = document.getElementById('recentNotificationsSection');
            const badgesEarnedSection = document.getElementById('badgesEarnedSection');
            const certificatesEarnedSection = document.getElementById('certificatesEarnedSection');

            if (loggedInUser && loggedInUser.role === 'student') {
                // Show student stats, hide admin and training manager stats
                if (adminStatsCards) adminStatsCards.style.display = 'none';
                if (trainingManagerStatsCards) trainingManagerStatsCards.style.display = 'none';
                if (studentStatsCards) studentStatsCards.style.display = 'grid';
                if (recentActivitySection) recentActivitySection.style.display = 'none';
                if (recentNotificationsSection) recentNotificationsSection.style.display = 'block';
                if (badgesEarnedSection) badgesEarnedSection.style.display = 'block';
                if (certificatesEarnedSection) certificatesEarnedSection.style.display = 'block';

                // Get the latest user data from allUsersData for accurate stats
                const currentUser = allUsersData.find(u => u.id === loggedInUser.id);
                
                // Update student stats - with null checks
                const enrolledCoursesElement = document.getElementById('studentEnrolledCourses');
                const totalHoursElement = document.getElementById('studentTotalHours');
                const badgesElement = document.getElementById('studentBadgesCount');

                if (enrolledCoursesElement && currentUser) {
                    const enrolledCoursesCount = currentUser.coursesEnrolled ? currentUser.coursesEnrolled.length : 0;
                    enrolledCoursesElement.textContent = enrolledCoursesCount;
                }

                if (totalHoursElement && currentUser) {
                    const totalHours = currentUser.totalHoursSpent || 0;
                    totalHoursElement.textContent = totalHours.toFixed(1);
                }

                if (badgesElement) {
                    // Count student badges
                    const studentBadges = studentBadgesData.filter(b => b.studentId === loggedInUser.id);
                    const badgesCount = studentBadges.length;
                    badgesElement.textContent = badgesCount;
                }

                // Load recent notifications
                setTimeout(() => loadStudentNotifications(loggedInUser.id), 100);
                
                // Load badges earned
                setTimeout(() => loadStudentBadgesEarned(loggedInUser.id), 100);

                // Load certificates earned
                setTimeout(() => loadStudentCertificatesEarned(loggedInUser.id), 100);
            } else if (loggedInUser && loggedInUser.role === 'training_manager') {
                // Show training manager stats, hide admin and student stats
                if (adminStatsCards) adminStatsCards.style.display = 'none';
                if (trainingManagerStatsCards) trainingManagerStatsCards.style.display = 'grid';
                if (studentStatsCards) studentStatsCards.style.display = 'none';
                if (recentActivitySection) recentActivitySection.style.display = 'block';
                if (recentNotificationsSection) recentNotificationsSection.style.display = 'none';
                if (badgesEarnedSection) badgesEarnedSection.style.display = 'none';
                if (certificatesEarnedSection) certificatesEarnedSection.style.display = 'none';

                // Calculate course statistics for training manager
                const students = allUsersData.filter(user => user.role === 'student');
                const myCourses = allCoursesData.filter(course => course.creatorId === loggedInUser.id);
                const myCourseIds = myCourses.map(c => c.id);
                
                let completedCount = 0;
                let inProgressCount = 0;
                let notStartedCount = 0;
                
                students.forEach(student => {
                    if (!student.coursesEnrolled) return;
                    
                    student.coursesEnrolled.forEach(enrollment => {
                        if (myCourseIds.includes(enrollment.courseId)) {
                            if (enrollment.completionDate) {
                                completedCount++;
                            } else if (enrollment.hoursSpent && enrollment.hoursSpent > 0) {
                                inProgressCount++;
                            } else {
                                notStartedCount++;
                            }
                        }
                    });
                });
                
                // Update dashboard counters
                const totalStudentsElement = document.getElementById('dashboardTotalStudents');
                const completedElement = document.getElementById('dashboardCoursesCompleted');
                const inProgressElement = document.getElementById('dashboardCoursesInProgress');
                const notStartedElement = document.getElementById('dashboardCoursesNotStarted');
                
                if (totalStudentsElement) totalStudentsElement.textContent = students.length;
                if (completedElement) completedElement.textContent = completedCount;
                if (inProgressElement) inProgressElement.textContent = inProgressCount;
                
                if (notStartedElement) notStartedElement.textContent = notStartedCount;


            } else {
                // Show admin stats, hide training manager and student stats
                if (adminStatsCards) adminStatsCards.style.display = 'grid';
                if (trainingManagerStatsCards) trainingManagerStatsCards.style.display = 'none';
                if (studentStatsCards) studentStatsCards.style.display = 'none';
                if (recentActivitySection) recentActivitySection.style.display = 'block';
                if (recentNotificationsSection) recentNotificationsSection.style.display = 'none';
                if (badgesEarnedSection) badgesEarnedSection.style.display = 'none';
                if (certificatesEarnedSection) certificatesEarnedSection.style.display = 'none';

                if (totalCoursesElement) {
                    totalCoursesElement.textContent = allCoursesData.length;
                }
                if (totalStudentsElement) {
                    const studentsCount = allUsersData.filter(user => user.role === 'student').length;
                    totalStudentsElement.textContent = studentsCount;
                }
            }
        }

function showPdfViewerModal(documentName, documentId) {
            pdfModalTitle.textContent = `View Document: ${documentName}`;
            simulatedPdfContentFileName.textContent = documentName;
            currentViewingDocumentId = documentId; // Store the ID
            
            // Set initial state of Mark as Read button based on document status
            const markAsReadBtn = document.getElementById('markAsReadBtn');
            const course = allCoursesData.find(c => c.id === documentId);
            if (course && course.readStatus) {
                markAsReadBtn.textContent = 'Already Read';
                markAsReadBtn.disabled = true;
                markAsReadBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
                markAsReadBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
            } else {
                markAsReadBtn.textContent = 'Mark as Read';
                markAsReadBtn.disabled = false;
                markAsReadBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
                markAsReadBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            }

            pdfViewerModal.classList.remove('hidden');
            pdfViewerModal.classList.add('show');
        }

function showQuickAssignModal(studentId) {
            // Show message with available programmes
            const student = allUsersData.find(u => u.id === studentId);
            if (!student) return;
            
            if (allProgramsData.length === 0) {
                showMessageModal('No Programmes', 'Please create programmes first before assigning students.');
                return;
            }
            
            // Navigate to assignment section - programmes tab
            showSection('assignment-overviewContent');
            switchAssignmentTab('programmes');
            showMessageModal('Quick Assign', `Please select a programme below to assign ${student.name} ${student.surname || ''}.`);
        }

function showStudentCourses(type) {
  const container = document.getElementById("studentCoursesList");
  const tabInProgress = document.getElementById("tabInProgress");
  const tabCompleted = document.getElementById("tabCompleted");

  if (!container) return;

  // Tab styling
  if (type === "completed") {
    tabCompleted.className = "px-5 py-2 rounded-md text-sm font-medium bg-green-600 text-white transition";
    tabInProgress.className = "px-5 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-800 transition";
  } else {
    tabInProgress.className = "px-5 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white transition";
    tabCompleted.className = "px-5 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-800 transition";
  }

  container.innerHTML = "";

  // Get the logged-in user
  const user = allUsersData.find(u => u.id === loggedInUser.id);
  if (!user) {
    container.innerHTML = `<p class="text-gray-500 text-sm col-span-full">Please log in to view courses.</p>`;
    return;
  }

  // Get user's enrolled courses from allCoursesData
  const userEnrolledCourses = user.coursesEnrolled ? user.coursesEnrolled.map(enrollment => {
    const course = allCoursesData.find(c => c.id === enrollment.courseId);
    if (course) {
      return {
        ...course,
        hoursSpent: enrollment.hoursSpent || 0,
        completionDate: enrollment.completionDate,
        enrollmentDate: enrollment.enrollmentDate,
        type: 'video' // Default type for allCoursesData courses
      };
    }
    return null;
  }).filter(c => c !== null) : [];

  // Combine with demo studentCourses for now (can be removed later)
  const allCourses = [...userEnrolledCourses, ...studentCourses];

  const filtered = allCourses.filter(course => {
    if (course.completionDate) {
      // Course has completion date, it's completed
      return type === "completed";
    } else {
      // Course doesn't have completion date, it's in progress
      return type === "inprogress";
    }
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <p class="text-gray-500 text-sm col-span-full">
        No courses found in this section.
      </p>`;
    return;
  }

  filtered.forEach(course => {
    const courseImage = course.picture || "https://placehold.co/400x200/E0E7FF/4F46E5?text=Course+Image";
    const isCompleted = course.completionDate ? true : false;
    const statusBadge = isCompleted ? "Completed" : "In Progress";
    const badgeClass = isCompleted ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20" : "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20";
    
    // Get deadline information
    const deadlineInfo = getCourseDeadlineInfo(course);
    
    // Check if course was recently assigned (within last 7 days)
    const isNewlyAssigned = course.enrollmentDate && 
      (new Date() - new Date(course.enrollmentDate)) < (7 * 24 * 60 * 60 * 1000);
    
    let courseCard = `
      <div onclick="viewStudentCourse(${course.id}, '${course.name}')" class="group relative bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden cursor-pointer ${isNewlyAssigned ? 'ring-2 ring-blue-400' : ''} ${deadlineInfo.status === 'overdue' || deadlineInfo.status === 'today' ? 'ring-2 ring-red-400' : deadlineInfo.status === 'tomorrow' || deadlineInfo.status === 'urgent' ? 'ring-2 ring-yellow-400' : ''}">
        <!-- Hover Overlay -->
        <div class="absolute inset-0 bg-gray-900 bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex flex-col items-center justify-center z-20 pointer-events-none">
            <i class="fas fa-eye text-white text-4xl opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-50 group-hover:scale-100 mb-2"></i>
            <span class="text-white font-bold tracking-wide text-lg opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 uppercase">Open</span>
        </div>
        <div class="relative w-full h-28 overflow-hidden bg-gray-200">
          <img src="${courseImage}" alt="${course.name}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300" onerror="this.src='https://placehold.co/400x200/E0E7FF/4F46E5?text=${encodeURIComponent(course.name)}'">
          ${isNewlyAssigned ? '<span class="absolute top-3 left-3 text-xs px-3 py-1 rounded-full font-medium bg-blue-600 text-white animate-pulse"><i class="las la-sparkles mr-1"></i>NEW</span>' : ''}
          <span class="absolute top-3 right-3 text-xs px-3 py-1 rounded-full font-medium ${badgeClass}">
            ${statusBadge}
          </span>
        </div>
        <div class="p-3 flex flex-col items-center justify-center min-h-[180px]">
          <h3 class="font-semibold text-gray-800 mb-1 text-sm text-center">${course.name}</h3>
          <p class="text-xs text-gray-600 mb-2 text-center">${course.description || "No description available"}</p>
          ${deadlineInfo.badge ? `<div class="mb-2 text-xs text-center">${deadlineInfo.badge}</div>` : ''}
          ${!isCompleted 
            ? `<div class="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                <div class="bg-indigo-600 h-1.5 rounded-full" style="width: ${course.hoursSpent || 0}%"></div>
              </div>
              <p class="text-xs text-gray-600 mb-2 text-center">Hours: <span class="font-medium">${course.hoursSpent || 0}</span></p>`
            : `<p class="text-xs text-gray-600 mb-2 text-center">Completed on ${new Date(course.completionDate).toLocaleDateString()}</p>`
          }
        </div>
      </div>
    `;
    container.innerHTML += courseCard;
  });
}

function showBadgeDetails(badgeId, name, description, icon, hoursRequired, earnedDate) {
            document.getElementById('badgeViewerIcon').textContent = icon;
            document.getElementById('badgeViewerName').textContent = name;
            document.getElementById('badgeViewerDescription').textContent = description;
            document.getElementById('badgeViewerRequirement').textContent = `Complete ${hoursRequired} hours of learning`;
            document.getElementById('badgeEarnedDate').textContent = earnedDate;
            document.getElementById('badgeViewerModal').classList.remove('hidden');
            document.getElementById('badgeViewerModal').classList.add('show');
        }

function showViewAssignmentModal(assignmentId) {
            const assignment = allAssignmentsData.find(a => String(a.id) === String(assignmentId));
            if (!assignment) return;

            document.getElementById('viewAssignmentTitle').textContent = assignment.title;
            document.getElementById('viewAssignmentDueDate').textContent = new Date(assignment.dueDate).toLocaleDateString();
            document.getElementById('viewAssignmentTotalMarks').textContent = assignment.totalMarks || 0;
            document.getElementById('viewAssignmentInstructions').textContent = assignment.instructions;
            
            // Determine if the current user is a student or TM
            const isStudent = loggedInUser && loggedInUser.role === 'student' && assignment.assignedStudentId === loggedInUser.id;
            const isTrainingManager = loggedInUser && (loggedInUser.role === 'training-manager' || loggedInUser.role === 'training_manager');
            
            // Show/hide sections based on role
            const studentSection = document.getElementById('studentSubmissionSection');
            const tmGradeSection = document.getElementById('tmGradeSection');
            const submitBtn = document.getElementById('submitAssignmentBtn');
            const gradeBtn = document.getElementById('gradeAssignmentBtn');
            
            if (isStudent) {
                if (studentSection) studentSection.style.display = 'block';
                if (tmGradeSection) tmGradeSection.style.display = 'none';
                if (submitBtn) submitBtn.style.display = 'inline-block';
                if (gradeBtn) gradeBtn.style.display = 'none';
                
                // Show existing submission files if any
                const existingFilesContainer = document.getElementById('existingSubmissionFiles');
                if (existingFilesContainer) {
                    existingFilesContainer.innerHTML = '';
                    if (assignment.submissionFiles && assignment.submissionFiles.length > 0) {
                        existingFilesContainer.innerHTML = '<p class="text-xs text-gray-600 font-medium mb-2">Previously Submitted:</p>';
                        assignment.submissionFiles.forEach(file => {
                            const fileDiv = document.createElement('div');
                            fileDiv.className = 'flex items-center gap-2 p-2 bg-green-50 rounded-md hover:bg-green-100 transition border border-green-200';
                            
                            let icon = 'la-file';
                            if (file.fileType === 'PDF') icon = 'la-file-pdf';
                            else if (file.fileType === 'PPT' || file.fileType === 'PPTX') icon = 'la-file-powerpoint';
                            else if (file.fileType === 'DOC' || file.fileType === 'DOCX') icon = 'la-file-word';
                            
                            fileDiv.innerHTML = `
                                <i class="fas ${icon} text-green-600 text-sm"></i>
                                <span class="flex-1 text-xs text-gray-800">${file.fileName}</span>
                                <span class="text-xs text-gray-500">${file.fileSize}</span>
                                <button onclick="viewAssignmentDocument('${file.fileUrl}', '${file.fileName}', '${file.fileType}')" class="text-blue-600 hover:text-blue-800 text-xs px-2">
                                    <i class="fas fa-eye"></i>
                                </button>
                            `;
                            existingFilesContainer.appendChild(fileDiv);
                        });
                    }
                }
                
                // Update button text based on status
                if (assignment.status === 'Submitted' || assignment.status === 'Graded' || assignment.status === 'Read') {
                    submitBtn.innerHTML = '<i class="las la-sync mr-2"></i>Resubmit Assignment';
                } else {
                    submitBtn.innerHTML = '<i class="las la-check-circle mr-2"></i>Submit Assignment';
                }
            } else if (isTrainingManager) {
                if (studentSection) studentSection.style.display = 'none';
                if (tmGradeSection) tmGradeSection.style.display = assignment.status === 'Submitted' ? 'block' : 'none';
                if (submitBtn) submitBtn.style.display = 'none';
                if (gradeBtn) gradeBtn.style.display = assignment.status === 'Submitted' ? 'inline-block' : 'none';
                
                // Populate grade fields if already graded
                if (assignment.score !== null && assignment.score !== undefined) {
                    document.getElementById('assignmentScoreInput').value = assignment.score;
                }
                if (assignment.feedback) {
                    document.getElementById('assignmentFeedback').value = assignment.feedback;
                }
                if (assignment.status) {
                    document.getElementById('assignmentGradeStatus').value = assignment.status === 'Graded' || assignment.status === 'Needs Revision' ? assignment.status : 'Graded';
                }
                
                // Show student's submission files (reuse existingFilesContainer reference)
                const tmExistingFiles = document.getElementById('existingSubmissionFiles');
                if (tmExistingFiles && assignment.submissionFiles && assignment.submissionFiles.length > 0) {
                    tmExistingFiles.style.display = 'block';
                    tmExistingFiles.innerHTML = '<h5 class="text-sm font-semibold text-gray-700 mb-2"><i class="las la-file-upload mr-2 text-green-600"></i>Student Submissions:</h5>';
                    assignment.submissionFiles.forEach(file => {
                        const fileDiv = document.createElement('div');
                        fileDiv.className = 'flex items-center gap-2 p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition border border-gray-200';
                        
                        let icon = 'la-file';
                        let color = 'indigo';
                        if (file.fileType === 'PDF') { icon = 'la-file-pdf'; color = 'red'; }
                        else if (file.fileType === 'PPT' || file.fileType === 'PPTX') { icon = 'la-file-powerpoint'; color = 'orange'; }
                        else if (file.fileType === 'DOC' || file.fileType === 'DOCX') { icon = 'la-file-word'; color = 'blue'; }
                        
                        fileDiv.innerHTML = `
                            <i class="fas ${icon} text-${color}-600 text-sm"></i>
                            <span class="flex-1 text-xs text-gray-800">${file.fileName}</span>
                            <span class="text-xs text-gray-500">${file.fileSize}</span>
                            <button onclick="viewAssignmentDocument('${file.fileUrl}', '${file.fileName}', '${file.fileType}')" class="text-blue-600 hover:text-blue-800 text-xs px-2">
                                <i class="fas fa-eye mr-1"></i>View
                            </button>
                            ${(typeof loggedInUser !== "undefined" && loggedInUser && loggedInUser.role === "training-manager") ? `<a href="${file.fileUrl}" download="${file.fileName}" class="text-green-600 hover:text-green-800 text-xs px-2"><i class="las la-download"></i></a>` : ""}
                        `;
                        tmExistingFiles.appendChild(fileDiv);
                    });
                } else {
                    if (tmExistingFiles) tmExistingFiles.style.display = 'none';
                }
            }
            
            // Display documents
            const documentsList = document.getElementById('viewAssignmentDocumentsList');
            documentsList.innerHTML = '';
            
            if (assignment.documents && assignment.documents.length > 0) {
                assignment.documents.forEach(doc => {
                    const docDiv = document.createElement('div');
                    docDiv.className = 'flex items-center gap-2 p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition border border-gray-200';
                    
                    let icon = 'la-file';
                    let color = 'indigo';
                    if (doc.fileType === 'PDF') { icon = 'la-file-pdf'; color = 'red'; }
                    else if (doc.fileType === 'PPT' || doc.fileType === 'PPTX') { icon = 'la-file-powerpoint'; color = 'orange'; }
                    else if (doc.fileType === 'DOC' || doc.fileType === 'DOCX') { icon = 'la-file-word'; color = 'blue'; }
                    
                    docDiv.innerHTML = `
                        <i class="fas ${icon} text-${color}-600 text-lg"></i>
                        <div class="flex-1">
                            <div class="text-sm font-medium text-gray-900">${doc.fileName}</div>
                            <div class="text-xs text-gray-500">${doc.fileSize}</div>
                        </div>
                        <button onclick="viewAssignmentDocument('${doc.fileUrl}', '${doc.fileName}', '${doc.fileType}')" class="text-blue-600 hover:text-blue-800 px-3 py-1 text-sm">
                            <i class="fas fa-eye mr-1"></i>View
                        </button>
                        ${(typeof loggedInUser !== "undefined" && loggedInUser && loggedInUser.role === "training-manager") ? `<a href="${doc.fileUrl}" download="${doc.fileName}" class="text-green-600 hover:text-green-800 px-3 py-1 text-sm"><i class="las la-download"></i></a>` : ""}
                    `;
                    documentsList.appendChild(docDiv);
                });
            } else if (assignment.documentFileUrl && assignment.documentFileName) {
                // Fallback for old format
                const docDiv = document.createElement('a');
                docDiv.href = assignment.documentFileUrl;
                docDiv.target = '_blank';
                docDiv.className = 'flex items-center gap-2 p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition';
                
                let icon = 'la-file';
                if (assignment.documentType === 'PDF') icon = 'la-file-pdf';
                else if (assignment.documentType === 'PPT' || assignment.documentType === 'PPTX') icon = 'la-file-powerpoint';
                else if (assignment.documentType === 'DOC' || assignment.documentType === 'DOCX') icon = 'la-file-word';
                
                docDiv.innerHTML = `
                    <i class="fas ${icon} text-indigo-600 text-lg"></i>
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-900">${assignment.documentFileName}</div>
                    </div>
                    <i class="las la-download text-gray-400"></i>
                `;
                documentsList.appendChild(docDiv);
            }
            
            // Display questions if they exist
            const questionsSection = document.getElementById('viewAssignmentQuestionsSection');
            const questionsList = document.getElementById('viewAssignmentQuestionsList');
            
            if (assignment.questions && assignment.questions.length > 0) {
                questionsList.innerHTML = '';
                assignment.questions.forEach(question => {
                    const questionDiv = document.createElement('div');
                    questionDiv.className = 'bg-gray-50 border border-gray-200 rounded-md p-3';
                    questionDiv.innerHTML = `
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="flex-shrink-0 w-7 h-7 bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 rounded-full flex items-center justify-center font-bold text-xs">
                                        ${question.number}
                                    </span>
                                    <span class="text-sm font-medium text-gray-900">${question.text}</span>
                                </div>
                            </div>
                            <div class="ml-3 flex-shrink-0">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">
                                    <i class="las la-star text-xs mr-1"></i>${question.marks} marks
                                </span>
                            </div>
                        </div>
                    `;
                    questionsList.appendChild(questionDiv);
                });
                questionsSection.style.display = 'block';
            } else {
                questionsSection.style.display = 'none';
            }
            
            // Store assignmentId on buttons (already declared above)
            submitBtn.dataset.assignmentId = assignmentId;
            gradeBtn.dataset.assignmentId = assignmentId;
            
            document.getElementById('viewAssignmentModal').classList.remove('hidden');
            document.getElementById('viewAssignmentModal').classList.add('show');
        }

function hideMessageModal() {
            messageModal.classList.remove('show');
            messageModal.classList.add('hidden');
        }

function toggleDropdown(button) {
            const menu = button.nextElementSibling;
            if (menu && menu.classList.contains('dropdown-menu')) {
                menu.classList.toggle('hidden');
            }
        }

function hideAssignStudentsModal() {
            assignStudentsModal.classList.remove('show');
            assignStudentsModal.classList.add('hidden');
            currentProgrammeIdToAssign = null;
        }

function viewProgrammeDetails(programmeId) {
    const programme = allProgramsData.find(p => p.id === programmeId);
    if (!programme) {
        showMessageModal('Error', 'Programme not found.');
        return;
    }
    
    const user = allUsersData.find(u => u.id === loggedInUser.id);
    const userEnrolledCourses = user ? (user.coursesEnrolled || []) : [];
    
    // Get linked courses
    const linkedCourses = programme.linkedCourseIds 
        ? programme.linkedCourseIds.map(courseId => allCoursesData.find(c => c.id === courseId)).filter(c => c)
        : [];
    
    // Build courses list HTML
    const coursesListHTML = linkedCourses.length > 0 
        ? linkedCourses.map(course => {
            const enrollment = userEnrolledCourses.find(e => e.courseId === course.id);
            const isCourseCompleted = enrollment && enrollment.completionDate;
            const courseImage = course.picture || 'https://placehold.co/400x200/E0E7FF/4F46E5?text=Course';
            
            return `
                <div class="bg-white border-2 ${isCourseCompleted ? 'border-green-300' : 'border-gray-200'} rounded-lg p-4 hover:shadow-md transition">
                    <div class="flex items-start gap-4">
                        <img src="${courseImage}" alt="${course.name}" class="w-20 h-20 rounded-lg object-cover" onerror="this.src='https://placehold.co/80x80/E0E7FF/4F46E5?text=Course'">
                        <div class="flex-1">
                            <div class="flex items-start justify-between mb-2">
                                <h4 class="font-semibold text-gray-800">${course.name}</h4>
                                ${isCourseCompleted 
                                    ? '<span class="text-xs px-2 py-1 bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 rounded-full font-medium"><i class="las la-check mr-1"></i>Done</span>'
                                    : '<span class="text-xs px-2 py-1 bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 rounded-full font-medium"><i class="las la-clock mr-1"></i>Pending</span>'
                                }
                            </div>
                            <p class="text-sm text-gray-600 mb-3">${course.description || 'No description'}</p>
                            <button onclick="viewStudentCourse(${course.id}, '${course.name}')" class="text-sm px-4 py-2 rounded-md ${isCourseCompleted 
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            } transition">
                                ${isCourseCompleted ? '<i class="fas fa-eye mr-1"></i>Review' : '<i class="las la-play mr-1"></i>Start Course'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('')
        : '<p class="text-gray-500 text-center py-8">No courses linked to this programme yet.</p>';
    
    // Show modal with programme details
    const programmeImage = programme.picture || 'https://placehold.co/400x200/ADD8E6/00008B?text=Programme';
    const totalCourses = linkedCourses.length;
    const completedCoursesInProgramme = linkedCourses.filter(course => {
        const enrollment = userEnrolledCourses.find(e => e.courseId === course.id);
        return enrollment && enrollment.completionDate;
    }).length;
    const progressPercentage = totalCourses > 0 ? Math.round((completedCoursesInProgramme / totalCourses) * 100) : 0;
    
    const modalContent = `
        <div class="max-w-4xl mx-auto">
            <div class="relative w-full h-64 overflow-hidden rounded-t-lg bg-gradient-to-br from-blue-100 to-indigo-100 mb-6">
                <img src="${programmeImage}" alt="${programme.name}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/800x300/ADD8E6/00008B?text=${encodeURIComponent(programme.name)}'">
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                    <h2 class="text-3xl font-bold text-white mb-2">${programme.name}</h2>
                    <p class="text-white/90 text-sm">${totalCourses} ${totalCourses === 1 ? 'Course' : 'Courses'} in this programme</p>
                </div>
            </div>
            
            <div class="px-6 pb-6">
                <!-- Progress Section -->
                <div class="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-5 mb-6">
                    <div class="flex justify-between items-center mb-3">
                        <h3 class="font-semibold text-gray-800">Your Progress</h3>
                        <span class="text-2xl font-bold ${progressPercentage === 100 ? 'text-green-600' : 'text-indigo-600'}">${progressPercentage}%</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-4 mb-2">
                        <div class="h-4 rounded-full transition-all duration-500 ${progressPercentage === 100 ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}" style="width: ${progressPercentage}%"></div>
                    </div>
                    <p class="text-sm text-gray-600">${completedCoursesInProgramme} of ${totalCourses} courses completed</p>
                </div>
                
                <!-- Courses List -->
                <h3 class="font-semibold text-gray-800 mb-4 flex items-center">
                    <i class="las la-book text-indigo-600 mr-2"></i>
                    Programme Courses
                </h3>
                <div class="space-y-3 max-h-96 overflow-y-auto">
                    ${coursesListHTML}
                </div>
            </div>
        </div>
    `;
    
    // Create and show modal
    const modal = document.createElement('div');
    modal.id = 'programmeDetailsModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div class="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
                <h2 class="text-xl font-bold text-gray-800">Programme Details</h2>
                <button onclick="closeProgrammeDetailsModal()" class="text-gray-500 hover:text-gray-700 text-2xl font-bold">
                    <i class="las la-times"></i>
                </button>
            </div>
            ${modalContent}
        </div>
    `;
    
    document.body.appendChild(modal);
}

function renderTrainingManagerCoursesTable() {
            const tableBody = document.getElementById('trainingManagerCoursesTableBody');
            tableBody.innerHTML = '';
            const myCourses = allCoursesData.filter(course => course.creatorId === loggedInUser.id);

            if (myCourses.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">No courses created by you. Create a new course above.</td>
                    </tr>
                `;
            } else {
                myCourses.forEach(course => {
                    const newRow = tableBody.insertRow();
                    newRow.classList.add('cursor-pointer', 'hover:bg-gray-50');

                    const totalMarks = course.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
                    const deadlineInfo = getCourseDeadlineInfo(course);

                    newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"><img src="${course.picture}" alt="Course" class="h-10 w-10 rounded-md object-cover"></td>`;
                    newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${course.name}${deadlineInfo.badge}</td>`;
                    newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${course.description.substring(0, 50)}${course.description.length > 50 ? '...' : ''}</td>`;
                    newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${course.videos ? course.videos.length + ' video(s)' : (course.videoFileName ? '1 video' : 'N/A')}</td>`;
                    newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${course.pdfFileName || 'N/A'}</td>`;
                    newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${totalMarks}</td>`;
                    newRow.insertCell().outerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button onclick="editCourse(${course.id}, event)" class="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                            <button onclick="deleteCourse(${course.id}, event)" class="text-red-600 hover:text-red-900">Delete</button>
                        </td>
                    `;
                });
            }

            let currentCoursesCount = myCourses.length;
            document.getElementById('myCoursesTotalCount').textContent = currentCoursesCount;
            document.getElementById('myCoursesShowingCount').textContent = currentCoursesCount > 0 ? 1 : 0;
            document.getElementById('myCoursesTotalCountDisplay').textContent = currentCoursesCount;
        }

function renderUserTable() {
            const userTableBody = document.getElementById('userTableBody');
            userTableBody.innerHTML = ''; // Clear existing rows

            if (allUsersData.length === 0) {
                userTableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">No users to display. Click "Add User" to add new entries.</td>
                    </tr>
                `;
                document.getElementById('usersTotalCount').textContent = 0;
                document.getElementById('usersShowingCount').textContent = 0;
                document.getElementById('usersTotalCountDisplay').textContent = 0;
                return;
            }

            allUsersData.forEach(user => {
                const newRow = userTableBody.insertRow();
                newRow.classList.add('cursor-pointer', 'hover:bg-gray-50');
                newRow.dataset.userId = user.id;

                const fullName = `${user.name}${user.surname ? ' ' + user.surname : ''}`;

                const nameCell = newRow.insertCell();
                nameCell.classList.add('px-6', 'py-4', 'whitespace-nowrap');
                nameCell.innerHTML = `
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10">
                            <img class="h-10 w-10 rounded-full object-cover" src="${user.picture}" alt="${fullName}">
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${fullName}</div>
                            <div class="text-sm text-gray-500">${user.role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</div>
                        </div>
                    </div>
                `;

                newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>`;
                newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.idNumber}</td>`;
                newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.company}</td>`;
                
                const roleCell = newRow.insertCell();
                roleCell.classList.add('px-6', 'py-4', 'whitespace-nowrap');
                let roleColorClass;
                switch (user.role) {
                    case 'administrator':
                        roleColorClass = 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20';
                        break;
                    case 'training_manager':
                        roleColorClass = 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20';
                        break;
                    case 'student':
                        roleColorClass = 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20';
                        break;
                    default:
                        roleColorClass = 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20';
                }
                roleCell.innerHTML = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColorClass}">${user.role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</span>`;

                const statusCell = newRow.insertCell();
                statusCell.classList.add('px-6', 'py-4', 'whitespace-nowrap');
                let statusClass = user.status === 'active' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20';
                statusCell.innerHTML = `
                    <button class="status-toggle-btn px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}" data-status="${user.status}">
                        ${user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </button>
                `;
                statusCell.querySelector('.status-toggle-btn').addEventListener('click', function() {
                    const button = this;
                    const rowUserId = parseInt(button.closest('tr').dataset.userId);
                    let userToUpdate = allUsersData.find(u => u.id === rowUserId);

                    if (userToUpdate) {
                        if (userToUpdate.status === 'active') {
                            userToUpdate.status = 'deactivated';
                            userToUpdate.endDate = new Date().toISOString().slice(0, 10); // Set end date on deactivation
                            button.textContent = 'Deactivated';
                            button.classList.remove('bg-green-100', 'text-green-800');
                            button.classList.add('bg-red-100', 'text-red-800');
                            saveToLocalStorage(); // Save changes
                            showMessageModal('User Status', `User ${userToUpdate.name} status changed to Deactivated.`);
                        } else {
                            userToUpdate.status = 'active';
                            userToUpdate.endDate = null; // Clear end date on reactivation
                            button.textContent = 'Active';
                            button.classList.remove('bg-red-100', 'text-red-800');
                            button.classList.add('bg-green-100', 'text-green-800');
                            saveToLocalStorage(); // Save changes
                            showMessageModal('User Status', `User ${userToUpdate.name} status changed to Active.`);
                        }
                        updateDashboardStats(); // Update dashboard stats after status change
                    }
                });

                newRow.insertCell().outerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button type="button" onclick="editUser(${user.id})" class="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                        <button type="button" onclick="deleteUser(${user.id})" class="text-red-600 hover:text-red-900">Delete</button>
                    </td>
                `;
            });

            document.getElementById('usersTotalCount').textContent = allUsersData.length;
            document.getElementById('usersShowingCount').textContent = allUsersData.length > 0 ? 1 : 0;
            document.getElementById('usersTotalCountDisplay').textContent = allUsersData.length;
        }

function hideCreateAssignmentModal() {
            const createAssignmentModal = document.getElementById('createAssignmentModal');
            if (!createAssignmentModal) return;
            createAssignmentModal.classList.remove('show');
            createAssignmentModal.classList.add('hidden');
            clearAssignmentQuestions();
        }

function showMessageModal(title, content, onConfirm, isConfirmation) {
            messageModalTitle.textContent = title;
            messageModalContent.textContent = content;
            
            const okBtn = document.getElementById('messageModalOkBtn');
            const cancelBtn = document.getElementById('messageModalCancelBtn');
            
            // Reset previous event listeners by cloning
            const newOkBtn = okBtn.cloneNode(true);
            okBtn.parentNode.replaceChild(newOkBtn, okBtn);
            
            if (isConfirmation && onConfirm) {
                // Show both buttons for confirmation
                newOkBtn.textContent = 'Yes';
                cancelBtn.classList.remove('hidden');
                
                newOkBtn.addEventListener('click', function() {
                    hideMessageModal();
                    onConfirm();
                });
            } else {
                // Show only OK button for simple messages
                newOkBtn.textContent = 'Close';
                cancelBtn.classList.add('hidden');
                
                newOkBtn.addEventListener('click', function() {
                    hideMessageModal();
                    if (onConfirm) onConfirm();
                });
            }
            
            messageModal.classList.remove('hidden');
            messageModal.classList.add('show');
        }

function updateQuestionText(questionId, text) {
            const question = assignmentQuestions.find(q => q.id === questionId);
            if (question) {
                question.text = text;
            }
        }

function renderCourseVideosList() {
            const container = document.getElementById('courseVideosList');
            if (currentCourseVideos.length === 0) {
                container.innerHTML = '';
                return;
            }

            container.innerHTML = `
                <div class="bg-white border-2 border-blue-200 rounded-lg p-4 shadow-sm">
                    <h5 class="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <i class="las la-list text-blue-600 mr-2"></i>Added Videos (${currentCourseVideos.length})
                    </h5>
                    <div class="space-y-2">
                        ${currentCourseVideos.map((video, index) => {
                            const sourceInfo = video.isFile 
                                ? `<i class="las la-file-video text-purple-600 mr-1"></i>File: ${video.fileName} (${video.fileSize})`
                                : `<i class="las la-link text-blue-600 mr-1"></i>URL: ${video.url.substring(0, 50)}...`;
                            return `
                            <div class="flex items-center justify-between bg-gradient-to-r from-gray-50 to-blue-50 p-3 rounded-lg border border-gray-200">
                                <div class="flex-1">
                                    <div class="text-sm font-medium text-gray-900 flex items-center">
                                        <i class="las la-play-circle text-blue-600 mr-2"></i>${video.title}
                                    </div>
                                    <div class="text-xs text-gray-600 mt-1">
                                        <i class="las la-clock text-gray-500 mr-1"></i>${video.duration} • ${sourceInfo}
                                    </div>
                                </div>
                                <button type="button" onclick="removeCourseVideo(${index})" class="text-red-600 hover:text-red-900 ml-3 p-2 hover:bg-red-50 rounded-lg transition">
                                    <i class="las la-trash"></i>
                                </button>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `;
        }

function updateAllEventsList() {
            let html = '';
            const sortedEvents = [...calendarEvents]
                .sort((a, b) => a.date - b.date);
            
            if (sortedEvents.length === 0) {
                html = '<tr><td class="px-6 py-4 text-center text-gray-500" colspan="5">No events scheduled</td></tr>';
            } else {
                sortedEvents.forEach(event => {
                    const dateStr = event.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                    const isUpcoming = event.date >= new Date();
                    const status = isUpcoming ? '<span class="px-2 py-1 bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 text-xs rounded">Upcoming</span>' 
                                              : '<span class="px-2 py-1 bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 text-xs rounded">Completed</span>';
                    
                    html += `
                        <tr class="hover:bg-gray-50 transition">
                            <td class="px-6 py-4 text-sm">
                                <span class="px-2 py-1 ${getEventTypeColor(event.type)} text-xs rounded font-medium">${event.type}</span>
                            </td>
                            <td class="px-6 py-4 text-sm font-medium text-gray-900">${getEventTypeIcon(event.type)} ${event.title}</td>
                            <td class="px-6 py-4 text-sm text-gray-600">${dateStr}</td>
                            <td class="px-6 py-4 text-sm">${status}</td>
                            <td class="px-6 py-4 text-sm">
                                <button class="text-indigo-600 hover:text-indigo-900 font-semibold">View Details</button>
                            </td>
                        </tr>
                    `;
                });
            }
            document.getElementById('allEventsList').innerHTML = html;
        }

function renderAllExistingCoursesTable() {
            const existingCoursesTableBody = document.getElementById('allExistingCoursesTableBody');
            existingCoursesTableBody.innerHTML = '';

            if (allCoursesData.length === 0) {
                existingCoursesTableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">No courses to display. Create a new course in "My Courses".</td>
                    </tr>
                `;
            } else {
                allCoursesData.forEach(course => {
                    const creator = allUsersData.find(user => user.id === course.creatorId);
                    const creatorName = creator ? `${creator.name}${creator.surname ? ' ' + creator.surname : ''}` + (creator.role ? ` (${creator.role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')})` : '') : 'Unknown';

                    const newRow = existingCoursesTableBody.insertRow();
                    newRow.classList.add('cursor-pointer', 'hover:bg-gray-50');

                    const totalMarks = course.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
                    const deadlineInfo = getCourseDeadlineInfo(course);

                    newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"><img src="${course.picture}" alt="Course" class="h-10 w-10 rounded-md object-cover"></td>`;
                    newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${course.name}${deadlineInfo.badge}</td>`;
                    newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${course.description.substring(0, 50)}${course.description.length > 50 ? '...' : ''}</td>`;
                    newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${course.videos ? course.videos.length + ' video(s)' : (course.videoFileName ? '1 video' : 'N/A')}</td>`;
                    newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${course.pdfFileName || 'N/A'}</td>`;
                    newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${totalMarks}</td>`;
                    newRow.insertCell().outerHTML = `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${creatorName}</td>`;
                    newRow.insertCell().outerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button onclick="editCourse(${course.id}, event)" class="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                            <button onclick="deleteCourse(${course.id}, event)" class="text-red-600 hover:text-red-900">Delete</button>
                        </td>
                    `;
                });
            }

            let currentCoursesCount = allCoursesData.length;
            document.getElementById('allCoursesTotalCount').textContent = currentCoursesCount;
            document.getElementById('allCoursesShowingCount').textContent = currentCoursesCount > 0 ? 1 : 0;
            document.getElementById('allCoursesTotalCountDisplay').textContent = currentCoursesCount;
        }

function renderExistingProgramsTable() {
            const tableBody = document.getElementById('existingProgrammesTableBody');
            tableBody.innerHTML = '';

            if (allProgramsData.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">No programmes to display. Create a new programme above.</td>
                    </tr>
                `;
            } else {
                allProgramsData.forEach(programme => {
                    const row = tableBody.insertRow();
                    row.classList.add('cursor-pointer', 'hover:bg-gray-50');
                    row.dataset.programmeId = programme.id; // Store programme ID on the row

                    const linkedCoursesCount = programme.linkedCourseIds.length;
                    const assignedStudentsCount = programme.assignedStudentIds.length;
                    
                    // Badge styling based on student count
                    const studentBadgeClass = assignedStudentsCount > 0 
                        ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 font-semibold' 
                        : 'bg-gray-100 text-gray-500';

                    row.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap"><img src="${programme.picture}" alt="Programme" class="h-10 w-10 rounded-md object-cover"></td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${programme.name}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${linkedCoursesCount} course(s)</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="text-xs px-3 py-1 rounded-full ${studentBadgeClass}">
                                ${assignedStudentsCount > 0 ? `<i class="las la-users mr-1"></i>` : ''}${assignedStudentsCount} student(s)
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button class="text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-2 rounded-lg mr-3 assign-students-btn shadow-sm font-medium transition" data-programme-id="${programme.id}">
                                <i class="las la-user-plus mr-1"></i>Assign Students
                            </button>
                            <a href="#" class="text-indigo-600 hover:text-indigo-900 mr-3">Edit</a>
                            <a href="#" class="text-red-600 hover:text-red-900">Delete</a>
                        </td>
                    `;
                });
            }

            // Update programme counts
            document.getElementById('programmesTotalCount').textContent = allProgramsData.length;
            document.getElementById('programmesShowingCount').textContent = allProgramsData.length > 0 ? 1 : 0;
            document.getElementById('programmesTotalCountDisplay').textContent = allProgramsData.length;
        }

function renderCoursesForAssignmentTable() {
            const tableBody = document.getElementById('coursesForAssignmentTableBody');
            tableBody.innerHTML = '';

            if (allCoursesData.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">No courses available for assignment. Create courses first.</td>
                    </tr>
                `;
            } else {
                allCoursesData.forEach(course => {
                    const row = tableBody.insertRow();
                    row.classList.add('hover:bg-gray-50');

                    // Count enrolled students
                    const enrolledStudents = allUsersData.filter(user => 
                        user.role === 'student' && 
                        user.coursesEnrolled.some(enr => enr.courseId === course.id)
                    );
                    const enrolledCount = enrolledStudents.length;
                    
                    // Get enrolled student names
                    const enrolledNames = enrolledStudents.map(s => 
                        `${s.name}${s.surname ? ' ' + s.surname : ''}`
                    ).join(', ') || 'None';

                    const totalMarks = course.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
                    const description = course.description || 'N/A';
                    const truncatedDesc = description.length > 50 ? description.substring(0, 50) + '...' : description;

                    row.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap"><img src="${course.picture}" alt="Course" class="h-10 w-10 rounded-md object-cover"></td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${course.name}</td>
                        <td class="px-6 py-4 text-sm text-gray-500" title="${description}">${truncatedDesc}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${totalMarks}</td>
                        <td class="px-6 py-4 text-sm text-gray-500" title="${enrolledNames}">${enrolledCount} student(s)</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button class="text-blue-600 hover:text-blue-900" onclick="showAssignStudentsToCoursesModal(${course.id})">
                                <i class="las la-users mr-1"></i>Assign/View Students
                            </button>
                        </td>
                    `;
                });
            }

            // Update course counts
            document.getElementById('assignCoursesTotalCount').textContent = allCoursesData.length;
            document.getElementById('assignCoursesShowingCount').textContent = allCoursesData.length > 0 ? 1 : 0;
            document.getElementById('assignCoursesTotalCountDisplay').textContent = allCoursesData.length;
        }

function renderUnassignedStudentsTable(students, assignedStudentIds) {
            const tableBody = document.getElementById('unassignedStudentsTableBody');
            tableBody.innerHTML = '';
            
            const unassignedStudents = students.filter(s => !assignedStudentIds.has(s.id));
            
            if (unassignedStudents.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="px-6 py-4 text-center text-sm text-green-600">
                            <i class="las la-check-circle mr-2"></i>All students are assigned to programmes.
                        </td>
                    </tr>
                `;
            } else {
                unassignedStudents.forEach(student => {
                    const fullName = `${student.name}${student.surname ? ' ' + student.surname : ''}`;
                    const registrationDate = student.registrationDate || 'N/A';
                    
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td class="px-6 py-4 text-sm font-medium text-gray-900">${fullName}</td>
                        <td class="px-6 py-4 text-sm text-gray-500">${student.email}</td>
                        <td class="px-6 py-4 text-sm text-gray-500">${registrationDate}</td>
                        <td class="px-6 py-4 text-sm font-medium">
                            <button onclick="showQuickAssignModal(${student.id})" class="text-indigo-600 hover:text-indigo-900">
                                <i class="las la-user-plus mr-1"></i>Assign Now
                            </button>
                        </td>
                    `;
                });
            }
        }

function hideBulkUploadModal() {
            bulkUploadModal.classList.remove('show');
            bulkUploadModal.classList.add('hidden');
            bulkUploadForm.reset();
            document.getElementById('uploadProgress').classList.add('hidden');
            document.getElementById('uploadResults').classList.add('hidden');
        }

function updateAssignmentSelectedCount() {
            const checkedBoxes = document.querySelectorAll('.assignment-student-checkbox:checked');
            const visibleChecked = Array.from(checkedBoxes).filter(cb => 
                cb.closest('.assignment-student-item').style.display !== 'none'
            );
            document.getElementById('selectedAssignmentStudentsCount').textContent = `${visibleChecked.length} students selected`;
        }

function renderCoursesWithoutStudentsTable() {
            const tableBody = document.getElementById('coursesWithoutStudentsTableBody');
            tableBody.innerHTML = '';
            
            // Find courses that are not linked to any programme or linked to programmes with no students
            const coursesWithoutStudents = allCoursesData.filter(course => {
                // Check if course is linked to any programme
                const linkedProgrammes = allProgramsData.filter(p => p.linkedCourseIds.includes(course.id));
                
                if (linkedProgrammes.length === 0) {
                    return true; // Not linked to any programme
                }
                
                // Check if any linked programme has students
                const hasStudents = linkedProgrammes.some(p => p.assignedStudentIds.length > 0);
                return !hasStudents;
            });
            
            if (coursesWithoutStudents.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" class="px-6 py-4 text-center text-sm text-green-600">
                            <i class="las la-check-circle mr-2"></i>All courses have enrolled students.
                        </td>
                    </tr>
                `;
            } else {
                coursesWithoutStudents.forEach(course => {
                    const row = tableBody.insertRow();
                    const totalMarks = course.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
                    
                    row.innerHTML = `
                        <td class="px-6 py-4 text-sm font-medium text-gray-900">${course.name}</td>
                        <td class="px-6 py-4 text-sm text-gray-500">${course.description || 'N/A'}</td>
                        <td class="px-6 py-4 text-sm text-gray-500">${totalMarks}</td>
                        <td class="px-6 py-4 text-sm font-medium">
                            <button onclick="navigateToCourseProgramme(${course.id})" class="text-indigo-600 hover:text-indigo-900">
                                <i class="las la-link mr-1"></i>Link to Programme
                            </button>
                        </td>
                    `;
                });
            }
        }

function updateTotalMarksFromQuestions() {
            if (assignmentQuestions.length > 0) {
                const totalFromQuestions = assignmentQuestions.reduce((sum, q) => sum + q.marks, 0);
                const marksInput = document.getElementById('assignmentMarksInput');
                if (marksInput && totalFromQuestions > 0) {
                    marksInput.value = totalFromQuestions;
                }
            }
        }

function updateCourseSelectedCount() {
            const checkedBoxes = document.querySelectorAll('.assign-course-student-checkbox:checked');
            const visibleCheckedBoxes = Array.from(checkedBoxes).filter(cb => 
                cb.closest('.course-student-item').style.display !== 'none'
            );
            document.getElementById('selectedCourseStudentsCount').textContent = `${visibleCheckedBoxes.length} students selected`;
        }

function viewDocument(courseId, docId) {
    const course = allCoursesData.find(c => c.id === courseId);
    if (!course) return;
    
    const doc = course.documents.find(d => d.id === docId);
    if (!doc) return;
    
    // Create a modal to view the document
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4 overflow-y-auto';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-2xl w-full max-w-5xl m-4">
            <div class="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg">
                <div>
                    <h2 class="text-2xl font-bold text-gray-800">${doc.title}</h2>
                    <p class="text-sm text-gray-600 mt-1">${(doc.type || '').toUpperCase()} • ${doc.fileSize}</p>
                </div>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700 text-3xl font-light">×</button>
            </div>
            <div class="flex-1 bg-gray-100 p-6 max-h-[70vh] overflow-y-auto">
                <div class="bg-white rounded-lg p-8 text-center">
                    <div class="mb-6">
                        <i class="${doc.icon} text-6xl text-${doc.color}-500 mb-4"></i>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-800 mb-2">${doc.title}</h3>
                    <p class="text-gray-600 mb-6">${doc.description}</p>
                    ${(doc.fileUrl && ((doc.type || '').toUpperCase() === 'PDF')) ? 
                        `<iframe src="${doc.fileUrl}#toolbar=0" class="w-full h-[500px] border border-gray-300 rounded-lg mb-6" oncontextmenu="return false;"></iframe>` : 
                        `<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <p class="text-sm text-blue-800">
                                <i class="las la-info-circle mr-2"></i>
                                ${(doc.fileUrl && (doc.type || '').toUpperCase() !== 'PDF') ? 'Document attached but cannot be previewed natively in the browser without downloading.' : 'This is a simulated document viewer. In a production environment, this would display the actual ' + (doc.type || '').toUpperCase() + ' file content.'}
                            </p>
                        </div>`
                    }
                    <div class="space-y-3 text-gray-600 text-sm">
                        <p><strong>File Name:</strong> ${doc.fileName}</p>
                        <p><strong>Type:</strong> ${doc.type === 'ppt' ? 'PowerPoint Presentation' : 'PDF Document'}</p>
                        <p><strong>File Size:</strong> ${doc.fileSize}</p>
                        <p><strong>Created:</strong> ${doc.createdDate}</p>
                    </div>
                </div>
            </div>
            <div class="p-6 border-t border-gray-200 bg-gray-50 flex justify-between items-center rounded-b-lg sticky bottom-0">
                <p class="text-sm text-gray-600"><i class="las la-file-${doc.type === 'ppt' ? 'powerpoint text-orange-500' : 'pdf text-red-500'} mr-2"></i>${doc.type === 'ppt' ? 'PowerPoint File' : 'PDF File'}</p>
                <div class="flex space-x-3">
                    <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition">
                        Close
                    </button>
                    <button onclick="markDocumentAsRead(${courseId}, ${docId}); this.closest('.fixed').remove();" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition">
                        <i class="las la-check mr-2"></i>Mark as Read & Close
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function viewStudentCourse(courseId, courseName) {
    let course = allCoursesData.find(c => c.id === courseId);
    let isRealCourse = !!course;
    
    if (!course) {
        course = studentCourses.find(c => c.id === courseId);
    }
    
    if (!course) {
        showMessageModal('Error', 'Course not found. Please try again.');
        return;
    }
    
    if (isRealCourse && (!course.sections || course.sections.length === 0) && ((course.videos && course.videos.length > 0) || (course.questions && course.questions.length > 0))) {
        if (course.videos && course.videos.length > 0) {
            course.sections = course.videos.map((video, index) => ({
                 id: courseId * 10 + index + 1,
                 title: video.title || `Video ${index + 1}`,
                 videoDuration: video.duration || "N/A",
                 videoUrl: video.url || null,
                 questions: index === course.videos.length - 1 ? (course.questions || []) : []
            }));
        } else {
            course.sections = [{
                id: courseId * 10 + 1,
                title: course.name,
                videoDuration: "N/A",
                videoUrl: null,
                questions: course.questions || []
            }];
        }
    }
    
    document.getElementById('courseViewerTitle').textContent = course.name;
    document.getElementById('courseViewerDescription').textContent = course.description || 'Learn about ' + course.name + '. This course covers essential concepts and practical skills.';
    document.getElementById('courseViewerCourseId').textContent = 'COURSE-' + courseId;
    document.getElementById('courseViewerProgress').textContent = course.progress || 0;

    window.currentViewingCourseId = courseId;
    window.currentCourse = course;

    // Reset views
    document.getElementById('videosContent').classList.add('hidden');
    document.getElementById('documentMainContent').classList.add('hidden');
    document.getElementById('assignmentMainContent').classList.add('hidden');

    const hasVideos = (course.videos && course.videos.length > 0) || (course.questions && course.questions.length > 0) || (course.sections && course.sections.length > 0);
    const hasDocuments = course.documents && course.documents.length > 0;
    
    // Auto-generate missing assignments from course templates just-in-time
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
                    creatorId: course.creatorId || (allUsersData.find(u => u.role === 'training_manager') ? allUsersData.find(u => u.role === 'training_manager').id : loggedInUser.id),
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
    const hasAssignments = courseAssignmentsList.length > 0;

    // Render Sidebars
    const sectionsContainer = document.getElementById('courseSidebarSections');
    const sectionsWrap = document.getElementById('courseSidebarSectionsContainer');
    let displaySections = course.sections || course.videos;
    if (hasVideos && displaySections) {
        sectionsWrap.classList.remove('hidden');
        sectionsContainer.innerHTML = displaySections.map((s, idx) => `
            <div class="sidebar-item px-3 py-2 rounded-md hover:bg-gray-800 cursor-pointer text-sm text-white flex items-center transition" onclick="loadSection(${s.id}, ${courseId})" id="sidebar-sec-${s.id}">
                <i class="las la-play-circle mr-3 text-indigo-500"></i>
                <span class="truncate truncate-lines-1">${s.title}</span>
            </div>
        `).join('');
    } else {
        sectionsWrap.classList.add('hidden');
    }

    const docsContainer = document.getElementById('courseSidebarDocuments');
    const docsWrap = document.getElementById('courseSidebarDocumentsContainer');
    if (hasDocuments) {
        docsWrap.classList.remove('hidden');
        docsContainer.innerHTML = course.documents.map(d => `
            <div class="sidebar-item px-3 py-2 rounded-md hover:bg-gray-800 cursor-pointer text-sm text-white flex items-center transition" onclick="loadDocumentView(${d.id}, ${courseId})" id="sidebar-doc-${d.id}">
                <i class="las la-file-alt mr-3 text-red-500"></i>
                <span class="truncate truncate-lines-1">${d.title}</span>
            </div>
        `).join('');
    } else {
        docsWrap.classList.add('hidden');
    }

    const astContainer = document.getElementById('courseSidebarAssignments');
    const astWrap = document.getElementById('courseSidebarAssignmentsContainer');
    if (hasAssignments) {
        astWrap.classList.remove('hidden');
        astContainer.innerHTML = courseAssignmentsList.map(a => `
            <div class="sidebar-item px-3 py-2 rounded-md hover:bg-gray-800 cursor-pointer text-sm text-white flex items-center transition" onclick="loadAssignmentView(${a.id}, ${courseId})" id="sidebar-ast-${a.id}">
                <i class="las la-tasks mr-3 text-blue-500"></i>
                <span class="truncate truncate-lines-1">${a.title}</span>
            </div>
        `).join('');
    } else {
        astWrap.classList.add('hidden');
    }
    
    // Copy the sidebars to mobile sidebars
    const mobileSidebarContent = document.getElementById('courseMobileSidebarContent');
    if(mobileSidebarContent) {
        mobileSidebarContent.innerHTML = '';
        if(hasVideos) mobileSidebarContent.appendChild(sectionsWrap.cloneNode(true));
        if(hasDocuments) mobileSidebarContent.appendChild(docsWrap.cloneNode(true));
        if(hasAssignments) mobileSidebarContent.appendChild(astWrap.cloneNode(true));
        
        // Fix onClick refs for clone node if needed, simpler is just innerHTML replacement:
        mobileSidebarContent.innerHTML = `
            ${hasVideos ? sectionsWrap.outerHTML : ''}
            ${hasDocuments ? docsWrap.outerHTML : ''}
            ${hasAssignments ? astWrap.outerHTML : ''}
        `;
    }

    // Default selection
    if (hasVideos) {
        loadSection(course.sections[0].id, courseId);
    } else if (hasDocuments) {
        loadDocumentView(course.documents[0].id, courseId);
    } else if (hasAssignments) {
        loadAssignmentView(courseAssignmentsList[0].id, courseId);
    } else {
        showMessageModal('No Content', 'This course has no content available yet.');
        return;
    }

    document.getElementById('courseViewerModal').classList.remove('hidden');
    document.getElementById('courseViewerModal').classList.add('show');
}

function renderGroupModalCheckboxes(selectedLearners = []) {
            const studentContainer = document.getElementById('groupStudentsList');
            if (studentContainer) studentContainer.innerHTML = '';

            const students = allUsersData.filter(u => u.role === 'student');    
            students.forEach(st => {
                const checked = (selectedLearners || []).map(String).includes(String(st.id)) ? 'checked' : '';
                studentContainer.innerHTML += `
                    <label class="inline-flex items-center mt-2">
                        <input type="checkbox" name="groupStudentCheck" value="${st.id}" class="form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded" ${checked}>
                        <span class="ml-2 text-sm text-gray-700">${st.name} (${st.email})</span>
                    </label>
                `;
            });
        }

function renderProgrammeDetailsTable() {
            const tableBody = document.getElementById('programmeDetailsTableBody');
            tableBody.innerHTML = '';
            
            if (allProgramsData.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">No programmes available.</td>
                    </tr>
                `;
            } else {
                allProgramsData.forEach(programme => {
                    const linkedCoursesNames = programme.linkedCourseIds.map(id => {
                        const course = allCoursesData.find(c => c.id === id);
                        return course ? course.name : 'Unknown';
                    }).join(', ') || 'None';
                    
                    const enrolledCount = programme.assignedStudentIds.length;
                    
                    // Calculate completion rate
                    let completionRate = 0;
                    if (enrolledCount > 0 && programme.linkedCourseIds.length > 0) {
                        let totalCompletedCourses = 0;
                        programme.assignedStudentIds.forEach(studentId => {
                            const student = allUsersData.find(u => u.id === studentId);
                            if (student) {
                                const completedInProgramme = student.coursesEnrolled.filter(enr => 
                                    programme.linkedCourseIds.includes(enr.courseId) && enr.completionDate
                                ).length;
                                totalCompletedCourses += completedInProgramme;
                            }
                        });
                        const totalPossible = enrolledCount * programme.linkedCourseIds.length;
                        completionRate = totalPossible > 0 ? Math.round((totalCompletedCourses / totalPossible) * 100) : 0;
                    }
                    
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td class="px-6 py-4 text-sm font-medium text-gray-900">${programme.name}</td>
                        <td class="px-6 py-4 text-sm text-gray-500">${programme.linkedCourseIds.length} course(s)</td>
                        <td class="px-6 py-4 text-sm text-gray-500">${enrolledCount} student(s)</td>
                        <td class="px-6 py-4 text-sm">
                            <div class="flex items-center">
                                <div class="w-full bg-gray-200 rounded-full h-2 mr-2">
                                    <div class="bg-green-600 h-2 rounded-full" style="width: ${completionRate}%"></div>
                                </div>
                                <span class="text-xs font-medium text-gray-600">${completionRate}%</span>
                            </div>
                        </td>
                        <td class="px-6 py-4 text-sm font-medium">
                            <button onclick="showAssignStudentsModal(${programme.id})" class="text-blue-600 hover:text-blue-900">
                                <i class="las la-users mr-1"></i>Manage
                            </button>
                        </td>
                    `;
                });
            }
        }

function showStudentProgrammes() {
    const container = document.getElementById('studentProgrammesList');
    const noMessage = document.getElementById('noProgrammesMessage');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    // Get the logged-in user
    const user = allUsersData.find(u => u.id === loggedInUser.id);
    if (!user) {
        noMessage.classList.remove('hidden');
        return;
    }
    
    // Find programmes where student is assigned
    const assignedProgrammes = allProgramsData.filter(programme => 
        programme.assignedStudentIds && programme.assignedStudentIds.includes(user.id)
    );
    
    if (assignedProgrammes.length === 0) {
        noMessage.classList.remove('hidden');
        return;
    }
    
    noMessage.classList.add('hidden');
    
    // Render each programme
    assignedProgrammes.forEach(programme => {
        const programmeImage = programme.picture || 'https://placehold.co/400x200/ADD8E6/00008B?text=Programme';
        
        // Get linked courses
        const linkedCourses = programme.linkedCourseIds 
            ? programme.linkedCourseIds.map(courseId => allCoursesData.find(c => c.id === courseId)).filter(c => c)
            : [];
        
        // Calculate progress - how many linked courses are completed
        const userEnrolledCourses = user.coursesEnrolled || [];
        const completedCoursesInProgramme = linkedCourses.filter(course => {
            const enrollment = userEnrolledCourses.find(e => e.courseId === course.id);
            return enrollment && enrollment.completionDate;
        }).length;
        
        const totalCourses = linkedCourses.length;
        const progressPercentage = totalCourses > 0 ? Math.round((completedCoursesInProgramme / totalCourses) * 100) : 0;
        const isCompleted = progressPercentage === 100;
        
        const programmeCard = `
            <div class="bg-white rounded-xl shadow-lg hover:shadow-xl transition overflow-hidden border-2 ${isCompleted ? 'border-green-400' : 'border-gray-200'}">
                <div class="relative w-full h-48 overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100">
                    <img src="${programmeImage}" alt="${programme.name}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-300" onerror="this.src='https://placehold.co/400x200/ADD8E6/00008B?text=${encodeURIComponent(programme.name)}'">
                    ${isCompleted 
                        ? '<span class="absolute top-3 right-3 text-xs px-3 py-1.5 rounded-full font-semibold bg-green-600 text-white shadow-md"><i class="las la-check-circle mr-1"></i>Completed</span>'
                        : '<span class="absolute top-3 right-3 text-xs px-3 py-1.5 rounded-full font-semibold bg-blue-600 text-white shadow-md"><i class="las la-play-circle mr-1"></i>In Progress</span>'
                    }
                </div>
                <div class="p-6">
                    <div class="flex items-start justify-between mb-3">
                        <h3 class="font-bold text-lg text-gray-800 flex-1">${programme.name}</h3>
                        <span class="ml-2 px-2 py-1 bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 text-xs rounded-full font-medium">
                            ${totalCourses} ${totalCourses === 1 ? 'Course' : 'Courses'}
                        </span>
                    </div>
                    
                    <!-- Progress Bar -->
                    <div class="mb-4">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-sm text-gray-600 font-medium">Progress</span>
                            <span class="text-sm font-bold ${isCompleted ? 'text-green-600' : 'text-indigo-600'}">${progressPercentage}%</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-3">
                            <div class="h-3 rounded-full transition-all duration-500 ${isCompleted ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}" style="width: ${progressPercentage}%"></div>
                        </div>
                        <p class="text-xs text-gray-500 mt-2">
                            ${completedCoursesInProgramme} of ${totalCourses} courses completed
                        </p>
                    </div>
                    
                    <!-- Linked Courses Preview -->
                    ${linkedCourses.length > 0 ? `
                        <div class="mb-4">
                            <p class="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Included Courses:</p>
                            <div class="space-y-1.5">
                                ${linkedCourses.slice(0, 3).map(course => {
                                    const enrollment = userEnrolledCourses.find(e => e.courseId === course.id);
                                    const isCourseCompleted = enrollment && enrollment.completionDate;
                                    return `
                                        <div class="flex items-center text-sm">
                                            <i class="fas ${isCourseCompleted ? 'la-check-circle text-green-600' : 'la-circle text-gray-400'} mr-2 text-xs"></i>
                                            <span class="${isCourseCompleted ? 'text-gray-600 line-through' : 'text-gray-700'}">${course.name}</span>
                                        </div>
                                    `;
                                }).join('')}
                                ${linkedCourses.length > 3 ? `<p class="text-xs text-gray-500 italic ml-5">+${linkedCourses.length - 3} more</p>` : ''}
                            </div>
                        </div>
                    ` : '<p class="text-sm text-gray-500 mb-4 italic">No courses linked yet</p>'}
                    
                    <button onclick="viewProgrammeDetails(${programme.id})" class="w-full text-sm font-medium py-2.5 rounded-lg transition shadow-sm ${isCompleted 
                        ? 'bg-green-600 text-white hover:bg-green-700' 
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
                    }">
                        <i class="las la-arrow-right mr-2"></i>View Programme
                    </button>
                </div>
            </div>
        `;
        
        container.innerHTML += programmeCard;
    });
}

function viewAssignmentDocument(fileUrl, fileName, fileType) {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4';
            
            let icon = 'la-file';
            let color = 'indigo';
            let typeLabel = 'Document';
            
            if (fileType === 'PDF') {
                icon = 'la-file-pdf';
                color = 'red';
                typeLabel = 'PDF Document';
            } else if (fileType === 'PPT' || fileType === 'PPTX') {
                icon = 'la-file-powerpoint';
                color = 'orange';
                typeLabel = 'PowerPoint Presentation';
            } else if (fileType === 'DOC' || fileType === 'DOCX') {
                icon = 'la-file-word';
                color = 'blue';
                typeLabel = 'Word Document';
            }
            
            modal.innerHTML = `
                <div class="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                    <div class="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-lg">
                        <div>
                            <h2 class="text-2xl font-bold text-gray-800">${fileName}</h2>
                            <p class="text-sm text-gray-600 mt-1">${typeLabel}</p>
                        </div>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700 text-3xl font-light">×</button>
                    </div>
                    <div class="p-8">
                        <div class="bg-gradient-to-br from-${color}-50 to-gray-50 rounded-lg p-12 text-center border-2 border-${color}-200">
                            <i class="fas ${icon} text-8xl text-${color}-500 mb-6"></i>
                            <h3 class="text-xl font-semibold text-gray-800 mb-4">${fileName}</h3>
                            ${(fileUrl && fileType === 'PDF') ? 
                                `<iframe src="${fileUrl}#toolbar=0" class="w-full h-[500px] border border-gray-300 rounded-lg mb-6" oncontextmenu="return false;"></iframe>` : 
                                `<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
                                    <p class="text-sm text-blue-800">
                                        <i class="las la-info-circle mr-2"></i>
                                        ${(fileUrl && fileType !== 'PDF') ? 'Document attached but cannot be previewed natively in the browser without downloading.' : 'This is a simulated document viewer. In a production environment, this would display the actual ' + typeLabel.toLowerCase() + ' content using an embedded viewer.'}
                                    </p>
                                </div>`
                            }
                            <div class="text-sm text-gray-600 space-y-2">
                                <p><i class="las la-file mr-2 text-${color}-600"></i><strong>File Type:</strong> ${typeLabel}</p>
                                <p><i class="las la-link mr-2 text-${color}-600"></i><strong>Status:</strong> Ready to view</p>
                            </div>
                        </div>
                    </div>
                    <div class="p-6 border-t border-gray-200 bg-gray-50 flex justify-between rounded-b-lg sticky bottom-0">
                        <div class="text-sm text-gray-600">
                            <i class="fas ${icon} text-${color}-500 mr-2"></i>${typeLabel}
                        </div>
                        <div class="flex space-x-3">
                            ${(typeof loggedInUser !== "undefined" && loggedInUser && loggedInUser.role === "training-manager") ? `<a href="${fileUrl}" download="${fileName}" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"><i class="las la-download mr-2"></i>Download</a>` : ""}
                            <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

function renderAllBadgesTable() {
            const tableBody = document.getElementById('allBadgesTableBody');
            tableBody.innerHTML = '';

            if (allBadgesData.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">No badges in system yet.</td>
                    </tr>
                `;
                return;
            }

            allBadgesData.forEach(badge => {
                const creator = allUsersData.find(u => u.id === badge.creatorId);
                const creatorName = creator ? creator.name : 'Unknown';
                const row = `
                    <tr class="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all duration-300 group border-b border-gray-100/70 last:border-0 hover:shadow-sm relative">
                        <td class="px-6 py-5 whitespace-nowrap text-center">
                            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-300 transform group-hover:-rotate-3 text-4xl">${badge.icon}</div>
                        </td>
                        <td class="px-6 py-5 whitespace-nowrap">
                            <div class="flex flex-col">
                                <span class="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-indigo-800 tracking-tight">${badge.name}</span>
                                <span class="text-xs text-blue-500/80 font-medium tracking-wide mt-0.5"><i class="fas fa-user-circle mr-1"></i>${creatorName}</span>
                            </div>
                        </td>
                        <td class="px-6 py-5 whitespace-nowrap hidden sm:table-cell">
                            <div class="inline-flex items-center space-x-1.5 bg-blue-50/80 px-3 py-1.5 text-xs text-blue-700 font-semibold rounded-lg border border-blue-100 group-hover:bg-blue-100 transition-colors">
                                <i class="fas fa-clock opacity-60"></i>
                                <span>${badge.hoursRequired} Hours</span>
                            </div>
                        </td>
                        <td class="px-6 py-5 whitespace-nowrap text-center hidden md:table-cell">
                            <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 font-bold text-sm ring-1 ring-emerald-200 group-hover:bg-emerald-100 transition-colors shadow-sm" title="Times Earned">
                                ${badge.timesEarned}
                            </span>
                        </td>
                        <td class="px-6 py-5 whitespace-nowrap text-right sticky right-0 bg-white group-hover:bg-blue-50/10 transition-colors">
                            <button onclick="viewBadgeDetails('${badge.id}')" class="inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg font-medium text-sm transition-all duration-300 shadow-sm hover:shadow-md transform hover:-translate-y-0.5">
                                <span>View</span>
                                <i class="fas fa-arrow-right text-[10px]"></i>
                            </button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });

            // Update admin stats
            const uniqueStudentsWithBadges = new Set(studentBadgesData.map(sb => sb.studentId)).size;
            document.getElementById('totalBadgesCount').textContent = allBadgesData.length;
            document.getElementById('totalEarnedCount').textContent = studentBadgesData.length;
            document.getElementById('studentsWithBadgesCount').textContent = uniqueStudentsWithBadges;
        }

function updateQuestionMarks(questionId, marks) {
            const question = assignmentQuestions.find(q => q.id === questionId);
            if (question) {
                question.marks = parseInt(marks) || 0;
            }
            updateTotalMarksFromQuestions();
        }

function updateSidebarActiveItem(activeId) {
    document.querySelectorAll('.sidebar-item').forEach(el => {
        el.classList.remove('bg-indigo-600', 'text-white', 'font-medium');
        el.classList.add('text-white');
    });
    // Find all elements with this id (normal sidebar + mobile sidebar)
    document.querySelectorAll('#' + activeId).forEach(el => {
        if(el) {
            el.classList.add('bg-indigo-600', 'text-white', 'font-medium');
            el.classList.remove('text-white');
        }
    });

    // close mobile sidebar if open
    document.getElementById('courseMobileSidebar').classList.add('hidden');
}

function showCreateAssignmentModal() {
            const createAssignmentModal = document.getElementById('createAssignmentModal');
            const createAssignmentForm = document.getElementById('createAssignmentForm');
            if (!createAssignmentModal || !createAssignmentForm) return;
            
            populateAssignmentStudentsList();
            populateAssignmentCourseSelect();
            createAssignmentForm.reset();
            document.getElementById('assignmentDocFileName').classList.add('hidden');
            document.getElementById('assignmentStudentSearch').value = '';
            clearAssignmentQuestions();
            updateAssignmentSelectedCount();
            createAssignmentModal.classList.remove('hidden');
            createAssignmentModal.classList.add('show');
        }

function updateCourseStatisticsDashboard() {
            // Get all students
            
            


            const assignGroupsList = document.getElementById('assignGroupsList');
            const noGroupsAvailableMsg = document.getElementById('noGroupsAvailableMsg');
            if (assignGroupsList) {
                assignGroupsList.innerHTML = '';
                let groupHtml = '';
                
                if (window.allLearnerGroups && allLearnerGroups.length > 0) {
                    noGroupsAvailableMsg.classList.add('hidden');
                    allLearnerGroups.forEach(group => {
                        const lCount = group.learners ? group.learners.length : 0;
                        groupHtml += `
                            <div class="flex items-center justify-between py-2 px-2 hover:bg-gray-50 rounded group-item">
                                <div class="flex items-center space-x-3">
                                    <input type="checkbox" 
                                           value="${group.id}" 
                                           class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded assign-group-checkbox cursor-pointer" 
                                           id="assignGroup-${group.id}"
                                           onchange="toggleGroupStudents(this, '${group.id}', 'programme')">
                                    <label for="assignGroup-${group.id}" class="text-sm font-medium text-gray-700 cursor-pointer">
                                        ${group.name} 
                                        <span class="text-xs text-gray-500 font-normal ml-1">(${lCount} students)</span>
                                    </label>
                                </div>
                            </div>
                        `;
                    });
                    assignGroupsList.innerHTML = groupHtml;
                } else if (noGroupsAvailableMsg) {
                    noGroupsAvailableMsg.classList.remove('hidden');
                }
            }

const students = allUsersData.filter(user => user.role === 'student');
            
            // Get courses created by the logged-in training manager
            const myCourses = allCoursesData.filter(course => course.creatorId === loggedInUser.id);
            const myCourseIds = myCourses.map(c => c.id);
            
            let completedCount = 0;
            let inProgressCount = 0;
            let notStartedCount = 0;
            
            // Count enrollments across all students for this training manager's courses
            students.forEach(student => {
                if (!student.coursesEnrolled) return;
                
                student.coursesEnrolled.forEach(enrollment => {
                    // Only count if this enrollment is for one of the training manager's courses
                    if (myCourseIds.includes(enrollment.courseId)) {
                        if (enrollment.completionDate) {
                            // Course is completed
                            completedCount++;
                        } else if (enrollment.hoursSpent && enrollment.hoursSpent > 0) {
                            // Course has been started (has hours spent)
                            inProgressCount++;
                        } else {
                            // Course not started yet
                            notStartedCount++;
                        }
                    }
                });
            });
            
            // Update the dashboard counters
            document.getElementById('coursesCompletedCount').textContent = completedCount;
            document.getElementById('coursesInProgressCount').textContent = inProgressCount;
            document.getElementById('coursesNotStartedCount').textContent = notStartedCount;
        }

function updateUpcomingEvents() {
            const today = new Date();
            const upcoming = calendarEvents
                .filter(e => e.date >= today)
                .sort((a, b) => a.date - b.date)
                .slice(0, 5);
            
            let html = '';
            if (upcoming.length === 0) {
                html = '<p class="text-gray-500 text-sm">No upcoming events</p>';
            } else {
                upcoming.forEach(event => {
                    const dateStr = event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    html += `
                        <div class="p-3 rounded border-l-4 ${getEventTypeColor(event.type)} border-l-4">
                            <p class="text-xs font-medium text-gray-600">${dateStr}</p>
                            <p class="font-semibold text-sm">${getEventTypeIcon(event.type)} ${event.title}</p>
                            <span class="inline-block mt-2 px-2 py-1 text-xs rounded bg-gray-200 text-gray-700">${event.type.charAt(0).toUpperCase() + event.type.slice(1)}</span>
                        </div>
                    `;
                });
            }
            document.getElementById('upcomingEventsList').innerHTML = html;
        }

function hideAssignStudentsToCoursesModal() {
            assignStudentsToCoursesModal.classList.remove('show');
            assignStudentsToCoursesModal.classList.add('hidden');
            currentCourseIdToAssign = null;
        }

function renderAssignmentOverview() {
            const students = allUsersData.filter(user => user.role === 'student');
            const totalStudents = students.length;
            
            // Find students assigned to at least one programme
            const assignedStudentIds = new Set();
            allProgramsData.forEach(programme => {
                programme.assignedStudentIds.forEach(id => assignedStudentIds.add(id));
            });
            const assignedStudents = assignedStudentIds.size;
            const unassignedStudents = totalStudents - assignedStudents;
            
            // Update summary cards
            document.getElementById('overviewTotalStudents').textContent = totalStudents;
            document.getElementById('overviewAssignedStudents').textContent = assignedStudents;
            document.getElementById('overviewUnassignedStudents').textContent = unassignedStudents;
            document.getElementById('overviewActiveProgrammes').textContent = allProgramsData.length;
            
            // Render unassigned students table
            renderUnassignedStudentsTable(students, assignedStudentIds);
            
            // Render programme details table
            renderProgrammeDetailsTable();
            
            // Render courses without students
            renderCoursesWithoutStudentsTable();
        }

function hidePdfViewerModal() {
            pdfViewerModal.classList.remove('show');
            pdfViewerModal.classList.add('hidden');
            currentViewingDocumentId = null; // Clear the ID
        }

function renderCourseAssignmentsList() {
            const container = document.getElementById('courseAssignmentsList');
            if (!container) return;

            if (currentCourseAssignments.length === 0) {
                container.innerHTML = '';
                return;
            }

            container.innerHTML = `
                <div class="bg-white border-2 border-purple-200 rounded-lg p-4 shadow-sm">
                    <h5 class="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <i class="las la-list text-purple-600 mr-2"></i>Added Assignments (${currentCourseAssignments.length})
                    </h5>
                    <div class="space-y-2">
                        ${currentCourseAssignments.map((assignment, index) => {
                            const typeIcon = assignment.type === 'mark-as-read' ? 'fa-eye' : 'la-file-alt';
                            const typeBadge = assignment.type === 'mark-as-read' ? 
                                '<span class="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">Mark as Read</span>' : 
                                '<span class="px-2 py-1 text-xs rounded-full bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">Regular</span>';
                            const docCount = assignment.documents ? assignment.documents.length : 0;
                            
                            return `
                            <div class="flex items-center justify-between bg-gradient-to-r from-gray-50 to-purple-50 p-3 rounded-lg border border-gray-200">
                                <div class="flex-1">
                                    <div class="text-sm font-medium text-gray-900 flex items-center">
                                        <i class="fas ${typeIcon} text-purple-600 mr-2"></i>${assignment.title}
                                    </div>
                                    <div class="text-xs text-gray-600 mt-1 flex items-center gap-3">
                                        <span><i class="las la-calendar text-gray-500 mr-1"></i>Due: ${new Date(assignment.dueDate).toLocaleDateString()}</span>
                                        <span><i class="las la-star text-amber-500 mr-1"></i>${assignment.totalMarks} marks</span>
                                        <span><i class="las la-paperclip text-indigo-500 mr-1"></i>${docCount} doc(s)</span>
                                        ${typeBadge}
                                    </div>
                                </div>
                                <button type="button" class="text-red-600 hover:text-red-900 ml-3 delete-course-assignment-btn" data-index="${index}">
                                    <i class="las la-trash-alt"></i>
                                </button>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;

            // Add delete functionality
            container.querySelectorAll('.delete-course-assignment-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const indexToDelete = parseInt(this.dataset.index);
                    const assignmentTitle = currentCourseAssignments[indexToDelete].title;
                    currentCourseAssignments.splice(indexToDelete, 1);
                    renderCourseAssignmentsList();
                    showMessageModal('Assignment Removed', `Assignment "${assignmentTitle}" has been removed from the course.`);
                });
            });
        }

function showBulkUploadModal() {
            bulkUploadModal.classList.remove('hidden');
            bulkUploadModal.classList.add('show');
            bulkUploadForm.reset();
            document.getElementById('uploadProgress').classList.add('hidden');
            document.getElementById('uploadResults').classList.add('hidden');
        }

function renderQuestionInputArea(type) {
            const questionInputArea = document.getElementById('questionInputArea');
            questionInputArea.innerHTML = '';
            document.getElementById('addQuestionBtn').disabled = true;

            if (!type) return;

            const marksInputHTML = `
                <div class="flex items-center gap-2 bg-gray-50 p-2 rounded-md border border-gray-200 mt-3 w-max">
                    <label class="text-gray-700 text-sm font-semibold" for="questionMarks">Marks:</label>
                    <input type="number" id="questionMarks" class="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500" min="1" value="1">
                </div>
            `;

            if (type === 'multiple-choice') {
                questionInputArea.innerHTML = `
                    <div class="mb-3">
                        <textarea id="mcQuestionText" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500" rows="2" placeholder="Enter Multiple Choice question..."></textarea>
                    </div>
                    <div id="mcOptionsContainer" class="space-y-2 mb-2">
                        <div class="flex items-center justify-between mb-1">
                            <label class="text-gray-700 text-sm font-semibold">Options <span class="text-gray-500 text-xs font-normal">(tick correct answer)</span></label>
                            <button type="button" id="addMcOptionBtn" class="text-emerald-600 text-xs font-semibold hover:text-emerald-800"><i class="las la-plus mr-1"></i>Add Option</button>
                        </div>
                        <div class="flex items-center gap-2 mc-option-row">
                            <input type="checkbox" name="mcAnswer" value="0" class="h-4 w-4 text-emerald-600 border-gray-300 rounded cursor-pointer">
                            <input type="text" class="mc-option px-3 py-1.5 text-sm border border-gray-300 rounded-md flex-1" placeholder="Option 1" onkeydown="if(event.key==='Enter'){event.preventDefault();addMultipleChoiceOption();}">
                            <button type="button" class="remove-option-btn text-red-500 hover:text-red-700 p-1"><i class="las la-times"></i></button>
                        </div>
                        <div class="flex items-center gap-2 mc-option-row">
                            <input type="checkbox" name="mcAnswer" value="1" class="h-4 w-4 text-emerald-600 border-gray-300 rounded cursor-pointer">
                            <input type="text" class="mc-option px-3 py-1.5 text-sm border border-gray-300 rounded-md flex-1" placeholder="Option 2" onkeydown="if(event.key==='Enter'){event.preventDefault();addMultipleChoiceOption();}">
                            <button type="button" class="remove-option-btn text-red-500 hover:text-red-700 p-1"><i class="las la-times"></i></button>
                        </div>
                    </div>
                    ${marksInputHTML}
                `;
                document.getElementById('addMcOptionBtn').addEventListener('click', addMultipleChoiceOption);
                document.querySelectorAll('.remove-option-btn').forEach(button => button.addEventListener('click', removeMultipleChoiceOption));
                document.getElementById('mcQuestionText').addEventListener('input', checkQuestionReadiness);
                document.querySelectorAll('.mc-option').forEach(input => input.addEventListener('input', checkQuestionReadiness));
                document.querySelectorAll('input[name="mcAnswer"]').forEach(checkbox => {
                            checkbox.addEventListener('change', checkQuestionReadiness);
                        });
            } else if (type === 'true-false') {
                questionInputArea.innerHTML = `
                    <div class="mb-3">
                        <textarea id="tfQuestionText" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500" rows="2" placeholder="Enter True/False statement..."></textarea>
                    </div>
                    <div class="flex items-center gap-4 bg-gray-50 p-2 rounded-md border border-gray-200 w-max">
                        <label class="text-gray-700 text-sm font-semibold">Correct Answer:</label>
                        <label class="inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="tfAnswer" value="true" class="h-4 w-4 text-emerald-600 border-gray-300 rounded">
                            <span class="ml-2 text-sm text-gray-700">True</span>
                        </label>
                        <label class="inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="tfAnswer" value="false" class="h-4 w-4 text-emerald-600 border-gray-300 rounded">
                            <span class="ml-2 text-sm text-gray-700">False</span>
                        </label>
                    </div>
                    ${marksInputHTML}
                `;
                document.getElementById('tfQuestionText').addEventListener('input', checkQuestionReadiness);
                document.querySelectorAll('input[name="tfAnswer"]').forEach(checkbox => {
                    checkbox.addEventListener('change', function() {
                        if(this.checked) {
                            document.querySelectorAll('input[name="tfAnswer"]').forEach(cb => { if(cb !== this) cb.checked = false; });
                        }
                        checkQuestionReadiness();
                    });
                });
            } else if (type === 'matching') {
                questionInputArea.innerHTML = `
                    <div id="matchingPairsContainer" class="space-y-2 mb-2">
                        <div class="flex items-center justify-between mb-1">
                            <label class="text-gray-700 text-sm font-semibold">Matching Pairs</label>
                            <button type="button" id="addMatchingPairBtn" class="text-emerald-600 text-xs font-semibold hover:text-emerald-800"><i class="las la-plus mr-1"></i>Add Pair</button>
                        </div>
                        <div class="flex items-center gap-2 matching-row">
                            <input type="text" class="matching-term px-3 py-1.5 text-sm border border-gray-300 rounded-md w-5/12" placeholder="Term">
                            <i class="las la-arrow-right text-gray-400 text-xs"></i>
                            <input type="text" class="matching-definition px-3 py-1.5 text-sm border border-gray-300 rounded-md flex-1" placeholder="Definition" onkeydown="if(event.key==='Enter'){event.preventDefault();addMatchingPair();}">
                            <button type="button" class="remove-pair-btn text-red-500 hover:text-red-700 p-1"><i class="las la-times"></i></button>
                        </div>
                        <div class="flex items-center gap-2 matching-row">
                            <input type="text" class="matching-term px-3 py-1.5 text-sm border border-gray-300 rounded-md w-5/12" placeholder="Term">
                            <i class="las la-arrow-right text-gray-400 text-xs"></i>
                            <input type="text" class="matching-definition px-3 py-1.5 text-sm border border-gray-300 rounded-md flex-1" placeholder="Definition" onkeydown="if(event.key==='Enter'){event.preventDefault();addMatchingPair();}">
                            <button type="button" class="remove-pair-btn text-red-500 hover:text-red-700 p-1"><i class="las la-times"></i></button>
                        </div>
                    </div>
                    ${marksInputHTML}
                `;
                document.getElementById('addMatchingPairBtn').addEventListener('click', addMatchingPair);
                document.querySelectorAll('.remove-pair-btn').forEach(button => button.addEventListener('click', removeMatchingPair));
                document.querySelectorAll('.matching-term, .matching-definition').forEach(input => input.addEventListener('input', checkQuestionReadiness));
            } else if (type === 'fill-in-blank') {
                questionInputArea.innerHTML = `
                    <div class="mb-3">
                        <textarea id="fillBlankQuestionText" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500" rows="2" placeholder="Enter question (use ___ for blanks)"></textarea>
                    </div>
                    <div id="fillBlankAnswersContainer" class="space-y-2 mb-2">
                        <div class="flex items-center justify-between mb-1">
                            <label class="text-gray-700 text-sm font-semibold">Answers (in order)</label>
                            <button type="button" id="addBlankAnswerBtn" class="text-emerald-600 text-xs font-semibold hover:text-emerald-800"><i class="las la-plus mr-1"></i>Add Answer</button>
                        </div>
                        <div class="flex items-center gap-2 blank-row">
                            <span class="text-xs font-medium text-gray-500 w-4">1.</span>
                            <input type="text" class="fill-blank-answer px-3 py-1.5 text-sm border border-gray-300 rounded-md flex-1" placeholder="Answer for blank 1" onkeydown="if(event.key==='Enter'){event.preventDefault();addBlankAnswer();}">
                            <button type="button" class="remove-blank-btn text-red-500 hover:text-red-700 p-1"><i class="las la-times"></i></button>
                        </div>
                    </div>
                    ${marksInputHTML}
                `;
                document.getElementById('addBlankAnswerBtn').addEventListener('click', addBlankAnswer);
                document.querySelectorAll('.remove-blank-btn').forEach(button => button.addEventListener('click', removeBlankAnswer));
                document.getElementById('fillBlankQuestionText').addEventListener('input', checkQuestionReadiness);
                document.querySelectorAll('.fill-blank-answer').forEach(input => input.addEventListener('input', checkQuestionReadiness));
            } else if (type === 'ordering') {
                questionInputArea.innerHTML = `
                    <div class="mb-3">
                        <textarea id="orderingQuestionText" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500" rows="2" placeholder="Enter instructions (e.g., 'Put the steps in order')"></textarea>
                    </div>
                    <div id="orderingItemsContainer" class="space-y-2 mb-2">
                        <div class="flex items-center justify-between mb-1">
                            <label class="text-gray-700 text-sm font-semibold">Correct Order</label>
                            <button type="button" id="addOrderingItemBtn" class="text-emerald-600 text-xs font-semibold hover:text-emerald-800"><i class="las la-plus mr-1"></i>Add Item</button>
                        </div>
                        <div class="flex items-center gap-2 order-row">
                            <span class="text-xs font-medium text-gray-500 w-4">1.</span>
                            <input type="text" class="ordering-item px-3 py-1.5 text-sm border border-gray-300 rounded-md flex-1" placeholder="First item" onkeydown="if(event.key==='Enter'){event.preventDefault();addOrderingItem();}">
                            <button type="button" class="remove-ordering-btn text-red-500 hover:text-red-700 p-1"><i class="las la-times"></i></button>
                        </div>
                        <div class="flex items-center gap-2 order-row">
                            <span class="text-xs font-medium text-gray-500 w-4">2.</span>
                            <input type="text" class="ordering-item px-3 py-1.5 text-sm border border-gray-300 rounded-md flex-1" placeholder="Second item" onkeydown="if(event.key==='Enter'){event.preventDefault();addOrderingItem();}">
                            <button type="button" class="remove-ordering-btn text-red-500 hover:text-red-700 p-1"><i class="las la-times"></i></button>
                        </div>
                    </div>
                    ${marksInputHTML}
                `;
                document.getElementById('addOrderingItemBtn').addEventListener('click', addOrderingItem);
                document.querySelectorAll('.remove-ordering-btn').forEach(button => button.addEventListener('click', removeOrderingItem));
                document.getElementById('orderingQuestionText').addEventListener('input', checkQuestionReadiness);
                document.querySelectorAll('.ordering-item').forEach(input => input.addEventListener('input', checkQuestionReadiness));
            } else if (type === 'long-answer') {
                questionInputArea.innerHTML = `
                    <div class="mb-3">
                        <textarea id="longAnswerQuestionText" class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500" rows="3" placeholder="Enter long answer prompt..."></textarea>
                    </div>
                    ${marksInputHTML}
                `;
                document.getElementById('longAnswerQuestionText').addEventListener('input', checkQuestionReadiness);
            }
            checkQuestionReadiness();
        }

function hideAddUserModal() {
            addUserModal.classList.remove('show');
            addUserModal.classList.add('hidden');
            // Clear the form fields and reset image preview when closing
            document.getElementById('addUserForm').reset();
            userPicturePreview.src = "https://placehold.co/96x96/E0E7FF/4F46E5?text=UP";
        }

function showCertificateViewer(certificateId) {
            const cert = allCertificatesData.find(c => c.id === certificateId);
            if (!cert) {
                showMessageModal('Error', 'Certificate not found.');
                return;
            }

            document.getElementById('certificateName').textContent = 'Certificate of Achievement';
            document.getElementById('certificateStudentName').textContent = cert.studentName;
            document.getElementById('certificateCourseName').textContent = cert.courseName;
            document.getElementById('certificateDate').textContent = cert.issueDate;
            document.getElementById('certificateId').textContent = cert.id;

            document.getElementById('certificateViewerModal').classList.remove('hidden');
            document.getElementById('certificateViewerModal').classList.add('show');
        }

function hideViewAssignmentModal() {
            document.getElementById('viewAssignmentModal').classList.add('hidden');
            document.getElementById('viewAssignmentModal').classList.remove('show');
        }

function renderStudentBadgesGrid() {
            const container = document.getElementById('studentBadgesContainer');
            if (!container) return;

            const badges = getStudentBadges(loggedInUser.id);
            const student = allUsersData.find(u => u.id === loggedInUser.id);
            
            document.getElementById('studentTotalHours').textContent = student ? (student.totalHoursSpent || 0) : 0;
            document.getElementById('studentBadgesCount').textContent = badges.length;

            if (badges.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-12">
                        <p class="text-gray-500 text-lg">No badges earned yet. Keep learning!</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = '';
            badges.forEach(badge => {
                const badgeHtml = `
                    <div class="relative group bg-white rounded-2xl p-6 text-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(14,165,233,0.15)] transition-all duration-300 cursor-pointer overflow-hidden border border-gray-100 hover:border-blue-200 transform hover:-translate-y-1" onclick="showBadgeDetails('${badge.id}', '${badge.name}', '${badge.description}', '${badge.icon}', '${badge.hoursRequired}', '${badge.earnedDate}')">
                        <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500 ease-in-out z-0"></div>
                        <div class="relative z-10">
                            <div class="text-6xl mb-4 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 drop-shadow-sm">${badge.icon}</div>
                            <h3 class="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600 mb-2">${badge.name}</h3>
                            <p class="text-sm text-gray-500 mb-4 line-clamp-2">${badge.description}</p>
                            <div class="inline-flex items-center justify-center space-x-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full border border-blue-100/50 group-hover:border-blue-200 transition-colors">
                                <i class="fas fa-calendar-check opacity-70"></i>
                                <span>Earned ${badge.earnedDate}</span>
                            </div>
                        </div>
                    </div>
                `;
                container.innerHTML += badgeHtml;
            });
        }

function renderAllCertificatesTable() {
            const tableBody = document.getElementById('allCertificatesTableBody');
            
            if (allCertificatesData.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">No certificates issued yet.</td></tr>';
                return;
            }

            tableBody.innerHTML = '';
            allCertificatesData.forEach(cert => {
                tableBody.innerHTML += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${cert.id}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${cert.studentName}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${cert.courseName}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${cert.issueDate}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${cert.certificateType}</td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">${cert.status}</span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button onclick="showCertificateViewer('${cert.id}')" class="text-indigo-600 hover:text-indigo-900">View</button>
                        </td>
                    </tr>
                `;
            });
        }

function toggleGroupStudents(groupCheckbox, groupId, context) {
            const group = allLearnerGroups.find(g => g.id === groupId || g.id === String(groupId));
            if (!group) return;
            
            const isChecked = groupCheckbox.checked;
            const checkboxClass = context === 'programme' ? '.assign-student-checkbox' : '.assign-course-student-checkbox';
            
            const studentCheckboxes = document.querySelectorAll(checkboxClass);
            studentCheckboxes.forEach(cb => {
                if ((group.learners || []).map(String).includes(String(cb.value))) {
                    cb.checked = isChecked;
                }
            });
            
            if (context === 'programme') {
                if (typeof updateSelectedCount === 'function') updateSelectedCount();
            } else {
                if (typeof updateCourseSelectedCount === 'function') updateCourseSelectedCount();
            }
        }