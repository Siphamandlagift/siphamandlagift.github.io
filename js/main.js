// Global variables for message modal
        const messageModal = document.getElementById('messageModal');
        const messageModalTitle = document.getElementById('messageModalTitle');
        const messageModalContent = document.getElementById('messageModalContent');

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

        function hideMessageModal() {
            messageModal.classList.remove('show');
            messageModal.classList.add('hidden');
        }

let currentEditingUserId = null;

window.editUser = function(userId) {
    if (window.event) {
        window.event.stopPropagation();
        window.event.preventDefault();
    }
    const user = allUsersData.find(u => u.id === userId);
    if (!user) return;
    
    currentEditingUserId = userId;
    
    if (document.getElementById('editUserNameInput')) document.getElementById('editUserNameInput').value = user.name || '';
    if (document.getElementById('editUserSurnameInput')) document.getElementById('editUserSurnameInput').value = user.surname || '';
    if (document.getElementById('editUserEmailInput')) document.getElementById('editUserEmailInput').value = user.email || '';
    if (document.getElementById('editUserIDNumberInput')) document.getElementById('editUserIDNumberInput').value = user.idNumber || '';
    if (document.getElementById('editCompanyNameInput')) document.getElementById('editCompanyNameInput').value = user.company || '';
    if (document.getElementById('editUserPasswordInput')) document.getElementById('editUserPasswordInput').value = ''; // Don't show password
    if (document.getElementById('editUserRoleSelect')) document.getElementById('editUserRoleSelect').value = user.role || 'student';
    
    if (document.getElementById('editUserModal')) {
        document.getElementById('editUserModal').classList.remove('hidden');
        document.getElementById('editUserModal').classList.add('flex');
    }
};

window.hideEditUserModal = function() {
    if (document.getElementById('editUserModal')) {
        document.getElementById('editUserModal').classList.add('hidden');
        document.getElementById('editUserModal').classList.remove('flex');
    }
    currentEditingUserId = null;
    if (document.getElementById('editUserForm')) document.getElementById('editUserForm').reset();
};

window.deleteUser = function(userId) {
    if (window.event) {
        window.event.stopPropagation();
        window.event.preventDefault();
    }
    
    const defaultAdmins = ['mandla1_z@yahoo.com'];
    const user = allUsersData.find(u => u.id === userId);
    if (user && defaultAdmins.includes(user.email)) {
        showMessageModal('Action Denied', 'You cannot delete the primary administrator account.');
        return;
    }

    if (confirm('Are you sure you want to delete ' + (user ? user.name : 'this user') + '? This action cannot be undone.')) {
        allUsersData = allUsersData.filter(u => u.id !== userId);
        if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
        else localStorage.setItem('allUsersData', JSON.stringify(allUsersData));
        
        if (typeof renderUserTable === 'function') renderUserTable();
        if (typeof updateDashboardStats === 'function') updateDashboardStats();
        if (typeof showMessageModal === 'function') showMessageModal('Success', 'User has been successfully deleted.');
        else alert('User deleted.');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('editUserForm');
    if (editForm) {
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (!currentEditingUserId) return;
            
            const userIndex = allUsersData.findIndex(u => u.id === currentEditingUserId);
            if (userIndex === -1) return;
            
            const name = document.getElementById('editUserNameInput').value.trim();
            const surname = document.getElementById('editUserSurnameInput') ? document.getElementById('editUserSurnameInput').value.trim() : '';
            const email = document.getElementById('editUserEmailInput').value.trim();
            const idNumber = document.getElementById('editUserIDNumberInput') ? document.getElementById('editUserIDNumberInput').value.trim() : '';
            const company = document.getElementById('editCompanyNameInput') ? document.getElementById('editCompanyNameInput').value.trim() : '';
            const role = document.getElementById('editUserRoleSelect').value;
            const password = document.getElementById('editUserPasswordInput') ? document.getElementById('editUserPasswordInput').value.trim() : '';

            if (!name || !email || !role) {
                if (typeof showMessageModal === 'function') showMessageModal('Error', 'Name, Email, and Role are required.');
                else alert('Name, Email, and Role are required.');
                return;
            }

            allUsersData[userIndex].name = name;
            allUsersData[userIndex].surname = surname;
            allUsersData[userIndex].email = email;
            allUsersData[userIndex].idNumber = idNumber;
            allUsersData[userIndex].company = company;
            allUsersData[userIndex].role = role;
            
            if (password) {
                allUsersData[userIndex].password = password; // Only update if new password provided
            }

            if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
            else localStorage.setItem('allUsersData', JSON.stringify(allUsersData));
            
            if (typeof renderUserTable === 'function') renderUserTable();
            if (typeof updateDashboardStats === 'function') updateDashboardStats();
            hideEditUserModal();
            if (typeof showMessageModal === 'function') showMessageModal('Success', 'User information updated successfully.');
            else alert('User updated.');
        });
    }
});


        // Global variables for Add User Modal
        const addUserModal = document.getElementById('addUserModal');
        const userPicturePreview = document.getElementById('userPicturePreview');
        const userPictureInput = document.getElementById('userPictureInput');

        userPictureInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    userPicturePreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                userPicturePreview.src = "https://placehold.co/96x96/E0E7FF/4F46E5?text=UP"; // Reset to placeholder
            }
        });

        function showAddUserModal() {
            addUserModal.classList.remove('hidden');
            addUserModal.classList.add('show');
            userPicturePreview.src = "https://placehold.co/96x96/E0E7FF/4F46E5?text=UP"; // Reset preview on open
        }

        function hideAddUserModal() {
            addUserModal.classList.remove('show');
            addUserModal.classList.add('hidden');
            // Clear the form fields and reset image preview when closing
            document.getElementById('addUserForm').reset();
            userPicturePreview.src = "https://placehold.co/96x96/E0E7FF/4F46E5?text=UP";
        }

        // Bulk Upload Functions
        const bulkUploadModal = document.getElementById('bulkUploadModal');
        const bulkUploadForm = document.getElementById('bulkUploadForm');
        const bulkUploadFileInput = document.getElementById('bulkUploadFileInput');

        function showBulkUploadModal() {
            bulkUploadModal.classList.remove('hidden');
            bulkUploadModal.classList.add('show');
            bulkUploadForm.reset();
            document.getElementById('uploadProgress').classList.add('hidden');
            document.getElementById('uploadResults').classList.add('hidden');
        }

        function hideBulkUploadModal() {
            bulkUploadModal.classList.remove('show');
            bulkUploadModal.classList.add('hidden');
            bulkUploadForm.reset();
            document.getElementById('uploadProgress').classList.add('hidden');
            document.getElementById('uploadResults').classList.add('hidden');
        }

        // Parse CSV and bulk upload users
        bulkUploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const file = bulkUploadFileInput.files[0];
            if (!file) {
                showMessageModal('Error', 'Please select a CSV file.');
                return;
            }

            if (!file.name.endsWith('.csv')) {
                showMessageModal('Error', 'Please upload a CSV file only.');
                return;
            }

            if (file.size > 1024 * 1024) {
                showMessageModal('Error', 'File size must be less than 1MB.');
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const csv = e.target.result;
                processCSVUpload(csv);
            };
            reader.readAsText(file);
        });

        function processCSVUpload(csv) {
            const lines = csv.trim().split('\n');
            const progressDiv = document.getElementById('uploadProgress');
            const resultsDiv = document.getElementById('uploadResults');
            
            progressDiv.classList.remove('hidden');
            resultsDiv.classList.add('hidden');

            let successCount = 0;
            let errorCount = 0;
            let errors = [];

            lines.forEach((line, index) => {
                if (line.trim() === '') return; // Skip empty lines

                const parts = line.split(',').map(p => p.trim());
                
                // Validate CSV format
                if (parts.length < 6) {
                    errors.push(`Row ${index + 1}: Invalid format. Expected 6 fields.`);
                    errorCount++;
                    return;
                }

                const [name, email, idNumber, company, role, password] = parts;

                // Validate required fields
                if (!name || !email || !idNumber || !company || !role || !password) {
                    errors.push(`Row ${index + 1}: Missing required fields.`);
                    errorCount++;
                    return;
                }

                // Validate email format
                if (!email.includes('@')) {
                    errors.push(`Row ${index + 1}: Invalid email format.`);
                    errorCount++;
                    return;
                }

                // Validate role
                const validRoles = ['administrator', 'training_manager', 'student'];
                if (!validRoles.includes(role.toLowerCase())) {
                    errors.push(`Row ${index + 1}: Invalid role. Use administrator, training_manager, or student.`);
                    errorCount++;
                    return;
                }

                // Check if user already exists
                if (allUsersData.find(u => u.email === email)) {
                    errors.push(`Row ${index + 1}: User with email ${email} already exists.`);
                    errorCount++;
                    return;
                }

                // Create new user
                const newUser = {
                    id: Date.now() + Math.random(),
                    name: name.split(' ')[0] || name,
                    surname: name.split(' ')[1] || '',
                    email: email,
                    idNumber: idNumber,
                    company: company,
                    role: role.toLowerCase(),
                    password: password,
                    status: 'active',
                    coursesEnrolled: [],
                    totalHoursSpent: 0,
                    picture: 'https://placehold.co/40x40/FF5733/FFFFFF?text=U'
                };

                
            // Instead of just pushing to our fake frontend array, we actually save to the database!
            if (typeof window.addUserToDatabase === 'function') {
                window.addUserToDatabase(newUser);
            } else {
                allUsersData.push(newUser);
            }

                successCount++;

                // Update progress bar
                const total = lines.length - 1;
                const progress = Math.round(((index + 1) / total) * 100);
                document.getElementById('uploadProgressBar').style.width = progress + '%';
                document.getElementById('uploadProgressText').textContent = `${index + 1}/${total}`;
            });

            saveToLocalStorage(); // Save bulk imported users
            
            // Show results
            progressDiv.classList.add('hidden');
            resultsDiv.classList.remove('hidden');

            document.getElementById('successCount').textContent = successCount;
            document.getElementById('errorCount').textContent = errorCount;

            const errorResultsDiv = document.getElementById('errorResults');
            if (errorCount > 0) {
                errorResultsDiv.classList.remove('hidden');
                const errorList = document.getElementById('errorList');
                errorList.innerHTML = errors.map(err => `<li>${err}</li>`).join('');
            } else {
                errorResultsDiv.classList.add('hidden');
            }

            if (successCount > 0) {
                showMessageModal('Success', `${successCount} user(s) uploaded successfully!`);
                renderUserTable();
            }
        }

        // Dropdown toggle function
        function toggleDropdown(button) {
            const menu = button.nextElementSibling;
            if (menu && menu.classList.contains('dropdown-menu')) {
                menu.classList.toggle('hidden');
            }
        }
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', function(e) {
            const dropdowns = document.querySelectorAll('.dropdown-menu:not(.hidden)');
            dropdowns.forEach(dropdown => {
                const parentDropdown = dropdown.closest('.dropdown');
                if (parentDropdown && !parentDropdown.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
        });

        // Function to show specific content section
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
                    } else if (sectionId === 'assignmentsContent') { pageTitle.textContent = 'Student Grading'; } else {
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
            if (sectionId === 'my-gradesContent') {
                renderMyGrades();
            }
            if (sectionId === 'calendarContent') {
                renderCalendar();
            }
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

        // Login functionality
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('loginUsernameInput').value;
            const password = document.getElementById('loginPasswordInput').value;
            const role = document.getElementById('userRoleSelect').value;
            
            let userLoggedIn = null;

            // Attempt Backend Login first
            if (typeof window.loginViaBackend === 'function') {
                const backendResult = await window.loginViaBackend(username, password);
                if (backendResult.success) {
                    userLoggedIn = backendResult.user;
                } else if (backendResult.message !== 'Could not connect to server') {
                     // Connected to backend but invalid creds
                     showMessageModal('Login Error', backendResult.message);
                     return;
                }
            }

            // Fallback to local demo data
            if (!userLoggedIn) {
                userLoggedIn = allUsersData.find(u => (u.email && u.email.toLowerCase() === username.toLowerCase()) || (u.name.toLowerCase() === username.toLowerCase() && u.role === role));
            }

            if (!userLoggedIn) {
                showMessageModal('Login Error', 'Invalid username/email or password. Please try again.');
                return;
            }

            if (username && password) {
                const loginModalElement = document.getElementById('loginModal');
                if (loginModalElement) {
                    loginModalElement.classList.add('hidden');
                } else {
                    console.error("Error: loginModal element not found.");
                    showMessageModal('Critical Error', 'The login dialog could not be hidden. Please refresh the page.');
                    return;
                }
                
                // Show sidebar and content area after successful login
                const sidebar = document.getElementById('sidebar');
                const contentArea = document.getElementById('contentArea');
                const main = document.querySelector('main');
                
                if (sidebar) sidebar.style.display = '';
                if (contentArea) contentArea.style.display = '';
                if (main) main.style.display = '';
                
                // Set the logged-in user data from the dummy data
                loggedInUser.id = userLoggedIn.id;
                loggedInUser.name = userLoggedIn.name;
                loggedInUser.role = userLoggedIn.role;
                loggedInUser.fullName = `${userLoggedIn.name}${userLoggedIn.surname ? ' ' + userLoggedIn.surname : ''}`;
                loggedInUser.email = userLoggedIn.email;
                loggedInUser.picture = userLoggedIn.picture;
                
                saveToLocalStorage(); // Save logged in user

                // Update display usernames and role
                document.getElementById('sidebarUsername').textContent = loggedInUser.fullName;
                document.getElementById('sidebarUserrole').textContent = loggedInUser.role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                document.getElementById('topNavUsername').textContent = loggedInUser.fullName;
                document.getElementById('greetingName').textContent = loggedInUser.name; // Only first name for greeting
                document.querySelector('#sidebar .user-info img').src = loggedInUser.picture;
                document.querySelector('header .dropdown img').src = loggedInUser.picture;
                
                // Update dropdown user info
                document.getElementById('dropdownUserName').textContent = loggedInUser.fullName;
                document.getElementById('dropdownUserEmail').textContent = loggedInUser.email;
                document.getElementById('topNavUserAvatar').src = loggedInUser.picture;


                // Show/hide navigation sections based on role
                document.querySelectorAll('.nav-section').forEach(section => {
                    section.classList.add('hidden');
                });

                let navSectionToShowId;
                if (role === 'administrator') {
                    navSectionToShowId = 'adminNav';
                } else if (role === 'training_manager') {
                    navSectionToShowId = 'trainingManagerNav';
                }
                else { // student
                    navSectionToShowId = `studentNav`;
                }
                const navSectionElement = document.getElementById(navSectionToShowId);
                if (navSectionElement) {
                    navSectionElement.classList.remove('hidden');
                } else {
                    console.error(`Navigation section with ID '${navSectionToShowId}' not found.`);
                    showMessageModal('Configuration Error', 'Could not find the navigation section for your role. Please contact support.');
                }

                // Show appropriate default section based on role
                let defaultSectionId = 'dashboardContent';
                if (role === 'training_manager') {
                    defaultSectionId = 'dashboardContent';
                } else if (role === 'student') {
                    defaultSectionId = 'dashboardContent'; // Students also see dashboard
                }
                showSection(defaultSectionId);
                updateDashboardStats(); // Update dashboard stats after login

            } else {
                showMessageModal('Login Error', 'Please enter both username and password.');
            }
        });

        // Event listeners for sidebar navigation
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault(); // Prevent default link behavior
                const sectionId = this.getAttribute('data-section') + 'Content';
                showSection(sectionId);
            });
        });

        // Logout functionality
        function handleLogout() {
            loggedInUser = {
                id: null,
                name: '',
                role: '',
                fullName: '',
                email: '',
                contact: '',
                address: '',
                picture: 'https://placehold.co/96x96/ADD8E6/00008B?text=P'
            };
            saveToLocalStorage(); // Clear logged in user
            showMessageModal('Logged Out', 'You have been successfully logged out.');
            document.getElementById('loginModal').classList.remove('hidden');
            
            // Hide sidebar and content area
            const sidebar = document.getElementById('sidebar');
            const contentArea = document.getElementById('contentArea');
            const main = document.querySelector('main');
            
            if (sidebar) sidebar.style.display = 'none';
            if (contentArea) contentArea.style.display = 'none';
            if (main) main.style.display = 'none';
            
            // Reset UI
            document.getElementById('sidebarUsername').textContent = '';
            document.getElementById('sidebarUserrole').textContent = '';
            document.getElementById('topNavUsername').textContent = '';
            document.getElementById('greetingName').textContent = '';
            document.querySelector('#sidebar .user-info img').src = 'https://placehold.co/40x40/FF5733/FFFFFF?text=U';
            document.querySelector('header .dropdown img').src = 'https://placehold.co/32x32/FF5733/FFFFFF?text=U';
            document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
            document.querySelectorAll('.nav-section').forEach(section => section.classList.add('hidden'));
            document.getElementById('pageTitle').textContent = 'SKILLSCONNECT';
            
            // Reset loggedInUser state
            loggedInUser = {
                id: null,
                name: '',
                role: '',
                fullName: '',
                email: '',
                contact: '',
                address: '',
                picture: 'https://placehold.co/96x96/ADD8E6/00008B?text=P'
            };
            updateDashboardStats(); // Reset dashboard stats on logout
        }
        document.getElementById('logoutBtn').addEventListener('click', handleLogout);
        document.getElementById('topLogoutBtn').addEventListener('click', handleLogout);

        // Event listeners for dropdown navigation links
        document.querySelectorAll('.dropdown-nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const sectionId = this.getAttribute('data-section') + 'Content';
                showSection(sectionId);
                // Close the dropdown
                const dropdown = this.closest('.dropdown-menu');
                if (dropdown) {
                    dropdown.classList.add('hidden');
                }
            });
        });

        // ==================== LOCAL STORAGE PERSISTENCE ====================
        // Save data to localStorage
        function saveToLocalStorage() {
            try {
                localStorage.setItem('allUsersData', JSON.stringify(allUsersData));
                localStorage.setItem('allCoursesData', JSON.stringify(allCoursesData));
                localStorage.setItem('allProgramsData', JSON.stringify(allProgramsData));
                localStorage.setItem('allAssignmentsData', JSON.stringify(allAssignmentsData));
                localStorage.setItem('allCertificatesData', JSON.stringify(allCertificatesData));
                localStorage.setItem('allBadgesData', JSON.stringify(allBadgesData));
                localStorage.setItem('studentBadgesData', JSON.stringify(studentBadgesData));
                localStorage.setItem('documentRollouts', JSON.stringify(documentRollouts));
                localStorage.setItem('studentNotifications', JSON.stringify(studentNotifications));
                localStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
                localStorage.setItem('allLearnerGroups', JSON.stringify(allLearnerGroups));
                console.log('Data saved to localStorage successfully');
            } catch (error) {
                console.error('Error saving to localStorage:', error);
            }
        }

        // Load data from localStorage
        function loadFromLocalStorage() {
            try {
                const users = localStorage.getItem('allUsersData');
                const courses = localStorage.getItem('allCoursesData');
                const programs = localStorage.getItem('allProgramsData');
                const assignments = localStorage.getItem('allAssignmentsData');
                const certificates = localStorage.getItem('allCertificatesData');
                const badges = localStorage.getItem('allBadgesData');
                const studentBadges = localStorage.getItem('studentBadgesData');
                const rollouts = localStorage.getItem('documentRollouts');
                const notifications = localStorage.getItem('studentNotifications');
                const savedUser = localStorage.getItem('loggedInUser');

                                  const savedGroups = localStorage.getItem('allLearnerGroups');
                  if (savedGroups) allLearnerGroups = JSON.parse(savedGroups);
                  if (users) allUsersData = JSON.parse(users);
                if (courses) allCoursesData = JSON.parse(courses);
                if (programs) allProgramsData = JSON.parse(programs);
                if (assignments) allAssignmentsData = JSON.parse(assignments);
                if (certificates) allCertificatesData = JSON.parse(certificates);
                if (badges) allBadgesData = JSON.parse(badges);
                if (studentBadges) studentBadgesData = JSON.parse(studentBadges);
                if (rollouts) documentRollouts = JSON.parse(rollouts);
                if (notifications) studentNotifications = JSON.parse(notifications);
                if (savedUser) {
                    const parsedUser = JSON.parse(savedUser);
                    // Only restore user if they have an id (logged in)
                    if (parsedUser && parsedUser.id) {
                        loggedInUser = parsedUser;
                    }
                }

                console.log('Data loaded from localStorage successfully');
                return true;
            } catch (error) {
                console.error('Error loading from localStorage:', error);
                return false;
            }
        }

        // --- LEARNER GROUPS MANAGEMENT ---
        let allLearnerGroups = [];
        let currentEditingGroupId = null;

        function loadLearnerGroupsTable() {
            console.log('loading learner groups table');
            const tbody = document.getElementById('learnerGroupsTableBody');
            if (!tbody) {
                console.warn('learnerGroupsTableBody not found');
                return;
            }
            tbody.innerHTML = '';
            
            if (allLearnerGroups.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">No learner groups found. Create one.</td></tr>';
                return;
            }

            allLearnerGroups.forEach(group => {
                const learnersCount = group.learners ? group.learners.length : 0;
                const coursesCount = group.courses ? group.courses.length : 0;
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-gray-900">${group.name || ''}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-900">${learnersCount}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm text-gray-900">${coursesCount}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick="editGroup('${group.id}')" class="text-indigo-600 hover:text-indigo-900 mr-3">Edit / Assign</button>
                        <button onclick="deleteGroup('${group.id}')" class="text-red-600 hover:text-red-900">Delete</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function openCreateGroupModal() {
            currentEditingGroupId = null;
            document.getElementById('groupModalTitle').textContent = 'Create Learner Group';
            document.getElementById('groupNameInput').value = '';
            renderGroupModalCheckboxes();
            document.getElementById('groupModal').classList.remove('hidden');
        }

        function editGroup(groupId) {
            const group = allLearnerGroups.find(g => g.id === groupId);
            if (!group) return;
            currentEditingGroupId = group.id;
            document.getElementById('groupModalTitle').textContent = 'Edit Learner Group';
            document.getElementById('groupNameInput').value = group.name;
            renderGroupModalCheckboxes(group.learners || []);
            document.getElementById('groupModal').classList.remove('hidden');
        }

        function closeGroupModal() {
            document.getElementById('groupModal').classList.add('hidden');
            currentEditingGroupId = null;
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

        function saveLearnerGroup() {
            const name = document.getElementById('groupNameInput').value.trim();
            if (!name) {
                alert('Please enter a group name');
                return;
            }

            const studentChecks = document.querySelectorAll('input[name="groupStudentCheck"]:checked');

            
            const learners = Array.from(studentChecks).map(cb => cb.value);


            if (currentEditingGroupId) {
                const group = allLearnerGroups.find(g => g.id === currentEditingGroupId);
                if (group) {
                    group.name = name;
                    group.learners = learners;

                }
            } else {
                const newGroup = {
                    id: 'grp_' + Date.now(),
                    name: name,
                    learners: learners
                };
                allLearnerGroups.push(newGroup);
            }

            saveToLocalStorage();
            closeGroupModal();
            loadLearnerGroupsTable();
        }

        function deleteGroup(groupId) {
            if (confirm('Are you sure you want to delete this group?')) {
                allLearnerGroups = allLearnerGroups.filter(g => g.id !== groupId);
                saveToLocalStorage();
                    loadLearnerGroupsTable();
            }
        }

                function syncGroupTrainings() {
            // Disabled: groups no longer assign courses explicitly.
        }

        // Initialize data - load from localStorage or use defaults
        
        function initializeData() {
            const loaded = loadFromLocalStorage();
            
            // If nothing in localStorage, populate with default data
            if (!loaded || allUsersData.length === 0) {
                console.log('No data in localStorage, using default dummy data');
                initializeDefaultData();
                saveToLocalStorage();
            } else {
                // Ensure default users (especially students) exist even if localStorage has data
                ensureDefaultStudentsExist();
            }
        }

        // Ensure default students exist (add them if missing)
        function ensureDefaultStudentsExist() {
            const defaultUsers = getDefaultUsers();
            const defaultStudents = defaultUsers.filter(u => u.role === 'student');
            
            defaultStudents.forEach(defaultStudent => {
                // Check if this default student exists
                const exists = allUsersData.some(u => u.email === defaultStudent.email);
                if (!exists) {
                    // Find next available ID
                    const maxId = allUsersData.length > 0 ? Math.max(...allUsersData.map(u => u.id)) : 0;
                    defaultStudent.id = maxId + 1;
                    allUsersData.push(defaultStudent);
                    console.log(`Added missing default student: ${defaultStudent.name}`);
                }
            });
            
            // Save if we added any students
            if (allUsersData.length !== defaultUsers.length) {
                saveToLocalStorage();
            }
        }

        // Default dummy data initialization
        function initializeDefaultData() {
            allUsersData = getDefaultUsers();
            allCoursesData = getDefaultCourses();
            allProgramsData = [];
            allAssignmentsData = getDefaultAssignments();
            allCertificatesData = getDefaultCertificates();
            allBadgesData = getDefaultBadges();
        }

        // Dummy logged in user data (will be populated on successful login)
        let loggedInUser = {
            id: null, // Will be set on login
            name: '',
            role: '',
            fullName: '',
            email: '',
            contact: '',
            address: '',
            picture: 'https://placehold.co/96x96/ADD8E6/00008B?text=P'
        };

        // Global array to store user data
        
let allUsersData = [];
        
        // Function to get default users
        function getDefaultUsers() {
            return [];
        }

        // Add User Button Listener
        document.getElementById('addUserBtn').addEventListener('click', showAddUserModal);

        // Bulk Upload Button Listener
        document.getElementById('bulkUploadBtn').addEventListener('click', showBulkUploadModal);

        // Add User Form Submission
        document.getElementById('addUserForm').addEventListener('submit', function(e) {
            e.preventDefault();

            const name = document.getElementById('userNameInput').value.trim();
            const surname = document.getElementById('userSurnameInput').value.trim();
            const email = document.getElementById('userEmailInput').value.trim();
            const idNumber = document.getElementById('userIDNumberInput').value.trim();
            const companyName = document.getElementById('companyNameInput').value.trim();
            const password = document.getElementById('userPasswordInput').value.trim();
            const role = document.getElementById('newUserRoleSelect').value;
            const userPictureFile = userPictureInput.files[0];
            let userPictureSrc = '';

            if (!name || !surname || !email || !idNumber || !password || !companyName) {
                showMessageModal('Input Error', 'Please fill in all fields.');
                return;
            }

            // Basic email validation
            if (!email.includes('@') || !email.includes('.')) {
                showMessageModal('Input Error', 'Please enter a valid email address.');
                return;
            }

            // Generate a simple unique ID for the user
            const userId = Date.now();

            // Handle user picture
            if (userPictureFile) {
                userPictureSrc = URL.createObjectURL(userPictureFile);
            } else {
                // Generate initials for placeholder if no image is uploaded
                const initials = `${name.charAt(0)}${surname.charAt(0)}`.toUpperCase();
                const randomColor = Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
                userPictureSrc = `https://placehold.co/40x40/${randomColor}/FFFFFF?text=${initials}`;
            }

            const newUser = {
                id: userId,
                name: name,
                surname: surname,
                email: email,
                idNumber: idNumber,
                company: companyName,
                role: role,
                picture: userPictureSrc,
                status: 'active', // Default status
                enrollmentDate: new Date().toISOString().slice(0, 10), // Current date as start date
                endDate: null, // No end date initially
                coursesEnrolled: [],
                totalHoursSpent: 0
            };
            
            // Instead of just pushing to our fake frontend array, we actually save to the database!
            if (typeof window.addUserToDatabase === 'function') {
                window.addUserToDatabase(newUser);
            } else {
                allUsersData.push(newUser);
            }
 // Add new user to the global array
            saveToLocalStorage(); // Save to localStorage

            renderUserTable(); // Re-render the user table to include the new user
            updateDashboardStats(); // Update dashboard stats after adding user

            showMessageModal('Success', `${name} ${surname} has been added as a ${role.replace('_', ' ')}.`);
            hideAddUserModal();
        });

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


        // Sidebar toggle logic
        const sidebar = document.getElementById('sidebar');
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mobileCloseSidebarBtn = document.getElementById('mobileCloseSidebarBtn');
        const contentArea = document.getElementById('contentArea');

        // Mobile sidebar toggle (drawer functionality)
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
        });
        mobileCloseSidebarBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
        });

        // Sidebar stays expanded at all times - no collapse functionality

        // Make entire table rows clickable (if they have data-link attribute) - Adjusted to avoid status button
        document.addEventListener('click', function(e) {
            // Ensure the clicked element or its parent is not an action button or the status toggle button
            if (e.target.closest('a') || e.target.closest('button') || e.target.classList.contains('status-toggle-btn')) {
                return;
            }

            let targetRow = e.target.closest('tr[data-link]');
            if (targetRow) {
                const link = targetRow.getAttribute('data-link');
                const sectionMatch = link.match(/^([a-zA-Z-]+)\.html/);
                if (sectionMatch) {
                    const sectionId = sectionMatch[1] + 'Content';
                    showMessageModal('Row Clicked', `You clicked on a row linked to: ${link}. In a real application, this would show user details or navigate to a specific page.`);
                } else {
                    showMessageModal('Row Clicked', `You clicked on a row linked to: ${link}. This action is currently simulated.`);
                }
            }
        });


        // Show login modal on page load and initialize data
        document.addEventListener('DOMContentLoaded', function() {
            initializeData();
            fetchUsersFromBackend(); // Load from Python FastApi!

            // ALWAYS require login on startup (disable auto-login)
            loggedInUser = {
                id: null,
                name: '',
                role: '',
                fullName: '',
                email: '',
                contact: '',
                address: '',
                picture: 'https://placehold.co/96x96/ADD8E6/00008B?text=P'
            };

            // Check if user was logged in from previous session
            if (loggedInUser && loggedInUser.id) {
                // User was logged in, show the app
                const loginModalElement = document.getElementById('loginModal');
                if (loginModalElement) {
                    loginModalElement.classList.add('hidden');
                }
                
                const sidebar = document.getElementById('sidebar');
                const contentArea = document.getElementById('contentArea');
                const main = document.querySelector('main');
                
                if (sidebar) sidebar.style.display = '';
                if (contentArea) contentArea.style.display = '';
                if (main) main.style.display = '';
                
                // Update display
                document.getElementById('sidebarUsername').textContent = loggedInUser.fullName;
                document.getElementById('sidebarUserrole').textContent = loggedInUser.role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                document.getElementById('topNavUsername').textContent = loggedInUser.fullName;
                document.getElementById('greetingName').textContent = loggedInUser.name;
                document.querySelector('#sidebar .user-info img').src = loggedInUser.picture;
                document.querySelector('header .dropdown img').src = loggedInUser.picture;
                
                // Update dropdown user info
                if (document.getElementById('dropdownUserName')) document.getElementById('dropdownUserName').textContent = loggedInUser.fullName;
                if (document.getElementById('dropdownUserEmail')) document.getElementById('dropdownUserEmail').textContent = loggedInUser.email;
                if (document.getElementById('topNavUserAvatar')) document.getElementById('topNavUserAvatar').src = loggedInUser.picture;
                
                // Show appropriate navigation
                document.querySelectorAll('.nav-section').forEach(section => {
                    section.classList.add('hidden');
                });
                
                const role = loggedInUser.role;
                let navSectionToShowId = '';
                if (role === 'administrator') {
                    navSectionToShowId = 'adminNav';
                } else if (role === 'training_manager') {
                    navSectionToShowId = 'trainingManagerNav';
                } else if (role === 'student') {
                    navSectionToShowId = 'studentNav';
                }
                const navSectionElement = document.getElementById(navSectionToShowId);
                if (navSectionElement) {
                    navSectionElement.classList.remove('hidden');
                }
                
                showSection('dashboardContent');
                updateDashboardStats();
            } else {
                // Show login modal and ensure UI is firmly hidden
                document.getElementById('loginModal').classList.remove('hidden');
                
                const sidebar = document.getElementById('sidebar');
                const contentArea = document.getElementById('contentArea');
                const main = document.querySelector('main');
                
                if (sidebar) sidebar.style.display = 'none';
                if (contentArea) contentArea.style.display = 'none';
                if (main) main.style.display = 'none';
            }

            renderUserTable(); // Initial render of the user table with dummy data
            renderAllExistingCoursesTable(); // Initial render of the admin courses table
            
            // Initialize assignment event listeners
            initializeAssignmentEventListeners();
        });


        // Course Management Specific Logic
        let allCoursesData = [];
        let editingCourseId = null;
        
        
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
            
            const submitBtn = document.querySelector('#createCourseForm button[type="submit"]');
            if (submitBtn) submitBtn.innerHTML = '<i class="las la-save mr-2"></i>Update Course';
            
            document.getElementById('courseNameInput').value = course.name || '';
            document.getElementById('courseDescriptionInput').value = course.description || '';
            
            const picturePreview = document.getElementById('coursePicturePreview');
            if (picturePreview) picturePreview.src = course.picture || "https://placehold.co/400x200/e2e8f0/64748b?text=Course+Image";
            
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
            if (confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
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

        // Function to get default courses
        function getDefaultCourses() {
            return [];
        }
        let currentCourseQuestions = [];
        let currentCoursePdfFileName = '';
        const coursePicturePreview = document.getElementById('coursePicturePreview');
        const coursePictureInput = document.getElementById('coursePictureInput');
        const coursePdfInput = document.getElementById('coursePdfInput');
        const coursePdfFileNameDisplay = document.getElementById('coursePdfFileName');

        // Function to render question input fields based on type
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


        function checkQuestionReadiness() {
            const type = document.getElementById('questionTypeSelect').value;
            const addQuestionBtn = document.getElementById('addQuestionBtn');
            let isValid = false;

            if (type === 'multiple-choice') {
                const questionText = document.getElementById('mcQuestionText').value.trim();
                const options = Array.from(document.querySelectorAll('.mc-option')).map(input => input.value.trim());
                const allOptionsFilled = options.every(option => option !== '');
                                const anyCheckboxSelected = Array.from(document.querySelectorAll('input[name="mcAnswer"]')).some(checkbox => checkbox.checked);
                isValid = questionText !== '' && options.length >= 2 && allOptionsFilled && anyCheckboxSelected;
            } else if (type === 'true-false') {
                const questionText = document.getElementById('tfQuestionText').value.trim();
                const anyCheckboxSelected = Array.from(document.querySelectorAll('input[name="tfAnswer"]')).some(checkbox => checkbox.checked);
                isValid = questionText !== '' && anyCheckboxSelected;
            } else if (type === 'matching') {
                const pairs = [];
                document.querySelectorAll('.matching-row').forEach(pairDiv => {
                    const term = pairDiv.querySelector('.matching-term').value.trim();
                    const definition = pairDiv.querySelector('.matching-definition').value.trim();
                    if (term && definition) {
                        pairs.push({ term, definition });
                    }
                });
                const allPairsValid = pairs.every(pair => pair.term !== '' && pair.definition !== '');
                isValid = pairs.length >= 2 && allPairsValid;
            } else if (type === 'fill-in-blank') {
                const questionText = document.getElementById('fillBlankQuestionText').value.trim();
                const answers = Array.from(document.querySelectorAll('.fill-blank-answer')).map(input => input.value.trim());
                isValid = questionText !== '' && answers.length >= 1 && answers.every(a => a !== '');
            } else if (type === 'ordering') {
                const questionText = document.getElementById('orderingQuestionText').value.trim();
                const items = Array.from(document.querySelectorAll('.ordering-item')).map(input => input.value.trim());
                isValid = questionText !== '' && items.length >= 2 && items.every(i => i !== '');
            } else if (type === 'long-answer') {
                const questionText = document.getElementById('longAnswerQuestionText').value.trim();
                isValid = questionText !== '';
            }
            addQuestionBtn.disabled = !isValid;
        }

        // Multiple Choice: Add new option field
        function addMultipleChoiceOption() {
            const container = document.getElementById('mcOptionsContainer');
            const optionCount = container.querySelectorAll('.mc-option-row').length;
            const newOptionDiv = document.createElement('div');
            newOptionDiv.classList.add('flex', 'items-center', 'gap-2', 'mc-option-row');
            newOptionDiv.innerHTML = `
                <input type="checkbox" name="mcAnswer" value="${optionCount}" class="h-4 w-4 text-emerald-600 border-gray-300 rounded cursor-pointer">
                <input type="text" class="mc-option px-3 py-1.5 text-sm border border-gray-300 rounded-md flex-1" placeholder="Option ${optionCount + 1}" onkeydown="if(event.key==='Enter'){event.preventDefault();addMultipleChoiceOption();}">
                <button type="button" class="remove-option-btn text-red-500 hover:text-red-700 p-1"><i class="las la-times"></i></button>
            `;
            container.appendChild(newOptionDiv);
            newOptionDiv.querySelector('.remove-option-btn').addEventListener('click', removeMultipleChoiceOption);
            newOptionDiv.querySelector('.mc-option').addEventListener('input', checkQuestionReadiness);
            newOptionDiv.querySelector('input[name=\"mcAnswer\"]').addEventListener('change', checkQuestionReadiness);
            newOptionDiv.querySelector('.mc-option').focus();
            checkQuestionReadiness();
        }

        function removeMultipleChoiceOption(event) {
            const container = document.getElementById('mcOptionsContainer');
            if (container.querySelectorAll('.mc-option-row').length <= 2) {
                alert("A multiple-choice question must have at least 2 options.");
                return;
            }
            const optionDiv = event.target.closest('.mc-option-row');
            if (optionDiv && optionDiv.querySelector('.mc-option')) {
                optionDiv.remove();
                document.querySelectorAll('#mcOptionsContainer .mc-option-row').forEach((div, index) => {
                    const checkbox = div.querySelector('input[type="checkbox"]');
                    if (checkbox) checkbox.value = index;
                });
            }
            checkQuestionReadiness();
        }

        // Matching: Add new pair field
        function addMatchingPair() {
            const container = document.getElementById('matchingPairsContainer');
            const newPairDiv = document.createElement('div');
            newPairDiv.classList.add('flex', 'items-center', 'gap-2', 'matching-row');
            newPairDiv.innerHTML = `
                <input type="text" class="matching-term px-3 py-1.5 text-sm border border-gray-300 rounded-md w-5/12" placeholder="Term">
                <i class="las la-arrow-right text-gray-400 text-xs"></i>
                <input type="text" class="matching-definition px-3 py-1.5 text-sm border border-gray-300 rounded-md flex-1" placeholder="Definition" onkeydown="if(event.key==='Enter'){event.preventDefault();addMatchingPair();}">
                <button type="button" class="remove-pair-btn text-red-500 hover:text-red-700 p-1"><i class="las la-times"></i></button>
            `;
            container.appendChild(newPairDiv);
            newPairDiv.querySelector('.remove-pair-btn').addEventListener('click', removeMatchingPair);
            newPairDiv.querySelectorAll('.matching-term, .matching-definition').forEach(input => input.addEventListener('input', checkQuestionReadiness));
            newPairDiv.querySelector('.matching-term').focus();
            checkQuestionReadiness();
        }

        function removeMatchingPair(event) {
            const container = document.getElementById('matchingPairsContainer');
            if (container.querySelectorAll('.matching-row').length <= 2) {
                alert("A matching question must have at least 2 pairs.");
                return;
            }
            const pairDiv = event.target.closest('.matching-row');
            if (pairDiv) pairDiv.remove();
            checkQuestionReadiness();
        }

        // Fill-in-Blank: Add new answer field
        function addBlankAnswer() {
            const container = document.getElementById('fillBlankAnswersContainer');
            const answerCount = container.querySelectorAll('.blank-row').length + 1;
            const newAnswerDiv = document.createElement('div');
            newAnswerDiv.classList.add('flex', 'items-center', 'gap-2', 'blank-row');
            newAnswerDiv.innerHTML = `
                <span class="text-xs font-medium text-gray-500 w-4">${answerCount}.</span>
                <input type="text" class="fill-blank-answer px-3 py-1.5 text-sm border border-gray-300 rounded-md flex-1" placeholder="Answer for blank ${answerCount}" onkeydown="if(event.key==='Enter'){event.preventDefault();addBlankAnswer();}">
                <button type="button" class="remove-blank-btn text-red-500 hover:text-red-700 p-1"><i class="las la-times"></i></button>
            `;
            container.appendChild(newAnswerDiv);
            newAnswerDiv.querySelector('.remove-blank-btn').addEventListener('click', removeBlankAnswer);
            newAnswerDiv.querySelector('.fill-blank-answer').addEventListener('input', checkQuestionReadiness);
            newAnswerDiv.querySelector('.fill-blank-answer').focus();
            checkQuestionReadiness();
        }

        function removeBlankAnswer(event) {
            const container = document.getElementById('fillBlankAnswersContainer');
            if (container.querySelectorAll('.blank-row').length <= 1) {
                alert("A fill-in-the-blank question must have at least 1 answer.");
                return;
            }
            const answerDiv = event.target.closest('.blank-row');
            if (answerDiv) {
                answerDiv.remove();
                document.querySelectorAll('#fillBlankAnswersContainer .blank-row').forEach((div, index) => {
                    div.querySelector('span').textContent = `${index + 1}.`;
                    div.querySelector('.fill-blank-answer').placeholder = `Answer for blank ${index + 1}`;
                });
            }
            checkQuestionReadiness();
        }

        // Ordering: Add new item field
        function addOrderingItem() {
            const container = document.getElementById('orderingItemsContainer');
            const itemCount = container.querySelectorAll('.order-row').length + 1;
            const newItemDiv = document.createElement('div');
            newItemDiv.classList.add('flex', 'items-center', 'gap-2', 'order-row');
            newItemDiv.innerHTML = `
                <span class="text-xs font-medium text-gray-500 w-4">${itemCount}.</span>
                <input type="text" class="ordering-item px-3 py-1.5 text-sm border border-gray-300 rounded-md flex-1" placeholder="Item ${itemCount}" onkeydown="if(event.key==='Enter'){event.preventDefault();addOrderingItem();}">
                <button type="button" class="remove-ordering-btn text-red-500 hover:text-red-700 p-1"><i class="las la-times"></i></button>
            `;
            container.appendChild(newItemDiv);
            newItemDiv.querySelector('.remove-ordering-btn').addEventListener('click', removeOrderingItem);
            newItemDiv.querySelector('.ordering-item').addEventListener('input', checkQuestionReadiness);
            newItemDiv.querySelector('.ordering-item').focus();
            checkQuestionReadiness();
        }

        function removeOrderingItem(event) {
            const container = document.getElementById('orderingItemsContainer');
            if (container.querySelectorAll('.order-row').length <= 2) {
                alert("An ordering question must have at least 2 items.");
                return;
            }
            const itemDiv = event.target.closest('.order-row');
            if (itemDiv) {
                itemDiv.remove();
                document.querySelectorAll('#orderingItemsContainer .order-row').forEach((div, index) => {
                    div.querySelector('span').textContent = `${index + 1}.`;
                    div.querySelector('.ordering-item').placeholder = `Item ${index + 1}`;
                });
            }
            checkQuestionReadiness();
        }

        // Event listener for question type selection dropdown
        document.getElementById('questionTypeSelect').addEventListener('change', function() {
            renderQuestionInputArea(this.value);
        });

        // Event listener for adding a question to the current course's temporary list
        document.getElementById('addQuestionBtn').addEventListener('click', function() {
            const type = document.getElementById('questionTypeSelect').value;
            let question = { type: type };

            const marksInput = document.getElementById('questionMarks');
            const marks = marksInput ? parseInt(marksInput.value, 10) : 0;
            if (!marks || marks <= 0) {
                showMessageModal('Input Error', 'Please enter a valid number of marks (greater than 0).');
                return;
            }
            question.marks = marks;


            if (type === 'multiple-choice') {
                const questionText = document.getElementById('mcQuestionText').value.trim();
                const options = Array.from(document.querySelectorAll('.mc-option')).map(input => input.value.trim());
                const correctAnswers = Array.from(document.querySelectorAll('input[name="mcAnswer"]:checked')).map(cb => parseInt(cb.value));

                if (!questionText || options.some(o => !o) || correctAnswers.length === 0) {
                    showMessageModal('Input Error', 'Please fill in all multiple-choice fields and select a correct answer.');
                    return;
                }

                question.text = questionText;
                question.options = options;
                question.correctAnswer = correctAnswers.length === 1 ? correctAnswers[0] : correctAnswers;

            } else if (type === 'true-false') {
                const questionText = document.getElementById('tfQuestionText').value.trim();
                const _tfChecked = document.querySelector('input[name="tfAnswer"]:checked');
                const correctAnswer = _tfChecked ? _tfChecked.value : undefined;

                if (!questionText || !correctAnswer) {
                    showMessageModal('Input Error', 'Please fill in the true/false question and select a correct answer.');
                    return;
                }

                question.text = questionText;
                question.correctAnswer = correctAnswer === 'true';

            } else if (type === 'matching') {
                const pairs = [];
                document.querySelectorAll('.matching-row').forEach(pairDiv => {
                    const term = pairDiv.querySelector('.matching-term').value.trim();
                    const definition = pairDiv.querySelector('.matching-definition').value.trim();
                    if (term && definition) {
                        pairs.push({ term, definition });
                    }
                });

                if (pairs.length < 2 || pairs.some(pair => !pair.term || !pair.definition)) { // Require at least 2 complete pairs
                    showMessageModal('Input Error', 'Please add at least two complete matching pairs (Term and Definition).');
                    return;
                }
                question.pairs = pairs;
            } else if (type === 'fill-in-blank') {
                const questionText = document.getElementById('fillBlankQuestionText').value.trim();
                const answers = Array.from(document.querySelectorAll('.fill-blank-answer')).map(input => input.value.trim());
                
                if (!questionText || answers.length < 1 || answers.some(a => !a)) {
                    showMessageModal('Input Error', 'Please fill in question text and at least one answer.');
                    return;
                }
                
                question.text = questionText;
                question.answers = answers;
            } else if (type === 'ordering') {
                const questionText = document.getElementById('orderingQuestionText').value.trim();
                const items = Array.from(document.querySelectorAll('.ordering-item')).map(input => input.value.trim());
                
                if (!questionText || items.length < 2 || items.some(i => !i)) {
                    showMessageModal('Input Error', 'Please fill in question text and at least two items.');
                    return;
                }
                
                question.text = questionText;
                question.correctOrder = items;
            } else if (type === 'long-answer') {
                const questionText = document.getElementById('longAnswerQuestionText').value.trim();
                if (!questionText) {
                    showMessageModal('Input Error', 'Please enter the long answer question text.');
                    return;
                }
                question.text = questionText;
            }
            else {
                showMessageModal('Error', 'Please select a question type.');
                return;
            }

            currentCourseQuestions.push(question);
            updateCourseQuestionsList();
            showMessageModal('Question Added', `A ${type.replace('-', ' ')} question has been added for ${marks} marks.`);
            // Clear question form after adding
            document.getElementById('questionTypeSelect').value = '';
            renderQuestionInputArea(''); // Clear inputs
            document.getElementById('addQuestionBtn').disabled = true;
        });

        // Update the displayed list of questions for the current course
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
                    icon = 'ðŸ“';
                    questionSummary = `MC: ${q.text.substring(0, 40)}${q.text.length > 40 ? '...' : ''} ${marksText}`;
                } else if (q.type === 'true-false') {
                    icon = 'âš–ï¸';
                    questionSummary = `T/F: ${q.text.substring(0, 40)}${q.text.length > 40 ? '...' : ''} ${marksText}`;
                } else if (q.type === 'matching') {
                    icon = 'ðŸ”—';
                    questionSummary = `Matching: ${q.pairs.length} pairs ${marksText}`;
                } else if (q.type === 'fill-in-blank') {
                    icon = 'âœï¸';
                    questionSummary = `Fill in Blank: ${q.text.substring(0, 40)}${q.text.length > 40 ? '...' : ''} ${marksText}`;
                } else if (q.type === 'ordering') {
                    icon = 'ðŸ”¢';
                    questionSummary = `Ordering: ${q.correctOrder.length} items ${marksText}`;
                } else if (q.type === 'long-answer') {
                    icon = 'âœï¸';
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

        // Handle PDF file name display
        coursePdfInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                coursePdfFileNameDisplay.textContent = `Selected: ${this.files[0].name}`;
                coursePdfFileNameDisplay.classList.remove('hidden');
                currentCoursePdfFileName = this.files[0].name;
            } else {
                coursePdfFileNameDisplay.textContent = '';
                coursePdfFileNameDisplay.classList.add('hidden');
                currentCoursePdfFileName = '';
            }
        });

        // Handle Course Picture preview
        coursePictureInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    coursePicturePreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                coursePicturePreview.src = "https://placehold.co/128x128/E0E7FF/4F46E5?text=Course+Image"; // Reset to placeholder
            }
        });


        // Reset Course Form
        function resetCourseForm() {
            document.getElementById('createCourseForm').reset();
            document.getElementById('questionTypeSelect').value = '';
            renderQuestionInputArea('');
            currentCourseQuestions = [];
            updateCourseQuestionsList();
            currentCourseVideos = [];
            renderCourseVideosList();
            currentCourseAssignments = [];
            renderCourseAssignmentsList();
            currentCoursePdfFileName = '';
            coursePdfFileNameDisplay.classList.add('hidden');
            courseAssignmentDocFilesList.innerHTML = '';
            coursePicturePreview.src = "https://placehold.co/128x128/E0E7FF/4F46E5?text=Course+Image"; // Reset course picture preview
            document.getElementById('addQuestionBtn').disabled = true;
            showMessageModal('Form Reset', 'The course creation form has been cleared.');
        }

        // Course Assignments Management
        let currentCourseAssignments = [];

        // Show selected document files for course assignment
        const courseAssignmentDocInput = document.getElementById('courseAssignmentDocumentInput');
        const courseAssignmentDocFilesList = document.getElementById('courseAssignmentDocFilesList');
        
        if (courseAssignmentDocInput) {
            courseAssignmentDocInput.addEventListener('change', function() {
                courseAssignmentDocFilesList.innerHTML = '';
                if (this.files.length > 0) {
                    Array.from(this.files).forEach(file => {
                        const fileSize = (file.size / 1024).toFixed(2); // KB
                        const fileExt = file.name.split('.').pop().toUpperCase();
                        let icon = 'la-file';
                        if (fileExt === 'PDF') icon = 'la-file-pdf';
                        else if (fileExt === 'PPT' || fileExt === 'PPTX') icon = 'la-file-powerpoint';
                        else if (fileExt === 'DOC' || fileExt === 'DOCX') icon = 'la-file-word';
                        
                        const fileItem = document.createElement('p');
                        fileItem.className = 'text-xs text-green-600 font-medium flex items-center';
                        fileItem.innerHTML = `<i class="fas ${icon} mr-1 text-purple-600"></i><strong>${file.name}</strong> (${fileSize} KB)`;
                        courseAssignmentDocFilesList.appendChild(fileItem);
                    });
                }
            });
        }

        // Add assignment to course
        const addCourseAssignmentBtn = document.getElementById('addCourseAssignmentBtn');
        if (addCourseAssignmentBtn) {
            addCourseAssignmentBtn.addEventListener('click', function() {
                const title = document.getElementById('courseAssignmentTitleInput').value.trim();
                const dueDate = document.getElementById('courseAssignmentDueDateInput').value;
                const type = document.getElementById('courseAssignmentTypeSelect').value;
                const instructions = document.getElementById('courseAssignmentInstructionsInput').value.trim();
                const marks = parseInt(document.getElementById('courseAssignmentMarksInput').value) || 0;
                const docFiles = courseAssignmentDocInput.files;

                if (!title || !dueDate || !instructions) {
                    showMessageModal('Input Error', 'Please fill in Title, Due Date, and Instructions for the assignment.');
                    return;
                }

                if (!docFiles || docFiles.length === 0) {
                    showMessageModal('Document Required', 'Please upload at least one document for the assignment.');
                    return;
                }

                // Create documents array from uploaded files
                const documents = Array.from(docFiles).map(file => ({
                    fileName: file.name,
                    fileUrl: URL.createObjectURL(file),
                    fileType: file.name.split('.').pop().toUpperCase(),
                    fileSize: (file.size / 1024).toFixed(2) + ' KB'
                }));

                const assignment = {
                    id: Date.now(),
                    title,
                    dueDate,
                    type,
                    instructions,
                    totalMarks: marks,
                    documents: documents
                };

                currentCourseAssignments.push(assignment);
                renderCourseAssignmentsList();

                // Clear inputs
                document.getElementById('courseAssignmentTitleInput').value = '';
                document.getElementById('courseAssignmentDueDateInput').value = '';
                document.getElementById('courseAssignmentInstructionsInput').value = '';
                document.getElementById('courseAssignmentMarksInput').value = '100';
                courseAssignmentDocInput.value = '';
                courseAssignmentDocFilesList.innerHTML = '';

                showMessageModal('Assignment Added', `Assignment "${title}" has been added to the course with ${documents.length} document(s).`);
            });
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

        // Video Management for Course Creation
        let currentCourseVideos = [];

        function addVideoToCourse() {
            const title = document.getElementById('videoTitleInput').value.trim();
            const duration = document.getElementById('videoDurationInput').value.trim();
            const url = document.getElementById('videoUrlInput').value.trim();
            const fileInput = document.getElementById('videoFileInput');
            const file = fileInput.files[0];

            if (!title || !duration) {
                showMessageModal('Input Error', 'Please enter video title and duration.');
                return;
            }

            // Must have either a file OR a URL
            if (!file && !url) {
                showMessageModal('Input Error', 'Please either upload a video file or provide a video URL.');
                return;
            }

            // If both are provided, warn user
            if (file && url) {
                showMessageModal('Input Error', 'Please choose either a video file OR a URL, not both.');
                return;
            }

            // If URL is provided, validate it
            if (url) {
                try {
                    new URL(url);
                } catch (e) {
                    showMessageModal('Invalid URL', 'Please enter a valid video URL.');
                    return;
                }
            }

            const video = {
                id: Date.now(),
                title: title,
                duration: duration,
                url: url || null,
                fileName: file ? file.name : null,
                fileSize: file ? (file.size / (1024 * 1024)).toFixed(2) + ' MB' : null,
                isFile: !!file
            };

            currentCourseVideos.push(video);
            renderCourseVideosList();

            // Clear inputs
            document.getElementById('videoTitleInput').value = '';
            document.getElementById('videoDurationInput').value = '';
            document.getElementById('videoUrlInput').value = '';
            fileInput.value = '';
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
                                        <i class="las la-clock text-gray-500 mr-1"></i>${video.duration} ? ${sourceInfo}
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

        function removeCourseVideo(index) {
            currentCourseVideos.splice(index, 1);
            renderCourseVideosList();
        }

        // Add event listener for Add Video button
        document.getElementById('addVideoBtn').addEventListener('click', addVideoToCourse);

        // Handle Create Course Form Submission
        document.getElementById('createCourseForm').addEventListener('submit', function(e) {
            e.preventDefault();

            const courseName = document.getElementById('courseNameInput').value.trim();
            const courseDescription = document.getElementById('courseDescriptionInput').value.trim();

            if (!courseName || !courseDescription) {
                showMessageModal('Input Error', 'Please enter course name and description.');
                return;
            }

            if (!loggedInUser.id) {
                showMessageModal('Authentication Error', 'Please log in as a Training Manager to create a course.');
                return;
            }

            const coursePicture = coursePicturePreview.src;
            const completionDeadline = document.getElementById('courseCompletionDeadlineInput').value;

            // Create documents array from uploaded course PDF if exists
            const documentsArray = [];
            const coursePdfInput = document.getElementById('coursePdfInput');
            if (coursePdfInput.files.length > 0) {
                const file = coursePdfInput.files[0];
                const fileExtension = file.name.split('.').pop().toUpperCase();
                documentsArray.push({
                    id: Date.now(),
                    title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension from title
                    description: `Course material for ${courseName}`,
                    fileUrl: URL.createObjectURL(file),
                    fileName: file.name,
                    fileSize: (file.size / 1024).toFixed(2) + ' KB',
                    type: fileExtension === 'PDF' ? 'PDF' : (fileExtension === 'PPT' || fileExtension === 'PPTX' ? 'PPT' : 'DOC'),
                    createdDate: new Date().toISOString(),
                    isRequired: true
                });
            }

            if (editingCourseId) {
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
                    showMessageModal('Course Updated', `Course "${courseName}" has been successfully updated.`);
                }
                editingCourseId = null;
                const submitBtn = document.querySelector('#createCourseForm button[type="submit"]');
                if (submitBtn) submitBtn.innerHTML = '<i class="las la-plus-circle mr-2"></i>Create Course';
                
            } else {
                const newCourse = {
                    id: Date.now(),
                    creatorId: loggedInUser.id,
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
                
                const videoText = currentCourseVideos.length > 0 ? `${currentCourseVideos.length} video(s)` : 'no videos';
                const questionText = currentCourseQuestions.length > 0 ? `${currentCourseQuestions.length} question(s)` : 'no questions';
                const assignmentText = currentCourseAssignments.length > 0 ? `, ${currentCourseAssignments.length} assignment(s)` : '';
                
                showMessageModal('Course Created Successfully!', 
                    `Course "${courseName}" has been created with ${videoText}, ${questionText}${assignmentText}.`
                );
            }

            if (typeof renderTrainingManagerCoursesTable === 'function') renderTrainingManagerCoursesTable();
            if (typeof renderAllExistingCoursesTable === 'function') renderAllExistingCoursesTable();
            if (typeof populateLinkedCoursesSelection === 'function') populateLinkedCoursesSelection();
            if (typeof populateReportCourseSelect === 'function') populateReportCourseSelect();
            if (typeof renderCoursesForAssignmentTable === 'function') renderCoursesForAssignmentTable();
            if (typeof updateDashboardStats === 'function') updateDashboardStats();
            
            resetCourseForm();
        });

        // Course Deadline Helper Function
        function getCourseDeadlineInfo(course) {
            if (!course.completionDeadline) {
                return { badge: '', daysRemaining: null, status: 'none' };
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const deadline = new Date(course.completionDeadline);
            deadline.setHours(0, 0, 0, 0);
            const daysRemaining = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

            let badge = '';
            let status = '';

            if (daysRemaining < 0) {
                // Overdue
                badge = ` <span class="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 border border-red-300"><i class="las la-exclamation-triangle mr-1"></i>Overdue</span>`;
                status = 'overdue';
            } else if (daysRemaining === 0) {
                // Due today
                badge = ` <span class="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 border border-red-300"><i class="las la-calendar-day mr-1"></i>Due Today</span>`;
                status = 'today';
            } else if (daysRemaining === 1) {
                // Due tomorrow
                badge = ` <span class="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 border border-yellow-300"><i class="las la-calendar-alt mr-1"></i>Due Tomorrow</span>`;
                status = 'tomorrow';
            } else if (daysRemaining <= 3) {
                // Due within 3 days
                badge = ` <span class="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 border border-yellow-300"><i class="las la-hourglass-half mr-1"></i>${daysRemaining} days</span>`;
                status = 'urgent';
            } else if (daysRemaining <= 7) {
                // Due within 7 days
                badge = ` <span class="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 border border-blue-300"><i class="las la-clock mr-1"></i>${daysRemaining} days</span>`;
                status = 'upcoming';
            } else {
                // More than 7 days
                badge = ` <span class="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 border border-gray-300"><i class="las la-calendar-check mr-1"></i>${daysRemaining} days</span>`;
                status = 'normal';
            }

            return { badge, daysRemaining, status };
        }

        // Update Training Manager Course Statistics Dashboard
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

        // Render Training Manager's Courses Table
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

        // Render ALL Existing Courses Table (for Admin overview)
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


        // PDF Viewer Modal Logic
        const pdfViewerModal = document.getElementById('pdfViewerModal');
        const pdfModalTitle = document.getElementById('pdfModalTitle');
        const simulatedPdfContentFileName = document.getElementById('simulatedPdfContentFileName');
        let currentViewingDocumentId = null; // To keep track of which document is being viewed

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

        function hidePdfViewerModal() {
            pdfViewerModal.classList.remove('show');
            pdfViewerModal.classList.add('hidden');
            currentViewingDocumentId = null; // Clear the ID
        }

        // Mark as Read button listener inside PDF viewer modal
        document.getElementById('markAsReadBtn').addEventListener('click', function() {
            if (currentViewingDocumentId) {
                const courseIndex = allCoursesData.findIndex(c => c.id === currentViewingDocumentId);
                if (courseIndex !== -1) {
                    allCoursesData[courseIndex].readStatus = true;
                    showMessageModal('Completion Marked', `"${allCoursesData[courseIndex].pdfFileName}" marked as read.`);
                    // Update the UI in course content list as well
                    renderAllExistingCoursesTable(); // For admin view
                    renderTrainingManagerCoursesTable(); // For Training Manager view
                    // Disable the button in the modal
                    this.textContent = 'Already Read';
                    this.disabled = true;
                    this.classList.remove('bg-green-600', 'hover:bg-green-700');
                    this.classList.add('bg-gray-400', 'cursor-not-allowed');
                }
            }
        });


        // Programme Management Logic
        let allProgramsData = []; // Stores all created programme data
        const programmePicturePreview = document.getElementById('programmePicturePreview');
        const programmePictureInput = document.getElementById('programmePictureInput');
        const linkedCoursesSelection = document.getElementById('linkedCoursesSelection');

        // Handle Programme Picture preview
        programmePictureInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    programmePicturePreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                programmePicturePreview.src = "https://placehold.co/128x128/ADD8E6/00008B?text=Programme+Image"; // Reset to placeholder
            }
        });

        // Populate courses for linking to a programme
        function populateLinkedCoursesSelection() {
            linkedCoursesSelection.innerHTML = '';
            if (allCoursesData.length === 0) {
                linkedCoursesSelection.innerHTML = '<p id="noCoursesAvailableForProgramme" class="text-gray-500 text-sm text-center">No courses available. Create courses first.</p>';
            } else {
                allCoursesData.forEach(course => {
                    const checkboxDiv = document.createElement('div');
                    checkboxDiv.classList.add('flex', 'items-center', 'py-1');
                    checkboxDiv.innerHTML = `
                        <input type="checkbox" id="linkCourse_${course.id}" value="${course.id}" class="linked-course-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500">
                        <label for="linkCourse_${course.id}" class="ml-2 text-sm text-gray-700">${course.name}</label>
                    `;
                    linkedCoursesSelection.appendChild(checkboxDiv);
                });
            }
        }

        // Reset Programme Form
        function resetProgrammeForm() {
            document.getElementById('createProgrammeForm').reset();
            programmePicturePreview.src = "https://placehold.co/128x128/ADD8E6/00008B?text=Programme+Image";
            document.querySelectorAll('.linked-course-checkbox').forEach(checkbox => checkbox.checked = false);
            showMessageModal('Form Reset', 'The programme creation form has been cleared.');
        }

        // Handle Create Programme Form Submission
        document.getElementById('createProgrammeForm').addEventListener('submit', function(e) {
            e.preventDefault();

            const programmeName = document.getElementById('programmeNameInput').value.trim();
            const programmePicture = programmePicturePreview.src;
            const selectedCourseIds = Array.from(document.querySelectorAll('.linked-course-checkbox:checked'))
                                          .map(checkbox => parseInt(checkbox.value));

            if (!programmeName) {
                showMessageModal('Input Error', 'Please enter a programme name.');
                return;
            }

            const newProgramme = {
                id: Date.now(),
                name: programmeName,
                picture: programmePicture,
                linkedCourseIds: selectedCourseIds,
                assignedStudentIds: [] // Initially no students assigned
            };
            allProgramsData.push(newProgramme);
            saveToLocalStorage(); // Save to localStorage
            
            renderExistingProgramsTable();
            renderProgrammesForAssignmentTable(); // Update the new assignment table
            updateDashboardStats(); // Update dashboard stats after adding programme

            showMessageModal('Programme Created', `Programme "${programmeName}" has been successfully created.`);
            resetProgrammeForm();
        });

        // Render Existing Programmes Table
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

        // Assign Students Modal Logic
        const assignStudentsModal = document.getElementById('assignStudentsModal');
        const assignStudentsModalTitle = document.getElementById('assignStudentsModalTitle');
        const assignStudentsList = document.getElementById('assignStudentsList');
        const noStudentsAvailableMsg = document.getElementById('noStudentsAvailable');
        let currentProgrammeIdToAssign = null;

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

        function hideAssignStudentsModal() {
            assignStudentsModal.classList.remove('show');
            assignStudentsModal.classList.add('hidden');
            currentProgrammeIdToAssign = null;
        }

        document.getElementById('saveAssignedStudentsBtn').addEventListener('click', function() {
            if (currentProgrammeIdToAssign) {
                const programme = allProgramsData.find(p => p.id === currentProgrammeIdToAssign);
                if (programme) {
                    const newlySelectedStudentIds = Array.from(document.querySelectorAll('.assign-student-checkbox:checked'))
                                                      .map(checkbox => parseInt(checkbox.value));
                    
                    // Students removed from this programme
                    const removedStudentIds = programme.assignedStudentIds.filter(id => !newlySelectedStudentIds.includes(id));
                    // Students newly added to this programme
                    const addedStudentIds = newlySelectedStudentIds.filter(id => !programme.assignedStudentIds.includes(id));

                    programme.assignedStudentIds = newlySelectedStudentIds; // Update the programme's assigned students

                    // Update each student's coursesEnrolled list based on programme's linked courses
                    const programmeLinkedCourses = programme.linkedCourseIds;

                    removedStudentIds.forEach(studentId => {
                        const student = allUsersData.find(u => u.id === studentId);
                        if (student) {
                            // Ensure coursesEnrolled exists
                            student.coursesEnrolled = student.coursesEnrolled || [];
                            // Remove courses linked to this programme from student's enrolled list
                            student.coursesEnrolled = student.coursesEnrolled.filter(enr =>
                                !programmeLinkedCourses.includes(enr.courseId)
                            );
                            student.totalHoursSpent = student.coursesEnrolled.reduce((sum, c) => sum + (c.hoursSpent || 0), 0);
                        }
                    });

                    addedStudentIds.forEach(studentId => {
                        const student = allUsersData.find(u => u.id === studentId);
                        if (student) {
                            // Ensure coursesEnrolled exists
                            student.coursesEnrolled = student.coursesEnrolled || [];
                            programmeLinkedCourses.forEach(courseId => {
                                // Add course to student's enrolled list if not already there
                                if (!student.coursesEnrolled.some(enr => enr.courseId === courseId)) {
                                    student.coursesEnrolled.push({
                                        courseId: parseInt(courseId),
                                        enrollmentDate: new Date().toISOString().slice(0, 10),
                                        completionDate: null,
                                        hoursSpent: 0 // Initialize hours spent for this course
                                    });
                                }
                            });
                            student.totalHoursSpent = student.coursesEnrolled.reduce((sum, c) => sum + (c.hoursSpent || 0), 0);
                            
                            // Create notification for student about programme enrollment
                            studentNotifications.push({
                                id: Date.now() + Math.random(),
                                studentId: student.id,
                                title: 'Enrolled in Programme',
                                message: `You have been enrolled in the programme "${programme.name}" with ${programmeLinkedCourses.length} course(s). Check your courses to start learning!`,
                                type: 'success',
                                timestamp: new Date().toISOString(),
                                read: false,
                                programmeId: programme.id
                            });
                        }
                    });
                    
                    saveToLocalStorage(); // Save to localStorage
                    
                    // Update logged in user if they are affected
                    if (loggedInUser && loggedInUser.id) {
                        const updatedUser = allUsersData.find(u => u.id === loggedInUser.id);
                        if (updatedUser) {
                            loggedInUser.coursesEnrolled = updatedUser.coursesEnrolled;
                            loggedInUser.totalHoursSpent = updatedUser.totalHoursSpent;
                            localStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
                        }
                    }
                    
                    // Create detailed success message
                    const totalAssigned = newlySelectedStudentIds.length;
                    const addedCount = addedStudentIds.length;
                    const removedCount = removedStudentIds.length;
                    
                    let message = `Programme "${programme.name}" now has ${totalAssigned} student(s) assigned.`;
                    if (addedCount > 0) {
                        message += `\n\n? Added: ${addedCount} student(s)`;
                    }
                    if (removedCount > 0) {
                        message += `\n\n? Removed: ${removedCount} student(s)`;
                    }
                    if (addedCount > 0) {
                        message += `\n\n<i class="las la-trophy text-yellow-500 text-2xl"></i> Each newly assigned student has been enrolled in ${programmeLinkedCourses.length} course(s) from this programme.`;
                    }
                    
                    showMessageModal('Programme Assignment Updated! ?', message);
                    renderExistingProgramsTable(); // Re-render programme table
                    renderProgrammesForAssignmentTable(); // Re-render assignment table
                    renderAssignmentOverview(); // Update assignment overview
                    updateDashboardStats(); // Refresh dashboard counts
                }
            }
            hideAssignStudentsModal();
        });

        // Helper functions for assignment modal
        function updateSelectedCount() {
            const checkedBoxes = document.querySelectorAll('.assign-student-checkbox:checked');
            const visibleCheckedBoxes = Array.from(checkedBoxes).filter(cb => 
                cb.closest('.student-item').style.display !== 'none'
            );
            document.getElementById('selectedStudentsCount').textContent = `${visibleCheckedBoxes.length} students selected`;
        }

        function selectAllStudents() {
            const visibleCheckboxes = Array.from(document.querySelectorAll('.assign-student-checkbox')).filter(cb => 
                cb.closest('.student-item').style.display !== 'none'
            );
            visibleCheckboxes.forEach(checkbox => checkbox.checked = true);
            updateSelectedCount();
        }

        function deselectAllStudents() {
            const visibleCheckboxes = Array.from(document.querySelectorAll('.assign-student-checkbox')).filter(cb => 
                cb.closest('.student-item').style.display !== 'none'
            );
            visibleCheckboxes.forEach(checkbox => checkbox.checked = false);
            updateSelectedCount();
        }

        function filterAssignStudentsList() {
            const searchTerm = document.getElementById('assignStudentsSearch').value.toLowerCase();
            const studentItems = document.querySelectorAll('.student-item');
            const noMatchMsg = document.getElementById('noStudentsMatchFilter');
            let visibleCount = 0;

            studentItems.forEach(item => {
                const name = item.dataset.studentName;
                const email = item.dataset.studentEmail;
                
                if (name.includes(searchTerm) || email.includes(searchTerm)) {
                    item.style.display = '';
                    visibleCount++;
                } else {
                    item.style.display = 'none';
                }
            });

            // Show/hide no match message
            if (visibleCount === 0 && studentItems.length > 0) {
                noMatchMsg.classList.remove('hidden');
            } else {
                noMatchMsg.classList.add('hidden');
            }

            updateSelectedCount();
        }

        // New function to render the table in the "User Assignment to Programmes" section
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

        // Direct Course Assignment Functions
        const assignStudentsToCoursesModal = document.getElementById('assignStudentsToCoursesModal');
        const assignStudentsToCoursesModalTitle = document.getElementById('assignStudentsToCoursesModalTitle');
        const assignStudentsToCoursesList = document.getElementById('assignStudentsToCouresList');
        const noStudentsAvailableForCourse = document.getElementById('noStudentsAvailableForCourse');
        let currentCourseIdToAssign = null;

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

        function hideAssignStudentsToCoursesModal() {
            assignStudentsToCoursesModal.classList.remove('show');
            assignStudentsToCoursesModal.classList.add('hidden');
            currentCourseIdToAssign = null;
        }

        document.getElementById('saveAssignedCourseStudentsBtn').addEventListener('click', function() {
            if (currentCourseIdToAssign) {
                const course = allCoursesData.find(c => c.id === currentCourseIdToAssign);
                if (course) {
                    const newlySelectedStudentIds = Array.from(document.querySelectorAll('.assign-course-student-checkbox:checked'))
                                                      .map(checkbox => parseInt(checkbox.value));
                    
                    const students = allUsersData.filter(user => user.role === 'student');
                    
                    students.forEach(student => {
                        const isCurrentlyEnrolled = student.coursesEnrolled.some(enr => enr.courseId === currentCourseIdToAssign);
                        const shouldBeEnrolled = newlySelectedStudentIds.includes(student.id);
                        
                        if (!isCurrentlyEnrolled && shouldBeEnrolled) {
                            // Add course to student's enrolled list
                            student.coursesEnrolled.push({
                                courseId: currentCourseIdToAssign,
                                enrollmentDate: new Date().toISOString().slice(0, 10),
                                completionDate: null,
                                hoursSpent: 0
                            });
                            student.totalHoursSpent = student.coursesEnrolled.reduce((sum, c) => sum + (c.hoursSpent || 0), 0);
                            
                            // Create course assignments for this student
                            if (course.assignments && course.assignments.length > 0) {
                                course.assignments.forEach(assignmentTemplate => {
                                    const newAssignment = {
                                        id: Date.now() + student.id + Math.floor(Math.random() * 10000),
                                        type: assignmentTemplate.type,
                                        title: assignmentTemplate.title,
                                        instructions: assignmentTemplate.instructions,
                                        dueDate: assignmentTemplate.dueDate,
                                        courseId: currentCourseIdToAssign,
                                        courseName: course.name,
                                        documents: assignmentTemplate.documents || [],
                                        totalMarks: assignmentTemplate.totalMarks,
                                        questions: assignmentTemplate.questions || [],
                                        assignedStudentId: student.id,
                                        creatorId: loggedInUser.id,
                                        status: assignmentTemplate.type === 'mark-as-read' ? 'Pending Read' : 'Assigned',
                                        submissionDate: null,
                                        markedAsRead: false,
                                        readDate: null,
                                        score: null,
                                        feedback: null,
                                        creationDate: new Date().toISOString().slice(0, 10)
                                    };
                                    allAssignmentsData.push(newAssignment);
                                });
                            }
                            
                            // Create notification for student
                            studentNotifications.push({
                                id: Date.now() + Math.random(),
                                studentId: student.id,
                                title: 'New Course Assigned',
                                message: `You have been assigned to the course "${course.name}". Start learning now!`,
                                type: 'info',
                                timestamp: new Date().toISOString(),
                                read: false,
                                courseId: currentCourseIdToAssign
                            });
                        } else if (isCurrentlyEnrolled && !shouldBeEnrolled) {
                            // Remove course from student's enrolled list (only if not from a programme)
                            // Check if this course is part of any programme the student is in
                            const isFromProgramme = allProgramsData.some(prog => 
                                prog.assignedStudentIds.includes(student.id) && 
                                prog.linkedCourseIds.includes(currentCourseIdToAssign)
                            );
                            
                            if (!isFromProgramme) {
                                student.coursesEnrolled = student.coursesEnrolled.filter(enr => enr.courseId !== currentCourseIdToAssign);
                                student.totalHoursSpent = student.coursesEnrolled.reduce((sum, c) => sum + (c.hoursSpent || 0), 0);
                            } else {
                                // Show warning that course is from a programme
                                const studentName = `${student.name}${student.surname ? ' ' + student.surname : ''}`;
                                showMessageModal('Warning', `Cannot remove ${studentName} from this course as it's assigned through a programme. Remove from the programme instead.`);
                            }
                        }
                    });
                    
                    saveToLocalStorage(); // Save to localStorage
                    
                    // Update logged in user if they are affected
                    if (loggedInUser && loggedInUser.id) {
                        const updatedUser = allUsersData.find(u => u.id === loggedInUser.id);
                        if (updatedUser) {
                            loggedInUser.coursesEnrolled = updatedUser.coursesEnrolled;
                            loggedInUser.totalHoursSpent = updatedUser.totalHoursSpent;
                            localStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
                        }
                    }
                    
                    showMessageModal('Success', `Student assignments for "${course.name}" updated.`);
                    renderCoursesForAssignmentTable(); // Re-render courses table
                    renderAssignmentOverview(); // Update assignment overview
                    renderTMAssignmentsTable(); // Refresh assignments table
                    updateDashboardStats(); // Refresh dashboard counts
                }
            }
            hideAssignStudentsToCoursesModal();
        });

        // Helper functions for course assignment modal
        function updateCourseSelectedCount() {
            const checkedBoxes = document.querySelectorAll('.assign-course-student-checkbox:checked');
            const visibleCheckedBoxes = Array.from(checkedBoxes).filter(cb => 
                cb.closest('.course-student-item').style.display !== 'none'
            );
            document.getElementById('selectedCourseStudentsCount').textContent = `${visibleCheckedBoxes.length} students selected`;
        }

        function selectAllCourseStudents() {
            const visibleCheckboxes = Array.from(document.querySelectorAll('.assign-course-student-checkbox')).filter(cb => 
                cb.closest('.course-student-item').style.display !== 'none'
            );
            visibleCheckboxes.forEach(checkbox => checkbox.checked = true);
            updateCourseSelectedCount();
        }

        function deselectAllCourseStudents() {
            const visibleCheckboxes = Array.from(document.querySelectorAll('.assign-course-student-checkbox')).filter(cb => 
                cb.closest('.course-student-item').style.display !== 'none'
            );
            visibleCheckboxes.forEach(checkbox => checkbox.checked = false);
            updateCourseSelectedCount();
        }

        function filterCourseAssignStudentsList() {
            const searchTerm = document.getElementById('assignStudentsToCoursesSearch').value.toLowerCase();
            const studentItems = document.querySelectorAll('.course-student-item');
            const noMatchMsg = document.getElementById('noStudentsMatchCourseFilter');
            let visibleCount = 0;

            studentItems.forEach(item => {
                const name = item.dataset.studentName;
                const email = item.dataset.studentEmail;
                
                if (name.includes(searchTerm) || email.includes(searchTerm)) {
                    item.style.display = '';
                    visibleCount++;
                } else {
                    item.style.display = 'none';
                }
            });

            // Show/hide no match message
            if (visibleCount === 0 && studentItems.length > 0) {
                noMatchMsg.classList.remove('hidden');
            } else {
                noMatchMsg.classList.add('hidden');
            }

            updateCourseSelectedCount();
        }

        // Render courses for direct assignment table
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

        // Tab Switching Function for Assignment Overview
        function switchAssignmentTab(tabName) {
            // Hide all tab contents
            document.querySelectorAll('.assignment-tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            
            // Remove active class from all tabs
            document.querySelectorAll('.assignment-tab').forEach(tab => {
                tab.classList.remove('active', 'border-indigo-500', 'text-indigo-600');
                tab.classList.add('border-transparent', 'text-gray-500');
            });
            
            // Show selected tab content
            const selectedContent = document.getElementById(`assignment-tab-${tabName}`);
            if (selectedContent) {
                selectedContent.classList.remove('hidden');
            }
            
            // Activate selected tab
            const selectedTab = document.getElementById(`tab-${tabName}`);
            if (selectedTab) {
                selectedTab.classList.add('active', 'border-indigo-500', 'text-indigo-600');
                selectedTab.classList.remove('border-transparent', 'text-gray-500');
            }
            
            // Load data for the selected tab
            if (tabName === 'overview') {
                renderAssignmentOverview();
            } else if (tabName === 'programmes') {
                renderProgrammesForAssignmentTable();
            } else if (tabName === 'courses') {
                renderCoursesForAssignmentTable();
            }
        }

        // Assignment Overview Dashboard Functions
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

        function navigateToCourseProgramme(courseId) {
            // Navigate to programme management
            showSection('programme-managementContent');
            showMessageModal('Link Course', 'Please edit or create a programme and link this course to it.');
        }

        // System Settings Logic
        const systemLogoPreview = document.getElementById('systemLogoPreview');
        const systemLogoInput = document.getElementById('systemLogoInput');
        const generalSettingsForm = document.getElementById('generalSettingsForm');
        const systemNameInput = document.getElementById('systemNameInput');
        const defaultTimezoneSelect = document.getElementById('defaultTimezoneSelect');
        const systemLanguageSelect = document.getElementById('systemLanguageSelect');

        // Initial system settings data (can be loaded from localStorage in a real app)
        let systemSettings = {
            systemName: 'SKILLSCONNECT',
            systemLogo: 'https://placehold.co/96x96/ADD8E6/00008B?text=LMS',
            defaultTimezone: 'UTC+2',
            systemLanguage: 'en'
        };

        // Function to load settings into the form
        function loadSystemSettings() {
            systemNameInput.value = systemSettings.systemName;
            systemLogoPreview.src = systemSettings.systemLogo;
            defaultTimezoneSelect.value = systemSettings.defaultTimezone;
            systemLanguageSelect.value = systemSettings.systemLanguage;
        }

        // Handle system logo preview
        systemLogoInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    systemLogoPreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                systemLogoPreview.src = "https://placehold.co/96x96/ADD8E6/00008B?text=LMS"; // Reset to placeholder
            }
        });

        // Handle form submission for general settings
        generalSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();

            systemSettings.systemName = systemNameInput.value.trim();
            // Store the base64 or URL for the logo if it's new
            systemSettings.systemLogo = systemLogoPreview.src;
            systemSettings.defaultTimezone = defaultTimezoneSelect.value;
            systemSettings.systemLanguage = systemLanguageSelect.value;

            // Update logo in sidebar and top nav if they exist
            document.querySelectorAll('.fas.la-graduation-cap.text-2xl.mr-3').forEach(icon => {
                 // Replace original logo icon with image if a custom logo is set
                if (systemSettings.systemLogo !== "https://placehold.co/96x96/ADD8E6/00008B?text=LMS") { // Check if it's not the default placeholder
                    const img = document.createElement('img');
                    img.src = systemSettings.systemLogo;
                    img.classList.add('h-8', 'w-8', 'rounded-full', 'mr-3', 'object-cover');
                    icon.replaceWith(img);
                }
            });


            showMessageModal('Settings Saved', 'General LMS settings have been updated.');
        });

        // Profile Settings Logic
        const profileSettingsForm = document.getElementById('profileSettingsForm');
        const profilePicturePreview = document.getElementById('profilePicturePreview');
        const profilePictureInput = document.getElementById('profilePictureInput');
        const profileFullNameInput = document.getElementById('profileFullNameInput');
        const profileEmailInput = document.getElementById('profileEmailInput');
        const profileContactInput = document.getElementById('profileContactInput');
        const profileAddressInput = document.getElementById('profileAddressInput');
        const profilePasswordInput = document.getElementById('profilePasswordInput');

        // Function to load profile settings into the form
        function loadProfileSettings() {
            profileFullNameInput.value = loggedInUser.fullName;
            profileEmailInput.value = loggedInUser.email;
            profileContactInput.value = loggedInUser.contact || '';
            profileAddressInput.value = loggedInUser.address || '';
            profilePicturePreview.src = loggedInUser.picture;
            profilePasswordInput.value = ''; // Never pre-fill password fields
        }

        // Handle profile picture preview
        profilePictureInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    profilePicturePreview.src = e.target.result;
                };
                reader.readAsDataURL(file);
            } else {
                profilePicturePreview.src = loggedInUser.picture; // Revert to current user picture
            }
        });

        // Handle profile settings form submission
        profileSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();

            loggedInUser.fullName = profileFullNameInput.value.trim();
            loggedInUser.email = profileEmailInput.value.trim();
            loggedInUser.contact = profileContactInput.value.trim();
            loggedInUser.address = profileAddressInput.value.trim();
            loggedInUser.picture = profilePicturePreview.src; // Update with new picture if uploaded

            // Find the user in allUsersData and update their properties
            const userIndex = allUsersData.findIndex(u => u.id === loggedInUser.id);
            if (userIndex !== -1) {
                // Ensure name and surname are updated correctly from fullName
                const nameParts = loggedInUser.fullName.split(' ');
                allUsersData[userIndex].name = nameParts[0] || '';
                allUsersData[userIndex].surname = nameParts.slice(1).join(' ') || ''; // Join remaining parts for surname
                allUsersData[userIndex].email = loggedInUser.email;
                // Don't update ID number or role here, as they are not editable via profile
                allUsersData[userIndex].picture = loggedInUser.picture;
                // Add contact and address fields to user object if they exist
                allUsersData[userIndex].contact = loggedInUser.contact;
                allUsersData[userIndex].address = loggedInUser.address;
            }

            if (profilePasswordInput.value.trim() !== '') {
                // In a real app, this would hash and save the new password
                // For simulation, just acknowledge it
                showMessageModal('Password Updated', 'Your password has been changed.');
                profilePasswordInput.value = ''; // Clear password field after change
            }
            
            // Update sidebar and top nav user info in case full name or picture changed
            document.getElementById('sidebarUsername').textContent = loggedInUser.fullName;
            document.getElementById('topNavUsername').textContent = loggedInUser.fullName;
            document.querySelector('#sidebar .user-info img').src = loggedInUser.picture;
            document.querySelector('header .dropdown img').src = loggedInUser.picture;


            showMessageModal('Profile Updated', 'Your personal information has been saved successfully.');
        });

        // Function to update dashboard statistics
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

        // Function to load student notifications
        function loadStudentNotifications(studentId) {
            const notificationsList = document.getElementById('recentNotificationsList');
            
            if (!notificationsList) {
                console.error('recentNotificationsList element not found');
                return;
            }
            
            console.log('Loading notifications for student:', studentId);
            
            // Get student's notifications from the array
            const userNotifications = studentNotifications.filter(n => n.studentId === studentId);
            
            // Sort by timestamp (newest first)
            userNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Combine with sample notifications for demo purposes
            const sampleNotifications = [];
            
            const notifications = [...userNotifications, ...sampleNotifications];
            
            // Sample notifications - in a real system these would come from a database
            const oldNotifications = [];
            // Ensure they are fully sorted
            notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            // User requested ONLY the latest notification
            const notificationsToShow = notifications.slice(0, 1);


            if (notifications.length === 0) {
                notificationsList.innerHTML = '<p class="text-gray-500 text-sm">No notifications to display.</p>';
                return;
            }

            notificationsList.innerHTML = '';
            
            // Count unread notifications
            const unreadCount = notifications.filter(n => !n.read).length;
            const unreadBadge = document.getElementById('unreadNotificationsCount');
            if (unreadBadge) {
                if (unreadCount > 0) {
                    unreadBadge.textContent = unreadCount;
                    unreadBadge.classList.remove('hidden');
                } else {
                    unreadBadge.classList.add('hidden');
                }
            }
            
            notificationsToShow.forEach(notification => {
                const notificationElement = document.createElement('div');
                notificationElement.className = `p-4 rounded-lg border-l-4 ${getNotificationStyles(notification.type)} ${notification.read ? 'bg-gray-50' : 'bg-white'}`;
                
                const timeAgo = getTimeAgo(new Date(notification.timestamp));
                
                notificationElement.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h4 class="font-semibold text-gray-800 text-sm">${notification.title}</h4>
                            <p class="text-gray-600 text-sm mt-1">${notification.message}</p>
                            <p class="text-xs text-gray-500 mt-2">${timeAgo}</p>
                        </div>
                        ${!notification.read ? '<span class="ml-4 inline-block w-2 h-2 bg-blue-600 rounded-full"></span>' : ''}
                    </div>
                `;
                notificationsList.appendChild(notificationElement);
            });
        }

        // Helper function to get notification styling based on type
        function getNotificationStyles(type) {
            switch(type) {
                case 'warning':
                    return 'border-yellow-400 bg-yellow-50';
                case 'success':
                    return 'border-green-400 bg-green-50';
                case 'error':
                    return 'border-red-400 bg-red-50';
                case 'info':
                default:
                    return 'border-blue-400 bg-blue-50';
            }
        }

        // Helper function to format time ago
        function getTimeAgo(date) {
            const seconds = Math.floor((new Date() - date) / 1000);
            const intervals = {
                year: 31536000,
                month: 2592000,
                week: 604800,
                day: 86400,
                hour: 3600,
                minute: 60
            };

            for (const [key, value] of Object.entries(intervals)) {
                const interval = Math.floor(seconds / value);
                if (interval >= 1) {
                    return interval === 1 ? `${interval} ${key} ago` : `${interval} ${key}s ago`;
                }
            }
            return 'Just now';
        }

        // Function to mark all notifications as read
        function markAllNotificationsAsRead() {
            if (loggedInUser && loggedInUser.id) {
                studentNotifications.forEach(notification => {
                    if (notification.studentId === loggedInUser.id) {
                        notification.read = true;
                    }
                });
                saveToLocalStorage();
                loadStudentNotifications(loggedInUser.id);
                showMessageModal('Success', 'All notifications marked as read.');
            }
        }

        // Function to load and display student badges earned
        function loadStudentBadgesEarned(studentId) {
            const badgesEarnedList = document.getElementById('badgesEarnedList');
            
            if (!badgesEarnedList) {
                console.error('badgesEarnedList element not found');
                return;
            }

            // Get all badges earned by this student
            const studentBadgesEarned = studentBadgesData.filter(b => b.studentId === studentId);

            if (studentBadgesEarned.length === 0) {
                badgesEarnedList.innerHTML = '<p class="text-gray-500 text-sm col-span-full">No badges earned yet. Keep learning to earn badges!</p>';
                return;
            }

            badgesEarnedList.innerHTML = '';
            
            // Get badge details for each earned badge
            studentBadgesEarned.forEach(earnedBadge => {
                const badgeData = allBadgesData.find(b => b.id === earnedBadge.badgeId);

                if (badgeData) {
                    const badgeElement = document.createElement('div');
                    badgeElement.className = 'group flex flex-col items-center justify-center p-6 rounded-2xl border border-blue-100 bg-white hover:bg-gradient-to-br hover:from-white hover:to-indigo-50/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(14,165,233,0.15)] transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden';

                    const earnedDate = new Date(earnedBadge.earnedDate);
                    const dateFormatted = earnedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

                    badgeElement.innerHTML = `
                        <div class="absolute inset-0 bg-blue-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div class="relative z-10 w-full flex flex-col items-center">
                            <div class="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50/50 shadow-sm border border-white/50 transform group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-md transition-all duration-300 text-5xl drop-shadow-sm">${badgeData.icon}</div>
                            <h4 class="font-bold text-gray-800 text-center text-sm mb-1 bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-indigo-900 line-clamp-1 w-full px-1">${badgeData.name}</h4>
                            <p class="text-[11px] text-gray-500 text-center mb-3 line-clamp-2 w-full px-2">${badgeData.description}</p>
                            <div class="inline-flex items-center justify-center space-x-1 mt-auto bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-600 text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full border border-emerald-100/50 group-hover:border-emerald-200 transition-colors">
                                <i class="fas fa-check-circle opacity-70"></i>
                                <span>${dateFormatted}</span>
                            </div>
                        </div>
                    `;
                    badgesEarnedList.appendChild(badgeElement);
                }
            });
        }

        // Function to load and display student certificates earned
        function loadStudentCertificatesEarned(studentId) {
            const certificatesEarnedList = document.getElementById('certificatesEarnedList');
            
            if (!certificatesEarnedList) {
                console.error('certificatesEarnedList element not found');
                return;
            }

            // Get all certificates earned by this student
            const studentCertificates = allCertificatesData.filter(c => c.studentId === studentId);

            if (studentCertificates.length === 0) {
                certificatesEarnedList.innerHTML = '<p class="text-gray-500 text-sm col-span-full">No certificates earned yet. Complete courses to earn certificates!</p>';
                return;
            }

            certificatesEarnedList.innerHTML = '';
            
            // Display each certificate
            studentCertificates.forEach(certificate => {
                const certElement = document.createElement('div');
                certElement.className = 'p-4 rounded-lg border-2 border-blue-400 bg-blue-50 hover:shadow-lg transition cursor-pointer';
                
                const issueDate = new Date(certificate.issueDate);
                const dateFormatted = issueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                
                certElement.innerHTML = `
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <div class="flex items-center mb-2">
                                <i class="las la-certificate text-blue-600 text-xl mr-2"></i>
                                <h4 class="font-semibold text-gray-800">${certificate.courseName}</h4>
                            </div>
                            <p class="text-sm text-gray-600 mb-2">${certificate.certificateType}</p>
                            <p class="text-xs text-gray-500">Issued on ${dateFormatted}</p>
                            <p class="text-xs text-gray-500">Certificate ID: ${certificate.id}</p>
                        </div>
                        <button onclick="showCertificateViewer('${certificate.id}')" class="ml-4 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                            View
                        </button>
                    </div>
                `;
                certificatesEarnedList.appendChild(certElement);
            });
        }

        // Reports Section Logic
        const reportGenerationForm = document.getElementById('reportGenerationForm');
        const reportCourseSelect = document.getElementById('reportCourseSelect');
        const reportResultsTableBody = document.getElementById('reportResultsTableBody');

        // Populate course select dropdown for reports
        function populateReportCourseSelect() {
            reportCourseSelect.innerHTML = '<option value="all">All Courses</option>'; // Always have "All Courses"
            allCoursesData.forEach(course => {
                const option = document.createElement('option');
                option.value = course.id;
                option.textContent = course.name;
                reportCourseSelect.appendChild(option);
            });
        }

        // Function to populate company filter dropdown for reports
        function populateReportCompanyFilter() {
            const companySelect = document.getElementById('reportCompanyFilter');
            if (!companySelect) return;
            
            companySelect.innerHTML = '<option value="all">All Companies</option>';
            
            // Get unique companies from users
            const companies = [...new Set(allUsersData.map(u => u.company).filter(c => c))];
            companies.sort();
            
            companies.forEach(company => {
                const option = document.createElement('option');
                option.value = company;
                option.textContent = company;
                companySelect.appendChild(option);
            });
        }

        // Generate Report Function
        reportGenerationForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const startDate = document.getElementById('reportStartDate').value;
            const endDate = document.getElementById('reportEndDate').value;
            const userStatusFilter = document.getElementById('reportUserStatus').value;
            const courseFilterId = document.getElementById('reportCourseSelect').value; // Keep as string for 'all'
            const companyFilter = document.getElementById('reportCompanyFilter').value;
            const reportType = document.getElementById('reportDataType').value;

            let filteredUsers = allUsersData;

            // Apply User Status/Role Filter
            if (userStatusFilter !== 'all') {
                if (userStatusFilter === 'active' || userStatusFilter === 'deactivated') {
                    filteredUsers = filteredUsers.filter(user => user.status === userStatusFilter);
                } else { // Specific role (student, training_manager, administrator)
                    filteredUsers = filteredUsers.filter(user => user.role === userStatusFilter);
                }
            }

            // Apply Company Filter
            if (companyFilter !== 'all') {
                filteredUsers = filteredUsers.filter(user => user.company === companyFilter);
            }

            // Apply Date Range Filter (Enrollment Date)
            if (startDate) {
                filteredUsers = filteredUsers.filter(user => user.enrollmentDate && new Date(user.enrollmentDate) >= new Date(startDate));
            }
            if (endDate) {
                filteredUsers = filteredUsers.filter(user => user.enrollmentDate && new Date(user.enrollmentDate) <= new Date(endDate));
            }

            // Render Report Results
            reportResultsTableBody.innerHTML = ''; // Clear previous results

            let displayedRowCount = 0;

            filteredUsers.forEach(user => {
                let enrolledCoursesNames = [];
                let completedCoursesNames = [];
                let userTotalHours = 0;

                // Process courses for students
                if (user.role === 'student' && user.coursesEnrolled && user.coursesEnrolled.length > 0) {
                    user.coursesEnrolled.forEach(enrollment => {
                        const course = allCoursesData.find(c => c.id === enrollment.courseId);
                        if (course) {
                            // Apply course filter
                            if (courseFilterId === 'all' || enrollment.courseId === parseInt(courseFilterId)) {
                                enrolledCoursesNames.push(course.name);
                                userTotalHours += (enrollment.hoursSpent || 0); // Sum hours spent
                                if (enrollment.completionDate) {
                                    completedCoursesNames.push(course.name);
                                }
                            }
                        }
                    });
                }
                
                // If a specific course is filtered and this user (if student) is not enrolled in it, skip.
                // Or if it's a non-student and a course filter is applied, skip.
                if (courseFilterId !== 'all' && user.role === 'student' && !enrolledCoursesNames.length) {
                    return; // Skip this student if they are not associated with the filtered course
                }
                if (courseFilterId !== 'all' && user.role !== 'student') {
                    return; // Skip non-students if a specific course is filtered
                }

                // Get programmes for this user
                const userProgrammes = allProgramsData.filter(p => 
                    p.assignedStudents && p.assignedStudents.includes(user.id)
                ).map(p => p.name).join(', ') || 'None';

                // Get certificates count
                const userCertificates = allCertificatesData.filter(c => c.studentId === user.id).length;

                // Get badges count
                const userBadges = allBadgesData.filter(b => b.studentId === user.id).length;

                // Get assignments for this user
                const userAssignments = allAssignmentsData.filter(a => a.assignedStudentId === user.id);
                const completedAssignments = userAssignments.filter(a => a.status === 'Submitted' || a.status === 'Read' || a.status === 'Graded').length;
                const assignmentInfo = userAssignments.length > 0 ? `${completedAssignments}/${userAssignments.length}` : 'None';

                // Calculate completion percentage
                let completionPercentage = 'N/A';
                if (user.role === 'student' && enrolledCoursesNames.length > 0) {
                    const percentage = (completedCoursesNames.length / enrolledCoursesNames.length * 100).toFixed(0);
                    completionPercentage = `${percentage}%`;
                }

                // For non-students, courses/hours are N/A
                const displayCourses = user.role === 'student' ? `${enrolledCoursesNames.length} enrolled, ${completedCoursesNames.length} completed` : 'N/A';
                const displayHoursSpent = user.role === 'student' ? userTotalHours : 'N/A';
                const fullName = `${user.name}${user.surname ? ' ' + user.surname : ''}`;

                const newRow = reportResultsTableBody.insertRow();
                newRow.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${fullName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.idNumber}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.company || 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' : 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'}">
                            ${user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.role === 'student' ? userProgrammes : 'N/A'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${displayCourses}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${completionPercentage}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span class="${userCertificates > 0 ? 'text-green-600 font-semibold' : ''}">${userCertificates}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span class="${userBadges > 0 ? 'text-blue-600 font-semibold' : ''}">${userBadges}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${assignmentInfo}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${displayHoursSpent}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.enrollmentDate}</td>
                `;
                displayedRowCount++;
            });

            document.getElementById('reportTotalCount').textContent = displayedRowCount;
            document.getElementById('reportShowingCount').textContent = displayedRowCount > 0 ? 1 : 0;
            document.getElementById('reportTotalCountDisplay').textContent = displayedRowCount;

            if (displayedRowCount === 0) {
                reportResultsTableBody.innerHTML = `
                    <tr>
                        <td colspan="14" class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">No data found matching your criteria.</td>
                    </tr>
                `;
            }

            showMessageModal('Report Generated', `Report for ${displayedRowCount} entries has been generated.`);
        });

        // Messages Section Email Composition Logic
        const emailRecipientSelect = document.getElementById('emailRecipientSelect');
        const emailSubjectInput = document.getElementById('emailSubjectInput');
        const emailBodyTextarea = document.getElementById('emailBodyTextarea');
        const composeEmailForm = document.getElementById('composeEmailForm');

        function populateStudentEmailDropdown() {
            emailRecipientSelect.innerHTML = '<option value="">-- Select type to begin --</option>'; // Clear existing and add default
            const students = allUsersData.filter(user => user.role === 'student' && user.status === 'active'); // Only active students

            if (students.length === 0) {
                // Optionally display a message if no students are available
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "No active students available";
                option.disabled = true;
                emailRecipientSelect.appendChild(option);
            } else {
                students.forEach(student => {
                    const option = document.createElement('option');
                    option.value = student.email;
                    const fullName = `${student.name}${student.surname ? ' ' + student.surname : ''}`;
                    option.textContent = `${fullName} (${student.email})`;
                    emailRecipientSelect.appendChild(option);
                });
            }
        }

        composeEmailForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const recipientEmail = emailRecipientSelect.value;
            const recipientName = emailRecipientSelect.options[emailRecipientSelect.selectedIndex].textContent;
            const subject = emailSubjectInput.value.trim();
            const messageBody = emailBodyTextarea.value.trim();

            if (!recipientEmail) {
                showMessageModal('Input Error', 'Please select a student recipient.');
                return;
            }
            if (!subject) {
                showMessageModal('Input Error', 'Please enter a subject for the email.');
                return;
            }
            if (!messageBody) {
                showMessageModal('Input Error', 'Please write your message before sending.');
                return;
            }

            const student = typeof allUsersData !== 'undefined' ? allUsersData.find(u => u.email === recipientEmail) : null;
            if (student && typeof studentNotifications !== 'undefined') {
                studentNotifications.unshift({
                    id: Date.now(),
                    studentId: student.id,
                    title: 'Message: ' + subject,
                    message: messageBody,
                    type: 'info',
                    timestamp: new Date().toISOString(),
                    read: false
                });
            }

            const confirmationMessage = `To: ${recipientName}
Subject: ${subject}

${messageBody}`;

            showMessageModal('Message Sent to ' + recipientName, 'Subject: ' + subject + '\n\n' + messageBody);

            // Also add the sent message visually to the Inbox list so it reflects there too
            const inboxList = document.getElementById('inboxMessagesList');
            if (inboxList) {
                const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                const inboxItem = document.createElement('div');
                inboxItem.className = 'p-4 hover:bg-gray-50 transition cursor-pointer border-l-4 border-gray-300 bg-gray-50/50';
                inboxItem.setAttribute('onclick', 'readFullMessage(this)');
                inboxItem.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-semibold text-gray-800">You (To: ${recipientName})</h4>
                        <span class="text-xs text-gray-500">${dateStr}</span>
                    </div>
                    <p class="text-sm font-medium text-gray-700 mb-1">${subject}</p>
                    <p class="text-sm text-gray-600 mb-2">${messageBody.substring(0, 100)}${messageBody.length > 100 ? '...' : ''}</p>
                    <span class="inline-block mt-2 px-2 py-1 text-xs bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-600/20 rounded">Sent</span>
                    <div class="hidden-full-content" style="display:none;">${messageBody}</div>
                `;
                inboxList.insertBefore(inboxItem, inboxList.firstChild);
            }

            // Also add the sent message to the Top Envelope Dropdown
            const dropdownList = document.getElementById('dropdownMessagesList');
            if (dropdownList) {
                const dropItem = document.createElement('a');
                dropItem.href = '#';
                dropItem.className = 'block px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition opacity-70'; // opacity-70 because it's already "read/sent"
                const safeSubj = subject.replace(/['"]/g, "\\'");
                const safeBody = ('Subject: ' + subject + '\n\n' + messageBody).replace(/['"]/g, "\\'").replace(/\n/g, "\\n");
                
                const previewText = messageBody.replace(/\n/g, ' ');

                dropItem.setAttribute('onclick', `readDropdownMessage(this); showMessageModal('Message Sent to ${recipientName}', '${safeBody}')`);
                dropItem.innerHTML = `
                    <div class="flex justify-between items-center mb-1">
                        <p class="text-sm font-semibold text-gray-800">You (To: ${recipientName})</p>
                    </div>
                    <p class="text-xs font-medium text-gray-700 truncate">${subject}</p>
                    <p class="text-xs text-gray-500 truncate">${previewText.substring(0, 40)}${previewText.length > 40 ? '...' : ''}</p>
                `;
                dropdownList.insertBefore(dropItem, dropdownList.firstChild);
            }

            // Clear the form after successful submission
            composeEmailForm.reset();

            // Simulate getting a reply message to demonstrate "reflect and update the messages as well and at the top envelope"
            setTimeout(() => {
                const replySubject = "Re: " + subject;
                const replyBody = "Thank you for reaching out.\n\nI have received your message regarding '" + subject + "' and will begin reviewing the materials and guidelines accordingly.\n\nBest regards,\n" + recipientName;
                simulateReceiveMessage(recipientName, replySubject, replyBody);
            }, 3500); // 3.5 second delay to feel natural
        });

        // Event delegation for "Assign Students" buttons in the existing programmes table
        document.addEventListener('click', function(e) {
            const assignBtn = e.target.closest('.assign-students-btn');
            if (assignBtn) {
                e.stopPropagation(); // Prevent row click event
                const programmeId = parseInt(assignBtn.dataset.programmeId);
                showAssignStudentsModal(programmeId);
            }
        });

        // --- FIX: ASSIGNMENT FUNCTIONALITY START ---
        let allAssignmentsData = [];
        
        // Function to get default assignments
        function getDefaultAssignments() {
            return [];
        }

        // Show the create assignment modal
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

        // Hide the create assignment modal
        function hideCreateAssignmentModal() {
            const createAssignmentModal = document.getElementById('createAssignmentModal');
            if (!createAssignmentModal) return;
            createAssignmentModal.classList.remove('show');
            createAssignmentModal.classList.add('hidden');
            clearAssignmentQuestions();
        }

        // Assignment Questions Management
        let assignmentQuestions = [];

        function addAssignmentQuestion() {
            const questionNumber = assignmentQuestions.length + 1;
            const questionId = Date.now() + Math.random();
            
            const question = {
                id: questionId,
                number: questionNumber,
                text: '',
                marks: 0
            };
            
            assignmentQuestions.push(question);
            renderAssignmentQuestions();
        }

        function removeAssignmentQuestion(questionId) {
            assignmentQuestions = assignmentQuestions.filter(q => q.id !== questionId);
            // Renumber questions
            assignmentQuestions.forEach((q, index) => {
                q.number = index + 1;
            });
            renderAssignmentQuestions();
        }

        function updateQuestionText(questionId, text) {
            const question = assignmentQuestions.find(q => q.id === questionId);
            if (question) {
                question.text = text;
            }
        }

        function updateQuestionMarks(questionId, marks) {
            const question = assignmentQuestions.find(q => q.id === questionId);
            if (question) {
                question.marks = parseInt(marks) || 0;
            }
            updateTotalMarksFromQuestions();
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

        function clearAssignmentQuestions() {
            assignmentQuestions = [];
            renderAssignmentQuestions();
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

        // Populate course dropdown for assignment
        
// Function to switch programme sub-tabs
window.switchProgrammeSubTab = function switchProgrammeSubTab(tab, event) {
    if(event) event.preventDefault();
    
    document.getElementById('prog-sub-existing').classList.add('hidden');
    document.getElementById('prog-sub-create').classList.add('hidden');
    
    document.getElementById('tab-prog-existing').className = 'inline-flex items-center justify-center p-4 border-b-2 border-transparent hover:text-gray-600 hover:border-gray-300 rounded-t-lg group text-gray-500';
    document.getElementById('tab-prog-create').className = 'inline-flex items-center justify-center p-4 border-b-2 border-transparent hover:text-gray-600 hover:border-gray-300 rounded-t-lg group text-gray-500';
    
    document.getElementById('prog-sub-' + tab).classList.remove('hidden');
    document.getElementById('tab-prog-' + tab).className = 'inline-flex items-center justify-center p-4 border-b-2 border-indigo-600 text-indigo-600 rounded-t-lg active group';
}

function populateAssignmentCourseSelect() {
            const select = document.getElementById('assignmentCourseSelect');
            select.innerHTML = '<option value="">-- Select type to begin --</option>';
            
            // Get courses created by the logged-in training manager
            const myCourses = allCoursesData.filter(c => c.creatorId === loggedInUser.id);
            
            if (myCourses.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = '-- No courses created yet --';
                option.disabled = true;
                select.appendChild(option);
            } else {
                myCourses.forEach(course => {
                    const option = document.createElement('option');
                    option.value = course.id;
                    const videoCount = course.videos ? course.videos.length : 0;
                    const questionCount = course.questions ? course.questions.length : 0;
                    option.textContent = `${course.name} (${videoCount} videos, ${questionCount} questions)`;
                    select.appendChild(option);
                });
            }
        }

        // Populate student checkboxes list for assignment
        function populateAssignmentStudentsList() {
            const container = document.getElementById('assignmentStudentsList');
            const noStudentsMsg = document.getElementById('noStudentsForAssignment');
            container.innerHTML = '';
            
            const students = allUsersData.filter(u => u.role === 'student' && u.status === 'active');
            
            if (students.length === 0) {
                noStudentsMsg.classList.remove('hidden');
                document.getElementById('noStudentsMatchAssignmentFilter').classList.add('hidden');
            } else {
                noStudentsMsg.classList.add('hidden');
                students.forEach(student => {
                    const fullName = `${student.name}${student.surname ? ' ' + student.surname : ''}`;
                    const checkboxDiv = document.createElement('div');
                    checkboxDiv.classList.add('flex', 'items-center', 'py-1', 'px-2', 'hover:bg-gray-100', 'rounded', 'assignment-student-item');
                    checkboxDiv.dataset.studentName = fullName.toLowerCase();
                    checkboxDiv.dataset.studentEmail = student.email.toLowerCase();
                    checkboxDiv.innerHTML = `
                        <input type="checkbox" id="assignmentStudent_${student.id}" value="${student.id}" class="assignment-student-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" onchange="updateAssignmentSelectedCount()">
                        <label for="assignmentStudent_${student.id}" class="ml-2 flex-1 cursor-pointer">
                            <div class="text-sm font-medium text-gray-700">${fullName}</div>
                            <div class="text-xs text-gray-500">${student.email}</div>
                        </label>
                    `;
                    container.appendChild(checkboxDiv);
                });
            }
        }

        // Update selected students count
        function updateAssignmentSelectedCount() {
            const checkedBoxes = document.querySelectorAll('.assignment-student-checkbox:checked');
            const visibleChecked = Array.from(checkedBoxes).filter(cb => 
                cb.closest('.assignment-student-item').style.display !== 'none'
            );
            document.getElementById('selectedAssignmentStudentsCount').textContent = `${visibleChecked.length} students selected`;
        }

        // Select all visible students
        function selectAllAssignmentStudents() {
            const visibleCheckboxes = Array.from(document.querySelectorAll('.assignment-student-checkbox')).filter(cb => 
                cb.closest('.assignment-student-item').style.display !== 'none'
            );
            visibleCheckboxes.forEach(checkbox => checkbox.checked = true);
            updateAssignmentSelectedCount();
        }

        // Deselect all visible students
        function deselectAllAssignmentStudents() {
            const visibleCheckboxes = Array.from(document.querySelectorAll('.assignment-student-checkbox')).filter(cb => 
                cb.closest('.assignment-student-item').style.display !== 'none'
            );
            visibleCheckboxes.forEach(checkbox => checkbox.checked = false);
            updateAssignmentSelectedCount();
        }

        // Filter students list
        function filterAssignmentStudentsList() {
            const searchTerm = document.getElementById('assignmentStudentSearch').value.toLowerCase();
            const studentItems = document.querySelectorAll('.assignment-student-item');
            const noMatchMsg = document.getElementById('noStudentsMatchAssignmentFilter');
            let visibleCount = 0;

            studentItems.forEach(item => {
                const name = item.dataset.studentName;
                const email = item.dataset.studentEmail;
                
                if (name.includes(searchTerm) || email.includes(searchTerm)) {
                    item.style.display = '';
                    visibleCount++;
                } else {
                    item.style.display = 'none';
                }
            });

            // Show/hide no match message
            if (visibleCount === 0 && studentItems.length > 0) {
                noMatchMsg.classList.remove('hidden');
            } else {
                noMatchMsg.classList.add('hidden');
            }

            updateAssignmentSelectedCount();
        }

        // Initialize all assignment-related event listeners
        function initializeAssignmentEventListeners() {
            // Listener for the main "Create Assignment" button
            const createAssignmentBtn = document.getElementById('createAssignmentBtn');
            if (createAssignmentBtn) {
                createAssignmentBtn.addEventListener('click', showCreateAssignmentModal);
            }

            // Show selected document names
            const assignmentDocumentInput = document.getElementById('assignmentDocumentInput');
            const assignmentDocFilesList = document.getElementById('assignmentDocFilesList');
            if (assignmentDocumentInput) {
                assignmentDocumentInput.addEventListener('change', function() {
                    assignmentDocFilesList.innerHTML = '';
                    if(this.files.length > 0) {
                        Array.from(this.files).forEach(file => {
                            const fileSize = (file.size / 1024).toFixed(2); // KB
                            const fileExt = file.name.split('.').pop().toUpperCase();
                            let icon = 'la-file';
                            if (fileExt === 'PDF') icon = 'la-file-pdf';
                            else if (fileExt === 'PPT' || fileExt === 'PPTX') icon = 'la-file-powerpoint';
                            else if (fileExt === 'DOC' || fileExt === 'DOCX') icon = 'la-file-word';
                            
                            const fileItem = document.createElement('p');
                            fileItem.className = 'text-xs text-green-600 font-medium flex items-center';
                            fileItem.innerHTML = `<i class="fas ${icon} mr-1 text-indigo-600"></i><strong>${file.name}</strong> (${fileSize} KB)`;
                            assignmentDocFilesList.appendChild(fileItem);
                        });
                    }
                });
            }

            // Handle assignment type change
            const assignmentTypeSelect = document.getElementById('assignmentTypeSelect');
            if (assignmentTypeSelect) {
                assignmentTypeSelect.addEventListener('change', function() {
                    const marksContainer = document.getElementById('assignmentMarksContainer');
                    const marksInput = document.getElementById('assignmentMarksInput');
                    if (this.value === 'mark-as-read') {
                        marksInput.value = 0;
                        marksInput.disabled = true;
                        marksContainer.querySelector('p').textContent = 'Mark as Read assignments have no marks';
                    } else {
                        marksInput.disabled = false;
                        marksContainer.querySelector('p').textContent = 'Leave 0 for Mark as Read assignments';
                    }
                });
            }

            // Handle the creation of a new assignment
            const createAssignmentForm = document.getElementById('createAssignmentForm');
            if (createAssignmentForm) {
                createAssignmentForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    const assignmentDocumentInput = document.getElementById('assignmentDocumentInput');
                    const assignmentType = document.getElementById('assignmentTypeSelect').value;
                    const courseId = document.getElementById('assignmentCourseSelect').value;
                    const selectedCheckboxes = Array.from(document.querySelectorAll('.assignment-student-checkbox:checked'));
                    const studentIds = selectedCheckboxes.map(cb => parseInt(cb.value, 10));
                    const title = document.getElementById('assignmentTitleInput').value.trim();
                    const instructions = document.getElementById('assignmentInstructionsTextarea').value.trim();
                    const dueDate = document.getElementById('assignmentDueDateInput').value;
                    const totalMarks = parseInt(document.getElementById('assignmentMarksInput').value, 10) || 0;
                    const documentFiles = assignmentDocumentInput.files;

                    // Validation
                    if (studentIds.length === 0) {
                        showMessageModal('Selection Required ?', 'Please select at least one student to assign this assignment to.');
                        return;
                    }

                    if (!title || !instructions || !dueDate) {
                        showMessageModal('Input Error ?', 'Please fill all required fields:\n? Assignment Title\n? Instructions\n? Due Date');
                        return;
                    }

                    if (!documentFiles || documentFiles.length === 0) {
                        showMessageModal('Document Required ?', 'Please upload at least one document (PDF, PPT, or Word file) for this assignment.');
                        return;
                    }

                    // Validate questions if added
                    if (assignmentQuestions.length > 0) {
                        const invalidQuestion = assignmentQuestions.find(q => !q.text.trim());
                        if (invalidQuestion) {
                            showMessageModal('Question Error ?', `Question ${invalidQuestion.number} is empty. Please enter question text or remove it.`);
                            return;
                        }
                        
                        const totalQuestionMarks = assignmentQuestions.reduce((sum, q) => sum + q.marks, 0);
                        if (totalQuestionMarks !== totalMarks && totalMarks > 0) {
                            showMessageModal('Marks Mismatch ?', `Total question marks (${totalQuestionMarks}) must equal assignment total marks (${totalMarks}).`);
                            return;
                        }
                    }

                    // Get course name if linked
                    let courseName = null;
                    if (courseId) {
                        const course = allCoursesData.find(c => c.id === parseInt(courseId));
                        courseName = course ? course.name : null;
                    }

                    // Create documents array from uploaded files
                    const documents = Array.from(documentFiles).map(file => ({
                        fileName: file.name,
                        fileUrl: URL.createObjectURL(file),
                        fileType: file.name.split('.').pop().toUpperCase(),
                        fileSize: (file.size / 1024).toFixed(2) + ' KB'
                    }));

                    // Create assignment for each selected student
                    let createdCount = 0;
                    const assignedStudentNames = [];
                    studentIds.forEach(studentId => {
                        const student = allUsersData.find(u => u.id === studentId);
                        if (student) {
                            assignedStudentNames.push(`${student.name}${student.surname ? ' ' + student.surname : ''}`);
                        }
                        
                        const newAssignment = {
                            id: Date.now() + studentId + Math.floor(Math.random() * 1000),
                            type: assignmentType,
                            title,
                            instructions,
                            dueDate,
                            courseId: courseId ? parseInt(courseId) : null,
                            courseName: courseName,
                            documents: documents,
                            totalMarks,
                            questions: assignmentQuestions.map(q => ({...q})), // Save questions
                            assignedStudentId: studentId,
                            creatorId: loggedInUser.id,
                            status: assignmentType === 'mark-as-read' ? 'Pending Read' : 'Assigned',
                            submissionDate: null,
                            markedAsRead: false,
                            readDate: null,
                            score: null,
                            feedback: null,
                            creationDate: new Date().toISOString().slice(0, 10)
                        };
                          allAssignmentsData.push(newAssignment);
                          
                          // Create notification for student
                          if (typeof studentNotifications !== 'undefined') {
                              studentNotifications.unshift({
                                  id: Date.now() + Math.random(),
                                  studentId: studentId,
                                  title: 'New Assignment: ' + title,
                                  message: 'You have been assigned a new task: "' + title + '". Please check your My Grades tab.',
                                  type: 'info',
                                  timestamp: new Date().toISOString(),
                                  read: false
                              });
                          }
                          
                          createdCount++;
                    });
                    
                    saveToLocalStorage(); // Save to localStorage
                    renderTMAssignmentsTable();
                    
                    // Build detailed success message
                    const courseInfo = courseName ? ` linked to course "${courseName}"` : '';
                    const studentList = assignedStudentNames.length <= 3 
                        ? assignedStudentNames.join(', ')
                        : `${assignedStudentNames.slice(0, 3).join(', ')} and ${assignedStudentNames.length - 3} more`;
                    const typeInfo = assignmentType === 'mark-as-read' ? '(Mark as Read)' : `(${totalMarks} marks)`;
                    const questionsInfo = assignmentQuestions.length > 0 ? `\n? Questions: ${assignmentQuestions.length}` : '';
                    const documentsInfo = documents.length > 1 ? `\n<i class="las la-trophy text-yellow-500 text-2xl"></i> Documents: ${documents.length} files` : `\n<i class="las la-trophy text-yellow-500 text-2xl"></i> Document: ${documents[0].fileName}`;
                    
                    showMessageModal('Assignment Created Successfully! ?', 
                        `Assignment "${title}" ${typeInfo}${courseInfo} has been created and assigned to:\n\n<i class="las la-trophy text-yellow-500 text-2xl"></i> ${studentList}\n\n<i class="las la-trophy text-yellow-500 text-2xl"></i> Due Date: ${new Date(dueDate).toLocaleDateString()}${documentsInfo}${questionsInfo}`);
                    hideCreateAssignmentModal();
                });
            }

            // Event delegation for student's "View" buttons
            const studentAssignmentsList = document.getElementById('studentAssignmentsList');
            if (studentAssignmentsList) {
                studentAssignmentsList.addEventListener('click', function(e) {
                    if(e.target.classList.contains('view-assignment-btn')) {
                        const assignmentId = e.target.dataset.assignmentId;
                        showViewAssignmentModal(assignmentId);
                    }
                });
            }

            // Handle file upload display
            const assignmentSubmissionFiles = document.getElementById('assignmentSubmissionFiles');
            if (assignmentSubmissionFiles) {
                assignmentSubmissionFiles.addEventListener('change', function() {
                    const filesList = document.getElementById('submissionFilesList');
                    filesList.innerHTML = '';
                    if (this.files.length > 0) {
                        Array.from(this.files).forEach((file, index) => {
                            const fileItem = document.createElement('div');
                            fileItem.className = 'flex items-center gap-2 text-xs text-gray-700 bg-white p-2 rounded border border-gray-300';
                            fileItem.innerHTML = `
                                <i class="las la-file text-indigo-600"></i>
                                <span class="flex-1">${file.name}</span>
                                <span class="text-gray-500">${(file.size / 1024).toFixed(2)} KB</span>
                            `;
                            filesList.appendChild(fileItem);
                        });
                    }
                });
            }

            // Handle student's submission click
            const submitAssignmentBtn = document.getElementById('submitAssignmentBtn');
            if (submitAssignmentBtn) {
                submitAssignmentBtn.addEventListener('click', function() {
                    const assignmentId = this.dataset.assignmentId;
                    const assignment = allAssignmentsData.find(a => String(a.id) === String(assignmentId));
                    if (assignment) {
                        if (assignment.type === 'mark-as-read') {
                            // Mark as Read confirmation
                            assignment.markedAsRead = true;
                            assignment.readDate = new Date().toISOString().slice(0, 10);
                            assignment.status = 'Read';
                            saveToLocalStorage();
                            showMessageModal('Confirmed', `You have confirmed reading: "${assignment.title}". This has been recorded.`);
                        } else {
                            // Regular assignment submission
                            const fileInput = document.getElementById('assignmentSubmissionFiles');
                            if (!fileInput.files || fileInput.files.length === 0) {
                                showMessageModal('Files Required', 'Please upload at least one file for your submission.');
                                return;
                            }
                            
                            // Store submission files
                            assignment.submissionFiles = Array.from(fileInput.files).map(file => ({
                                fileName: file.name,
                                fileUrl: URL.createObjectURL(file),
                                fileType: file.name.split('.').pop().toUpperCase(),
                                fileSize: (file.size / 1024).toFixed(2) + ' KB'
                            }));
                            
                            assignment.status = 'Submitted';
                            assignment.submissionDate = new Date().toISOString().slice(0, 10);
                            saveToLocalStorage();
                            showMessageModal('Submitted', `Assignment "${assignment.title}" has been successfully submitted with ${assignment.submissionFiles.length} file(s).`);
                        }
                        hideViewAssignmentModal();
                        renderStudentAssignmentsList();
                        if (typeof renderTMAssignmentsTable === 'function') renderTMAssignmentsTable();
                    }
                });
            }

            // Handle training manager's grading
            const gradeAssignmentBtn = document.getElementById('gradeAssignmentBtn');
            if (gradeAssignmentBtn) {
                gradeAssignmentBtn.addEventListener('click', function() {
                    const assignmentId = this.dataset.assignmentId;
                    const assignment = allAssignmentsData.find(a => String(a.id) === String(assignmentId));
                    if (assignment) {
                        const score = parseFloat(document.getElementById('assignmentScoreInput').value);
                        const status = document.getElementById('assignmentGradeStatus').value;
                        const feedback = document.getElementById('assignmentFeedback').value;

                        if (isNaN(score) || score < 0) {
                            showMessageModal('Invalid Score', 'Please enter a valid score.');
                            return;
                        }

                        if (score > assignment.totalMarks) {
                            showMessageModal('Score Too High', `Score cannot exceed total marks (${assignment.totalMarks}).`);
                            return;
                        }

                        assignment.score = score;
                        assignment.status = status;
                        assignment.feedback = feedback;
                        assignment.gradedDate = new Date().toISOString().slice(0, 10);
                        assignment.gradedBy = loggedInUser.id;

                        saveToLocalStorage();
                        showMessageModal('Graded', `Assignment "${assignment.title}" has been graded successfully.`);
                        hideViewAssignmentModal();
                        if (typeof renderTMAssignmentsTable === 'function') renderTMAssignmentsTable();
                    }
                });
            }
        }

        // Render student certificates table
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

        // Render admin all certificates table
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

        // Render certificate templates for training manager
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

        // Handle certificate template creation
        document.getElementById('createCertificateTemplateForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('certTemplateName').value.trim();
            const description = document.getElementById('certTemplateDesc').value.trim();
            const colorScheme = document.getElementById('certTemplateColor').value;
            const linkedCourseIds = Array.from(document.querySelectorAll('.cert-template-course-checkbox:checked'))
                                      .map(cb => parseInt(cb.value));

            if (!name || !description) {
                showMessageModal('Input Error', 'Please fill in template name and description.');
                return;
            }

            const newTemplate = {
                id: Date.now(),
                name,
                description,
                colorScheme,
                linkedCourseIds,
                creatorId: loggedInUser.id,
                creationDate: new Date().toISOString().slice(0, 10)
            };

            allCertificateTemplatesData.push(newTemplate);
            showMessageModal('Success', `Certificate template "${name}" has been created.`);
            this.reset();
            renderCertificateTemplatesTable();
        });

        function resetCertTemplateForm() {
            document.getElementById('createCertificateTemplateForm').reset();
        }

        // Populate courses for certificate template creation
        function populateCertificateTemplateCoursesSelection() {
            const container = document.getElementById('certTemplateCoursesSelection');
            const activeCoursesForTM = allCoursesData.filter(c => c.creatorId === loggedInUser.id);
            
            if (activeCoursesForTM.length === 0) {
                container.innerHTML = '<p id="noCertCourses" class="text-gray-500 text-sm text-center">No courses available. Create courses first.</p>';
                return;
            }

            container.innerHTML = '';
            activeCoursesForTM.forEach(course => {
                const label = document.createElement('label');
                label.className = 'flex items-center py-2 px-2 hover:bg-gray-100 rounded cursor-pointer';
                label.innerHTML = `
                    <input type="checkbox" value="${course.id}" class="cert-template-course-checkbox mr-2">
                    <span class="text-sm text-gray-700">${course.name}</span>
                `;
                container.appendChild(label);
            });
        }

        // Update tables when sections are shown
        document.addEventListener('click', function(e) {
            if (e.target.getAttribute('data-section') === 'my-certificates') {
                renderStudentCertificatesTable();
            } else if (e.target.getAttribute('data-section') === 'certificate-templates') {
                populateCertificateTemplateCoursesSelection();
                renderCertificateTemplatesTable();
            } else if (e.target.getAttribute('data-section') === 'certificates-management') {
                renderAllCertificatesTable();
            }
        });

        /* ================= STUDENT COURSE PROGRESS (UI ENHANCED) ================= */

        const studentCourses = [];

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
                <div class="bg-indigo-600 h-1.5 rounded-full" style="width: ${getCourseProgressPercentage(course.id)}%"></div>
              </div>
              <p class="text-xs text-gray-600 mb-2 text-center">Progress: <span class="font-medium">${getCourseProgressPercentage(course.id)}%</span></p>`
            : `<p class="text-xs text-gray-600 mb-2 text-center">Completed on ${new Date(course.completionDate).toLocaleDateString()}</p>`
          }
        </div>
      </div>
    `;
    container.innerHTML += courseCard;
  });
}

// Function to display student's assigned programmes
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

// Function to view programme details
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

function closeProgrammeDetailsModal() {
    const modal = document.getElementById('programmeDetailsModal');
    if (modal) {
        modal.remove();
    }
}

                        documents: [
                            {
                                id: 4005,
                                title: 'First Aid Procedures',
                                type: 'ppt',
                                fileName: 'first_aid_procedures.ppt',
                                description: 'PowerPoint covering emergency response protocols and first aid techniques.',
                                icon: 'las la-file-powerpoint',
                                color: 'orange',
                                isRead: false,
                                createdDate: '2024-01-12',
                                fileSize: '3.7 MB'
                            },
                            {
                                id: 4006,
                                title: 'Medical Emergency Guidelines',
                                type: 'pdf',
                                fileName: 'medical_emergency_guidelines.pdf',
                                description: 'PDF with detailed medical emergency guidelines and response procedures.',
                                icon: 'las la-file-pdf',
                                color: 'red',
                                isRead: false,
                                createdDate: '2024-01-12',
                                fileSize: '2.2 MB'
                            }
                        ]
                        documents: [
                            {
                                id: 4001,
                                title: 'Health & Safety Overview',
                                type: 'ppt',
                                fileName: 'health_safety_overview.ppt',
                                description: 'PowerPoint presentation on workplace health and safety fundamentals.',
                                icon: 'las la-file-powerpoint',
                                color: 'orange',
                                isRead: false,
                                createdDate: '2024-01-05',
                                fileSize: '2.8 MB'
                            },
                            {
                                id: 4002,
                                title: 'Safety Rules & Compliance',
                                type: 'pdf',
                                fileName: 'safety_rules.pdf',
                                description: 'Complete PDF document with all safety rules and compliance requirements.',
                                icon: 'las la-file-pdf',
                                color: 'red',
                                isRead: false,
                                createdDate: '2024-01-05',
                                fileSize: '1.6 MB'
                            }
                        ]
// Function to view student course with sections, video and questions
window.viewStudentCourse = function viewStudentCourse(courseId, courseName) {
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
                 isFile: video.isFile || false,
                 fileName: video.fileName || null,
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
    document.getElementById('courseViewerProgress').textContent = getCourseProgressPercentage(courseId);

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
    if (hasVideos && course.sections) {
        sectionsWrap.classList.remove('hidden');
        sectionsContainer.innerHTML = course.sections.map((s, idx) => `
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

    // --- Dynamic Course Progress Tracking ---
    if (window.currentViewingCourseId) {
        let itemId = activeId.replace('sidebar-', ''); // 'sec-1', 'doc-2', 'ast-3'
        markItemComplete(itemId, window.currentViewingCourseId);
    }
}

// Function to calculate course progress dynamically
function getCourseProgressPercentage(courseId) {
    if (typeof loggedInUser === 'undefined' || !loggedInUser) return 0;
    
    const progressData = JSON.parse(localStorage.getItem('studentCourseProgress') || '{}');
    if (!progressData[loggedInUser.id] || !progressData[loggedInUser.id][courseId]) {
        return 0;
    }
    const completedItems = progressData[loggedInUser.id][courseId].completedItems || [];
    
    let course = allCoursesData.find(c => c.id === courseId);
    if (!course) course = (typeof studentCourses !== 'undefined') ? studentCourses.find(c => c.id === courseId) : null;
    if (!course) return 0;

    let itemsCount = 0;
    
    // Calculate total trackable items
    let tempCourse = { ...course };
    if ((!tempCourse.sections || tempCourse.sections.length === 0) && ((tempCourse.videos && tempCourse.videos.length > 0) || (tempCourse.questions && tempCourse.questions.length > 0))) {
        if (tempCourse.videos && tempCourse.videos.length > 0) {
            itemsCount += tempCourse.videos.length;
        } else {
            itemsCount += 1;
        }
    } else if (tempCourse.sections) {
        itemsCount += tempCourse.sections.length;
    }
    if (tempCourse.documents) itemsCount += tempCourse.documents.length;
    if (tempCourse.assignments) itemsCount += tempCourse.assignments.length;

    if (itemsCount === 0) return 0;
    let prog = Math.floor((completedItems.length / itemsCount) * 100);
    return Math.min(prog, 100);
}

function markItemComplete(itemId, courseId) {
    if (typeof loggedInUser === 'undefined' || !loggedInUser || loggedInUser.role !== 'student') return;
    
    let progressData = JSON.parse(localStorage.getItem('studentCourseProgress') || '{}');
    if (!progressData[loggedInUser.id]) progressData[loggedInUser.id] = {};
    if (!progressData[loggedInUser.id][courseId]) progressData[loggedInUser.id][courseId] = { completedItems: [], progress: 0 };
    
    const strId = String(itemId);
    if (!progressData[loggedInUser.id][courseId].completedItems.includes(strId)) {
        progressData[loggedInUser.id][courseId].completedItems.push(strId);
        localStorage.setItem('studentCourseProgress', JSON.stringify(progressData));
        
        let prog = getCourseProgressPercentage(courseId);
        
        // Check if fully complete and mark overall course
        if (prog >= 100) {
            let userIdx = allUsersData.findIndex(u => u.id === loggedInUser.id);
            if(userIdx !== -1 && allUsersData[userIdx].coursesEnrolled) {
                 let enrIdx = allUsersData[userIdx].coursesEnrolled.findIndex(e => e.courseId === courseId);
                 if(enrIdx !== -1 && !allUsersData[userIdx].coursesEnrolled[enrIdx].completionDate) {
                      allUsersData[userIdx].coursesEnrolled[enrIdx].completionDate = new Date().toISOString();
                      saveToLocalStorage();
                      if (typeof updateDashboardStats === 'function') updateDashboardStats();
                 }
            }
        }

        // Update viewer UI
        const courseViewerProgress = document.getElementById('courseViewerProgress');
        if (courseViewerProgress && window.currentViewingCourseId === courseId) {
            courseViewerProgress.textContent = prog;
            
            // visually update the progress bar in the background dashboard
            if (typeof showStudentCourses === 'function') {
                 // Refresh if we were looking at "inprogress"
                 const tabInProgress = document.getElementById("tabInProgress");
                 if(tabInProgress && tabInProgress.classList.contains("bg-indigo-600")) {
                     setTimeout(() => showStudentCourses('inprogress'), 50);
                 }
            }
        }
    }
}

function switchCourseMainView(viewName) {
    document.getElementById('videosContent').classList.add('hidden');
    document.getElementById('documentMainContent').classList.add('hidden');
    document.getElementById('assignmentMainContent').classList.add('hidden');
    document.getElementById(viewName).classList.remove('hidden');
}

// Function to load a specific section
function loadSection(sectionId, courseId) {
    updateSidebarActiveItem('sidebar-sec-' + sectionId);
    switchCourseMainView('videosContent');

    let course = allCoursesData.find(c => c.id === courseId) || studentCourses.find(c => c.id === courseId);
    if (!course || !course.sections) return;

    const section = course.sections.find(s => s.id === sectionId);
    if (!section) return;

    document.getElementById('sectionTitle').textContent = section.title;
    document.getElementById('courseVideoDuration').textContent = section.videoDuration || 'N/A';

    const videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer) {
        if (section.videoUrl) {
            let embedUrl = section.videoUrl;
            let isYouTube = false;
            if (embedUrl.includes('youtube.com/watch?v=')) {
                isYouTube = true;
                let videoId = embedUrl.split('v=')[1];
                let ampersandPosition = videoId.indexOf('&');
                if (ampersandPosition !== -1) videoId = videoId.substring(0, ampersandPosition);
                embedUrl = 'https://www.youtube.com/embed/' + videoId;
            } else if (embedUrl.includes('youtu.be/')) {
                isYouTube = true;
                let videoId = embedUrl.split('youtu.be/')[1];
                let questionMarkPosition = videoId.indexOf('?');
                if (questionMarkPosition !== -1) videoId = videoId.substring(0, questionMarkPosition);
                embedUrl = 'https://www.youtube.com/embed/' + videoId;
            } else if (embedUrl.includes('vimeo.com/')) {
                isYouTube = true;
                let videoId = embedUrl.split('vimeo.com/')[1];
                embedUrl = 'https://player.vimeo.com/video/' + videoId;
            }
            
            if (isYouTube) {
                videoPlayer.innerHTML = `<iframe class="w-full h-full" style="min-height: 24rem;" src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            } else {
                videoPlayer.innerHTML = `<video class="w-full h-full" style="min-height: 24rem; background: #000;" src="${embedUrl}" controls title="Video Player"></video>`;
            }
        } else if (section.isFile) {
            videoPlayer.innerHTML = `
                <div class="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
                    <i class="las la-file-video text-6xl text-blue-400 mb-4"></i>
                    <h3 class="text-xl font-semibold text-white mb-2">Simulated Local Video</h3>
                    <p class="text-gray-300 mb-4">File: <span class="font-mono text-sm bg-gray-700 px-2 py-1 rounded border border-gray-600">${section.fileName || 'Local file'}</span></p>
                    <p class="text-sm text-gray-400 max-w-sm">For security reasons, web browsers cannot automatically play local machine files. In a production environment, this video will stream via cloud storage.</p>
                </div>
            `;
        } else {
            videoPlayer.innerHTML = `
                <div class="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center">
                    <i class="las la-play-circle text-6xl text-white mb-4 transition"></i>
                    <p class="text-white text-lg">No Video available</p>
                </div>
            `;
        }
    }

    loadSectionQuestions(section.questions);
    window.currentSection = section;
}

function loadDocumentView(docId, courseId) {
    updateSidebarActiveItem('sidebar-doc-' + docId);
    switchCourseMainView('documentMainContent');

    let course = allCoursesData.find(c => c.id === courseId) || studentCourses.find(c => c.id === courseId);
    if (!course || !course.documents) return;

    const doc = course.documents.find(d => d.id === docId);
    if (!doc) return;

    document.getElementById('docViewerTitle').textContent = doc.title;
    document.getElementById('docViewerDesc').textContent = doc.description || 'Click below to view or download this document.';
    
    const icon = document.getElementById('docViewerIcon');
    icon.className = doc.type === 'pdf' ? 'las la-file-pdf text-6xl text-red-500 mb-4 inline-block' : 'las la-file-powerpoint text-6xl text-orange-500 mb-4 inline-block';

    const btn = document.getElementById('openDocumentBtn');
    btn.onclick = () => viewDocument(courseId, docId);
}

function loadAssignmentView(assignmentId, courseId) {
    updateSidebarActiveItem('sidebar-ast-' + assignmentId);
    switchCourseMainView('assignmentMainContent');

    const assignment = allAssignmentsData.find(a => String(a.id) === String(assignmentId));
    if (!assignment) return;

    document.getElementById('assignmentTitleViewer').textContent = assignment.title;
    document.getElementById('assignmentDescViewer').textContent = assignment.description || 'Complete the assignment by following the instructions provided in the details.';

    const btn = document.getElementById('openAssignmentBtn');
    btn.onclick = () => {
        closeCourseViewer();
        if(typeof showViewAssignmentModal === 'function') {
            showViewAssignmentModal(assignmentId);
        } else {
            showMessageModal('Assignment', 'Assignment viewer is not available.');
        }
    };
}

// Function to load and display section questions
function loadSectionQuestions(questions) {
    const questionsContainer = document.getElementById('courseQuestionsContainer');
    questionsContainer.innerHTML = '';
    const sectionWrap = document.getElementById('questionsSectionContainer');

    if (!questions || questions.length === 0) {
        if (sectionWrap) sectionWrap.classList.add('hidden');
        return;
    }
    
    if (sectionWrap) sectionWrap.classList.remove('hidden');

    questions.forEach((q, index) => {
        const qText = q.text || q.question || (q.type === 'long-answer' ? 'Long Question' : q.type === 'true-false' ? 'True/False' : q.type === 'multiple-choice' ? 'Multiple Choice' : q.type === 'matching' ? 'Matching' : q.type === 'fill-in-blank' ? 'Fill in the Blank' : q.type === 'ordering' ? 'Ordering' : 'Assessment Question');
        let questionHtml = '';
        if (q.type === 'multiple-choice') {
            questionHtml = `
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div class="flex items-start mb-3">
                        <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white text-sm font-medium mr-3 shrink-0">
                            ${index + 1}
                        </span>
                        <h4 class="text-lg font-semibold text-gray-800">${qText}</h4>
                    </div>
                    <div class="space-y-2 ml-11">
                        ${q.options.map((option, optIndex) => `
                            <label class="flex items-center p-2 rounded hover:bg-gray-100 cursor-pointer transition">
                                <input type="checkbox" name="question-${q.id}" value="${optIndex}" class="w-4 h-4 text-indigo-600 rounded">
                                <span class="ml-3 text-gray-700">${option}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (q.type === 'true-false') {
            questionHtml = `
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div class="flex items-start mb-3">
                        <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white text-sm font-medium mr-3 shrink-0">
                            ${index + 1}
                        </span>
                        <h4 class="text-lg font-semibold text-gray-800">${qText}</h4>
                    </div>
                    <div class="space-y-2 ml-11">
                        <label class="flex items-center p-2 rounded hover:bg-gray-100 cursor-pointer transition">
                            <input type="checkbox" name="question-${q.id}" value="true" class="w-4 h-4 text-indigo-600 rounded" onchange="if(this.checked) { document.querySelectorAll('input[name=\'question-${q.id}\']').forEach(cb => { if(cb !== this) cb.checked = false; }) }">
                            <span class="ml-3 text-gray-700">True</span>
                        </label>
                        <label class="flex items-center p-2 rounded hover:bg-gray-100 cursor-pointer transition">
                            <input type="checkbox" name="question-${q.id}" value="false" class="w-4 h-4 text-indigo-600 rounded" onchange="if(this.checked) { document.querySelectorAll('input[name=\'question-${q.id}\']').forEach(cb => { if(cb !== this) cb.checked = false; }) }">
                            <span class="ml-3 text-gray-700">False</span>
                        </label>
                    </div>
                </div>
            `;
        } else if (q.type === 'matching') {
            const definitions = [...(q.pairs || [])].map(p => p.definition).sort(() => Math.random() - 0.5);
            questionHtml = `
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">  
                    <div class="flex items-start mb-3">
                        <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white text-sm font-medium mr-3 shrink-0">  
                            ${index + 1}
                        </span>
                        <h4 class="text-lg font-semibold text-gray-800">${qText}</h4>
                    </div>
                    <div class="space-y-4 ml-11">
                        ${(q.pairs || []).map((pair, pIndex) => `
                            <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <div class="font-medium text-gray-700 sm:w-1/2 p-2 bg-white rounded border border-gray-100 shadow-sm">${pair.term}</div>
                                <select name="question-${q.id}-pair-${pIndex}" class="sm:w-1/2 p-2 border border-gray-300 rounded-md text-sm cursor-pointer hover:border-indigo-400 focus:border-indigo-500 min-w-0 flex-1">
                                    <option value="">Select matching definition...</option>
                                    ${definitions.map(def => `<option value="${def.replace(/"/g, '&quot;')}">${def}</option>`).join('')}
                                </select>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (q.type === 'fill-in-blank') {
            questionHtml = `
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">  
                    <div class="flex items-start mb-3">
                        <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white text-sm font-medium mr-3 shrink-0">  
                            ${index + 1}
                        </span>
                        <h4 class="text-lg font-semibold text-gray-800">${qText}</h4>
                    </div>
                    <div class="space-y-3 ml-11 mt-3">
                        ${(q.answers || []).map((_, aIndex) => `
                            <div class="flex items-center gap-3 w-full max-w-md">
                                <span class="text-gray-500 font-medium whitespace-nowrap">Blank ${aIndex + 1}:</span>
                                <input type="text" name="question-${q.id}-answer-${aIndex}" class="flex-1 p-2 border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" placeholder="Type answer...">
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (q.type === 'ordering') {
            const items = [...(q.correctOrder || [])].sort(() => Math.random() - 0.5);
            questionHtml = `
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div class="flex items-start mb-3">
                        <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white text-sm font-medium mr-3 shrink-0">
                            ${index + 1}
                        </span>
                        <div class="flex flex-col w-full">
                            <h4 class="text-lg font-semibold text-gray-800">${qText}</h4>
                            <span class="text-sm text-gray-500 mt-1">Drag and drop the items to arrange them in the correct order.</span>
                        </div>
                    </div>
                    <div class="space-y-2 ml-11 mt-3 sortable-list" id="sortable-${q.id}" data-type="ordering" data-question-id="${q.id}">
                        ${items.map((item) => `
                            <div class="flex items-center gap-3 p-3 bg-white rounded border border-gray-200 shadow-sm cursor-grab hover:bg-gray-50 transition-colors drag-item" draggable="true" data-item="${item.replace(/"/g, '&quot;')}">
                                <i class="las la-grip-vertical text-gray-400 text-lg"></i>
                                <span class="text-gray-700 font-medium select-none pointer-events-none">${item}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }else if (q.type === 'long-answer') {
            questionHtml = `
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">  
                    <div class="flex items-start mb-3">
                        <span class="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-600 text-white text-sm font-medium mr-3 shrink-0">  
                            ${index + 1}
                        </span>
                        <h4 class="text-lg font-semibold text-gray-800">${qText}</h4>
                    </div>
                    <div class="mt-3 ml-11">
                        <textarea name="question-${q.id}" rows="4" class="w-full p-3 border border-gray-300 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" placeholder="Type your full answer here..."></textarea>
                    </div>
                </div>
            `;
        }
        questionsContainer.innerHTML += questionHtml;
    });

    window.currentSectionQuestions = questions;
    initDragAndDrop();
}

// Function to initialize drag and drop for ordering questions
function initDragAndDrop() {
    const draggables = document.querySelectorAll('.drag-item');
    const sortableLists = document.querySelectorAll('.sortable-list');

    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', () => {
            draggable.classList.add('opacity-50');
            draggable.classList.add('dragging');
        });

        draggable.addEventListener('dragend', () => {
            draggable.classList.remove('opacity-50');
            draggable.classList.remove('dragging');
        });
    });

    sortableLists.forEach(list => {
        list.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(list, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                if (afterElement == null) {
                    list.appendChild(draggable);
                } else {
                    list.insertBefore(draggable, afterElement);
                }
            }
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Function to close course viewer
function closeCourseViewer() {
    document.getElementById('courseViewerModal').classList.add('hidden');
    document.getElementById('courseViewerModal').classList.remove('show');
    
    const vp = document.getElementById('videoPlayer');
    if(vp) {
        vp.innerHTML = ''; // Stop video from playing when closed
    }
}

// Function to switch between Create Course and My Created Courses tabs
function switchMyCourseTab(tabName) {
    const createTab = document.getElementById('createCourseTab');
    const myCoursesTab = document.getElementById('myCreatedCoursesTab');
    const createContent = document.getElementById('createCourseTabContent');
    const myCoursesContent = document.getElementById('myCreatedCoursesTabContent');
    
    // Remove active styles from all tabs
    [createTab, myCoursesTab].forEach(tab => {
        tab.classList.remove('border-indigo-500', 'text-indigo-600');
        tab.classList.add('border-transparent', 'text-gray-500');
    });
    
    // Hide all content
    createContent.classList.add('hidden');
    myCoursesContent.classList.add('hidden');
    
    // Show selected tab
    if (tabName === 'create') {
        createTab.classList.remove('border-transparent', 'text-gray-500');
        createTab.classList.add('border-indigo-500', 'text-indigo-600');
        createContent.classList.remove('hidden');
    } else if (tabName === 'mycourses') {
        myCoursesTab.classList.remove('border-transparent', 'text-gray-500');
        myCoursesTab.classList.add('border-indigo-500', 'text-indigo-600');
        myCoursesContent.classList.remove('hidden');
    }
}

// Function to switch between Videos and Documents tabs
function switchCourseTab(tabName) {
    const videosContent = document.getElementById('videosContent');
    const documentsContent = document.getElementById('documentsContent');
    const assignmentsContent = document.getElementById('assignmentsContent');
    const videosTabBtn = document.getElementById('videosTabBtn');
    const documentsTabBtn = document.getElementById('documentsTabBtn');
    const assignmentsTabBtn = document.getElementById('assignmentsTabBtn');

    // Hide all content
    if(videosContent) videosContent.classList.add('hidden');
    if(documentsContent) documentsContent.classList.add('hidden');
    if(assignmentsContent) assignmentsContent.classList.add('hidden');

    // Reset all tab styles
    [videosTabBtn, documentsTabBtn, assignmentsTabBtn].forEach(btn => {
        if(btn) {
            btn.classList.remove('bg-indigo-50', 'text-indigo-700', 'border-indigo-100', 'border-b-2', 'border-indigo-600');
            btn.classList.add('text-gray-600', 'hover:bg-gray-100', 'border-transparent');
        }
    });

    const activeContent = document.getElementById(tabName + 'Content');
    if(activeContent) activeContent.classList.remove('hidden');

    const activeBtn = document.getElementById(tabName + 'TabBtn');
    if(activeBtn) {
        activeBtn.classList.remove('text-gray-600', 'hover:bg-gray-100', 'border-transparent');
        activeBtn.classList.add('bg-indigo-50', 'text-indigo-700', 'border-indigo-100');
    }
}

// Function to load and display course documents
function loadCourseDocuments(courseId) {
    const course = allCoursesData.find(c => c.id === courseId);
    const container = document.getElementById('courseDocumentsContainer');
    
    if (!container) return;
    
    if (!course || !course.documents || course.documents.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No documents available for this course.</p>';
        return;
    }
    
    let html = '<div class="space-y-4">';
    course.documents.forEach(doc => {
        // Determine per-student read status if rollout exists
        let isAssigned = false;
        let isReadForStudent = false;
        if (typeof loggedInUser !== 'undefined' && loggedInUser && loggedInUser.role === 'student') {
            const rollout = documentRollouts.find(r => r.courseId === courseId && r.documentId === doc.id && r.studentId === loggedInUser.id);
            if (rollout) {
                isAssigned = true;
                isReadForStudent = !!rollout.isRead;
            }
        }

        const readBadge = (isAssigned ? isReadForStudent : doc.isRead) 
            ? '<span class="inline-block px-3 py-1 bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 text-xs font-medium rounded-full ml-2"><i class="las la-check mr-1"></i>Read</span>'
            : '<span class="inline-block px-3 py-1 bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 text-xs font-medium rounded-full ml-2"><i class="las la-exclamation-circle mr-1"></i>Not Read</span>';
        const requiredBadge = isAssigned 
            ? '<span class="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 text-xs font-medium rounded-full ml-2"><i class="las la-clipboard-check mr-1"></i>Required</span>'
            : '';
        
        html += `
            <div class="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition">
                <div class="flex items-start justify-between">
                    <div class="flex items-start flex-1">
                        <div class="p-3 rounded-lg bg-${doc.color}-50 text-${doc.color}-600 mr-4 flex-shrink-0">
                            <i class="${doc.icon} text-2xl"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center flex-wrap">
                                <h4 class="text-lg font-semibold text-gray-800 mr-2">${doc.title}</h4>
                                ${readBadge}
                                ${requiredBadge}
                            </div>
                            <p class="text-sm text-gray-600 mt-1">${doc.description}</p>
                            <div class="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                                <span><i class="las la-calendar mr-1"></i>${doc.createdDate}</span>
                                <span><i class="las la-database mr-1"></i>${doc.fileSize}</span>
                                <span class="uppercase font-medium">${doc.type}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex space-x-2 flex-shrink-0 ml-4">
                        <button onclick="viewDocument(${courseId}, ${doc.id})" class="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition">
                            <i class="fas fa-eye mr-1"></i>View
                        </button>
                        <button onclick="markDocumentAsRead(${courseId}, ${doc.id})" class="px-4 py-2 ${ (isAssigned ? isReadForStudent : doc.isRead) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700' } text-white text-sm rounded-md transition">
                            <i class="las la-check mr-1"></i>${ (isAssigned ? isReadForStudent : doc.isRead) ? 'Read' : 'Mark as Read' }
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// Function to load and display course assignments
function loadCourseAssignments(courseId) {
    const container = document.getElementById('courseAssignmentsContainer');

    if (!container) return;

    let courseAssignments = [];

    if (typeof loggedInUser !== 'undefined' && loggedInUser && loggedInUser.role === 'student') {
        const course = allCoursesData.find(c => c.id === courseId);
        
        // Auto-generate missing assignments from templates
        if (course && course.assignments && course.assignments.length > 0) {
            let wasUpdated = false;
            course.assignments.forEach(template => {
                const exists = allAssignmentsData.find(a => 
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
                        markedAsRead: false,
                        readDate: null,
                        score: null,
                        feedback: null,
                        creationDate: new Date().toISOString().slice(0, 10)
                    };
                    allAssignmentsData.push(newAssignment);
                    wasUpdated = true;
                }
            });
            if (wasUpdated && typeof saveToLocalStorage === 'function') {
                saveToLocalStorage();
            }
        }

        courseAssignments = allAssignmentsData.filter(a =>
            a.courseId === courseId && a.assignedStudentId === loggedInUser.id
        );
    }
    
    if (courseAssignments.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">No assignments available for this course.</p>';
        return;
    }
    
    let html = '<div class="space-y-4">';
    courseAssignments.forEach(assignment => {
        // Determine status badge
        let statusBadge = '';
        let statusClass = '';
        
        if (assignment.status === 'Submitted' || assignment.status === 'Read') {
            statusBadge = '<span class="px-3 py-1 bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 text-xs font-semibold rounded-full"><i class="las la-paper-plane mr-1"></i>Submitted</span>';
            statusClass = 'border-blue-200 bg-blue-50';
        } else if (assignment.status === 'Graded') {
            statusBadge = '<span class="px-3 py-1 bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 text-xs font-semibold rounded-full"><i class="las la-check-circle mr-1"></i>Graded</span>';
            statusClass = 'border-green-200 bg-green-50';
        } else {
            // Check if overdue
            const today = new Date();
            const dueDate = new Date(assignment.dueDate);
            if (dueDate < today) {
                statusBadge = '<span class="px-3 py-1 bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 text-xs font-semibold rounded-full"><i class="las la-exclamation-triangle mr-1"></i>Overdue</span>';
                statusClass = 'border-red-200 bg-red-50';
            } else {
                statusBadge = '<span class="px-3 py-1 bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 text-xs font-semibold rounded-full"><i class="las la-clock mr-1"></i>Pending</span>';
                statusClass = 'border-yellow-200 bg-yellow-50';
            }
        }
        
        // Get document count
        const docCount = assignment.documents ? assignment.documents.length : 0;
        const questionCount = assignment.questions ? assignment.questions.length : 0;
        
        html += `
            <div class="bg-white border-2 ${statusClass} rounded-lg p-5 hover:shadow-lg transition">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <h4 class="text-lg font-semibold text-gray-800">${assignment.title}</h4>
                            ${statusBadge}
                        </div>
                        <p class="text-sm text-gray-600 mb-3">${assignment.instructions}</p>
                        <div class="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                            <span><i class="las la-calendar-alt mr-1 text-indigo-500"></i>Due: ${new Date(assignment.dueDate).toLocaleDateString()}</span>
                            <span><i class="las la-star mr-1 text-amber-500"></i>${assignment.totalMarks} marks</span>
                            ${docCount > 0 ? `<span><i class="las la-paperclip mr-1 text-blue-500"></i>${docCount} document(s)</span>` : ''}
                            ${questionCount > 0 ? `<span><i class="las la-question-circle mr-1 text-purple-500"></i>${questionCount} question(s)</span>` : ''}
                            ${assignment.type === 'mark-as-read' ? '<span class="px-2 py-1 bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 rounded-full">Mark as Read</span>' : ''}
                        </div>
                    </div>
                </div>
                
                ${assignment.documents && assignment.documents.length > 0 ? `
                    <div class="mt-4 pt-4 border-t border-gray-200">
                        <h5 class="text-sm font-semibold text-gray-700 mb-2"><i class="las la-folder-open mr-2"></i>Attached Documents:</h5>
                        <div class="space-y-2">
                            ${assignment.documents.map(doc => {
                                let icon = 'la-file';
                                let color = 'indigo';
                                if (doc.fileType === 'PDF') { icon = 'la-file-pdf'; color = 'red'; }
                                else if (doc.fileType === 'PPT' || doc.fileType === 'PPTX') { icon = 'la-file-powerpoint'; color = 'orange'; }
                                else if (doc.fileType === 'DOC' || doc.fileType === 'DOCX') { icon = 'la-file-word'; color = 'blue'; }
                                
                                return `
                                    <div class="flex items-center gap-2 p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition border border-gray-200">
                                        <i class="fas ${icon} text-${color}-600"></i>
                                        <span class="flex-1 text-gray-700 text-sm">${doc.fileName}</span>
                                        <span class="text-xs text-gray-500">${doc.fileSize}</span>
                                        <button onclick="viewAssignmentDocument('${doc.fileUrl}', '${doc.fileName}', '${doc.fileType}')" class="text-blue-600 hover:text-blue-800 text-xs px-2 py-1">
                                            <i class="fas fa-eye mr-1"></i>View
                                        </button>
                                        ${(typeof loggedInUser !== "undefined" && loggedInUser && (loggedInUser.role === "training-manager" || loggedInUser.role === "training_manager" || loggedInUser.role === "Training Manager")) ? `<a href="${doc.fileUrl}" download="${doc.fileName}" class="text-green-600 hover:text-green-800 text-xs px-2 py-1"><i class="las la-download"></i></a>` : ""}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="mt-4 flex justify-end gap-2">
                    <button onclick="showViewAssignmentModal(${assignment.id})" class="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition">
                        <i class="fas fa-eye mr-1"></i>View Details
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// Function to view a document (PDF or PPT)
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
                    <p class="text-sm text-gray-600 mt-1">${(doc.type || '').toUpperCase()} ? ${doc.fileSize}</p>
                </div>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700 text-3xl font-light">ï¿½</button>
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

// Function to mark a document as read
function markDocumentAsRead(courseId, docId) {
    const course = allCoursesData.find(c => c.id === courseId);
    if (!course) return;

    const doc = course.documents.find(d => d.id === docId);
    if (!doc) return;

    // If a student is logged in, update rollout record instead of global doc
    if (typeof loggedInUser !== 'undefined' && loggedInUser && loggedInUser.role === 'student') {
        let rollout = documentRollouts.find(r => r.courseId === courseId && r.documentId === docId && r.studentId === loggedInUser.id);
        if (!rollout) {
            // Not previously assigned, create an ad-hoc record so we can track
            rollout = {
                id: Date.now(),
                courseId,
                documentId: docId,
                studentId: loggedInUser.id,
                assignedBy: null,
                assignedDate: new Date().toISOString(),
                isRead: false,
                readDate: null
            };
            documentRollouts.push(rollout);
        }
        rollout.isRead = !rollout.isRead;
        rollout.readDate = rollout.isRead ? new Date().toISOString() : null;

        saveToLocalStorage(); // Save document read status
        loadCourseDocuments(courseId);
        showMessageModal('Success', rollout.isRead
            ? `"${doc.title}" has been marked as read!`
            : `"${doc.title}" has been marked as unread!`
        );
        return;
    }

    // Fallback: toggle global doc read (e.g., admin preview)
    doc.isRead = !doc.isRead;
    loadCourseDocuments(courseId);
    showMessageModal('Success', doc.isRead
        ? `"${doc.title}" has been marked as read!`
        : `"${doc.title}" has been marked as unread!`
    );
}


// Handle course answer submission
document.addEventListener('DOMContentLoaded', function() {
    const submitBtn = document.getElementById('submitCourseAnswersBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', function() {
            if (!window.currentSectionQuestions || window.currentSectionQuestions.length === 0) {
                showMessageModal('No Questions', 'This section has no questions to answer.');
                return;
            }

            let score = 0;
            let totalQuestions = window.currentSectionQuestions.length;
            let allAnswered = true;

            window.currentSectionQuestions.forEach(q => {
                let isCorrect = false;
                let isAnswered = false;

                if (q.type === 'multiple-choice' || q.type === 'true-false' || !q.type) {
                    const selectedElements = document.querySelectorAll(`input[name="question-${q.id}"]:checked`);
                    isAnswered = selectedElements && selectedElements.length > 0;
                    
                    if (isAnswered) {
                        if (q.type === 'multiple-choice') {
                            let userAnswers = Array.from(selectedElements).map(el => parseInt(el.value));
                            let correctAnswers = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
                            isCorrect = userAnswers.length === correctAnswers.length && userAnswers.every(val => correctAnswers.includes(val));
                        } else {
                            let userAnswer = selectedElements[0].value;
                            if (q.type === 'true-false') {
                                userAnswer = userAnswer === 'true';
                            } else {
                                userAnswer = parseInt(userAnswer);
                            }
                            isCorrect = (userAnswer === q.correctAnswer);
                        }
                    }
                } else if (q.type === 'matching') {
                    isAnswered = true;
                    isCorrect = true;
                    if (q.pairs && q.pairs.length > 0) {
                        for (let pIndex = 0; pIndex < q.pairs.length; pIndex++) {
                            const selectEl = document.querySelector(`select[name="question-${q.id}-pair-${pIndex}"]`);
                            if (!selectEl || !selectEl.value) {
                                isAnswered = false;
                                isCorrect = false;
                                break;
                            }
                            if (selectEl.value !== q.pairs[pIndex].definition) {
                                isCorrect = false;
                            }
                        }
                    }
                } else if (q.type === 'fill-in-blank') {
                    isAnswered = true;
                    isCorrect = true;
                    if (q.answers && q.answers.length > 0) {
                        for (let aIndex = 0; aIndex < q.answers.length; aIndex++) {
                            const inputEl = document.querySelector(`input[name="question-${q.id}-answer-${aIndex}"]`);
                            if (!inputEl || !inputEl.value.trim()) {
                                isAnswered = false;
                                isCorrect = false;
                                break;
                            }
                            if (inputEl.value.trim().toLowerCase() !== q.answers[aIndex].toLowerCase()) {
                                isCorrect = false;
                            }
                        }
                    }
                } else if (q.type === 'ordering') {
                    isAnswered = true;
                    isCorrect = true;
                    if (q.correctOrder && q.correctOrder.length > 0) {
                        const userSortedItems = [];
                        const listContainer = document.getElementById(`sortable-${q.id}`);
                        if (listContainer) {
                            const itemsEl = listContainer.querySelectorAll('.drag-item');
                            itemsEl.forEach(el => userSortedItems.push(el.getAttribute('data-item')));
                        } else {
                            isAnswered = false;
                            isCorrect = false;
                        }

                        if (isAnswered && userSortedItems.length === q.correctOrder.length) {
                            for (let i = 0; i < q.correctOrder.length; i++) {
                                if (userSortedItems[i] !== q.correctOrder[i]) {
                                    isCorrect = false;
                                    break;
                                }
                            }
                        } else {
                            isCorrect = false;
                        }
                    }
                } else if (q.type === 'long-answer') {
                    const textareaEl = document.querySelector(`textarea[name="question-${q.id}"]`);
                    isAnswered = textareaEl && textareaEl.value.trim() !== '';
                    // Automatically pass long answers for now or grade manually later
                    isCorrect = isAnswered; 
                }

                if (!isAnswered) {
                    allAnswered = false;
                } else if (isCorrect) {
                    score++;
                }
            });

            if (!allAnswered) {
                showMessageModal('Incomplete', 'Please answer all questions before submitting.');
                return;
            }

            const percentage = Math.round((score / totalQuestions) * 100);
            const sectionTitle = window.currentSection ? window.currentSection.title : 'Section';
            showAssessmentSuccess(`You scored ${score}/${totalQuestions} (${percentage}%) on ${sectionTitle}. Great job!`);
        });
    }
});

/* Default load */
document.addEventListener("DOMContentLoaded", () => {
  showStudentCourses("inprogress");
});

        // --- CERTIFICATE FEATURE ---
        let allCertificatesData = [];
        
        // Function to get default certificates
        function getDefaultCertificates() {
            return [];
        }

        // Function to issue certificate to student
        function issueCertificateToStudent(studentId, courseId, courseName) {
            const student = allUsersData.find(u => u.id === studentId);
            if (!student) return;

            const certificateId = 'CERT-' + Date.now();
            const certificate = {
                id: certificateId,
                studentId: studentId,
                studentName: student.name + (student.surname ? ' ' + student.surname : ''),
                courseId: courseId,
                courseName: courseName,
                issueDate: new Date().toISOString().slice(0, 10),
                certificateType: 'Course Completion',
                status: 'Active'
            };
            allCertificatesData.push(certificate);
            saveToLocalStorage(); // Save to localStorage
            showMessageModal('Success', `Certificate issued to ${student.name} for completing ${courseName}.`);
        }

        // Function to show certificate viewer
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

        // Close certificate viewer
        window.closeCertificateViewer = function closeCertificateViewer() {
            document.getElementById('certificateViewerModal').classList.add('hidden');
            document.getElementById('certificateViewerModal').classList.remove('show');
        }

        // Download certificate as image
        function downloadCertificate() {
            // Get certificate details
            const studentName = document.getElementById('certificateStudentName').textContent;
            const courseName = document.getElementById('certificateCourseName').textContent;
            const date = document.getElementById('certificateDate').textContent;
            const certId = document.getElementById('certificateId').textContent;

            // Create canvas for the certificate design
            const canvas = document.createElement('canvas');
            canvas.width = 1200;
            canvas.height = 800;
            const ctx = canvas.getContext('2d');

            // Background gradient
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#fef3c7');
            gradient.addColorStop(1, '#fef08a');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Border
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 8;
            ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

            // Text settings
            ctx.fillStyle = '#78350f';
            ctx.textAlign = 'center';

            // Title
            ctx.font = 'bold 72px Arial';
            ctx.fillText('Certificate of Achievement', canvas.width / 2, 150);

            // Subtitle
            ctx.font = '24px Arial';
            ctx.fillStyle = '#666';
            ctx.fillText('This certifies that', canvas.width / 2, 250);

            // Student name
            ctx.font = 'bold 48px Arial';
            ctx.fillStyle = '#333';
            ctx.fillText(studentName, canvas.width / 2, 350);

            // Completion text
            ctx.font = '24px Arial';
            ctx.fillStyle = '#666';
            ctx.fillText('has successfully completed', canvas.width / 2, 430);

            // Course name
            ctx.font = 'bold 32px Arial';
            ctx.fillStyle = '#333';
            ctx.fillText(courseName, canvas.width / 2, 510);

            // Date
            ctx.font = '18px Arial';
            ctx.fillStyle = '#666';
            ctx.fillText('Date: ' + date, canvas.width / 2, 600);

            // Certificate ID
            ctx.font = '14px Arial';
            ctx.fillStyle = '#999';
            ctx.fillText('Certificate ID: ' + certId, canvas.width / 2, 700);

            // Convert canvas to image
            const imgData = canvas.toDataURL('image/png');

            // Create PDF using jsPDF
            const { jsPDF } = window;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [1200, 800]
            });

            // Add image to PDF
            pdf.addImage(imgData, 'PNG', 0, 0, 1200, 800);

            // Download PDF
            pdf.save(`certificate-${certId}.pdf`);
        }

        // --- BADGES FEATURE ---
        let allBadgesData = [];
        
        // Function to get default badges
        function getDefaultBadges() {
            return [];
        }
        let studentBadgesData = [];

        // Rollout assignments: documents required to be read by students
        // Each entry: { id, courseId, documentId, studentId, assignedBy, assignedDate, isRead, readDate }
        let documentRollouts = [];
        
        // Student notifications system
        let studentNotifications = [];

        // Function to create a new badge
        function createNewBadge(name, hoursRequired, description, icon) {
            const badge = {
                id: Date.now(),
                name: name,
                hoursRequired: hoursRequired,
                description: description,
                icon: icon,
                creatorId: loggedInUser.id,
                createdDate: new Date().toISOString().slice(0, 10),
                timesEarned: 0
            };
            allBadgesData.push(badge);
            saveToLocalStorage(); // Save to localStorage
            return badge;
        }

        // Function to award badge to student based on hours spent
        function awardBadgeToStudent(studentId, badgeId) {
            const badge = allBadgesData.find(b => b.id === badgeId);
            if (!badge) return false;

            // Check if student already has this badge
            const alreadyHasBadge = studentBadgesData.some(sb => sb.studentId === studentId && sb.badgeId === badgeId);
            if (alreadyHasBadge) return false;

            const earnedBadge = {
                studentId: studentId,
                badgeId: badgeId,
                earnedDate: new Date().toISOString().slice(0, 10)
            };
            studentBadgesData.push(earnedBadge);
            badge.timesEarned++;
            return true;
        }

        // Function to check and award badges to a student based on hours spent
        function checkAndAwardBadges(studentId) {
            const student = allUsersData.find(u => u.id === studentId);
            if (!student) return;

            const totalHours = student.totalHoursSpent || 0;

            allBadgesData.forEach(badge => {
                // Check if student's hours meet the badge requirement
                if (totalHours >= badge.hoursRequired) {
                    const earned = awardBadgeToStudent(studentId, badge.id);
                    if (earned) {
                        showMessageModal('Badge Earned!', `Congratulations! You earned the "${badge.name}" badge for reaching ${badge.hoursRequired} learning hours!`);
                    }
                }
            });
        }

        // Function to get student badges
        function getStudentBadges(studentId) {
            return studentBadgesData
                .filter(sb => sb.studentId === studentId)
                .map(sb => {
                    const badge = allBadgesData.find(b => b.id === sb.badgeId);
                    return {
                        ...badge,
                        earnedDate: sb.earnedDate
                    };
                });
        }

        // Function to render student badges grid
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

        // Function to show badge details
        function showBadgeDetails(badgeId, name, description, icon, hoursRequired, earnedDate) {
            document.getElementById('badgeViewerIcon').textContent = icon;
            document.getElementById('badgeViewerName').textContent = name;
            document.getElementById('badgeViewerDescription').textContent = description;
            document.getElementById('badgeViewerRequirement').textContent = `Complete ${hoursRequired} hours of learning`;
            document.getElementById('badgeEarnedDate').textContent = earnedDate;
            document.getElementById('badgeViewerModal').classList.remove('hidden');
            document.getElementById('badgeViewerModal').classList.add('show');
        }

        // Function to close badge viewer
        function closeBadgeViewer() {
            document.getElementById('badgeViewerModal').classList.add('hidden');
            document.getElementById('badgeViewerModal').classList.remove('show');
        }

        // Function to render created badges table (for training managers)
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

        // Function to render all badges table (for admin)
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

        // Function to delete badge
        function deleteBadge(badgeId) {
            if (!confirm('Are you sure you want to delete this badge?')) return;
            allBadgesData = allBadgesData.filter(b => b.id !== badgeId);
            renderCreatedBadgesTable();
            showMessageModal('Deleted', 'Badge has been deleted.');
        }

        // Function to edit badge
        function editBadge(badgeId) {
            showMessageModal('Edit Badge', 'Edit functionality coming soon.');
        }

        // Form submission for creating badge
        const createBadgeForm = document.getElementById('createBadgeForm');
        if (createBadgeForm) {
            createBadgeForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const name = document.getElementById('badgeName').value.trim();
                const hoursRequired = parseInt(document.getElementById('badgeHoursRequired').value, 10);
                const description = document.getElementById('badgeDescription').value.trim();
                const icon = document.getElementById('badgeIcon').value.trim();

                if (!name || !hoursRequired || !description || !icon) {
                    showMessageModal('Input Error', 'Please fill all fields.');
                    return;
                }

                createNewBadge(name, hoursRequired, description, icon);
                showMessageModal('Success', `Badge "${name}" has been created!`);
                renderCreatedBadgesTable();
                this.reset();
            });
        }

        // Reset badge form
        function resetBadgeForm() {
            document.getElementById('createBadgeForm').reset();
        }

        // Event listeners for badges sections
        document.addEventListener('click', function(e) {
            if (e.target.getAttribute('data-section') === 'my-badges') {
                renderStudentBadgesGrid();
            } else if (e.target.getAttribute('data-section') === 'badges-created') {
                renderCreatedBadgesTable();
            } else if (e.target.getAttribute('data-section') === 'badges-management') {
                renderAllBadgesTable();
            }
        });

        // Course Search Functionality
        const courseSearchInput = document.getElementById('courseSearchInput');
        if (courseSearchInput) {
            courseSearchInput.addEventListener('keyup', function() {
                const searchTerm = this.value.toLowerCase();
                const tableRows = document.querySelectorAll('#allExistingCoursesTableBody tr');
                
                tableRows.forEach(row => {
                    const _c2 = row.querySelector('td:nth-child(2)'); const courseName = _c2 && _c2.textContent ? _c2.textContent.toLowerCase() : '';
                    const _c3 = row.querySelector('td:nth-child(3)'); const description = _c3 && _c3.textContent ? _c3.textContent.toLowerCase() : '';
                    const _c7 = row.querySelector('td:nth-child(7)'); const creator = _c7 && _c7.textContent ? _c7.textContent.toLowerCase() : '';
                    
                    if (courseName.includes(searchTerm) || description.includes(searchTerm) || creator.includes(searchTerm)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            });
        }

        // ====================================================
        // SIDEBAR NAVIGATION
        // ====================================================

        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', function(e) {
                if (this.id === 'logoutBtn') return;
                
                e.preventDefault();
                
                // Update active state
                document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
                this.classList.add('active');

                // Show content section
                const section = this.dataset.section;
                document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
                const content = document.getElementById(section + 'Content');
                if (content) {
                    content.classList.add('active');
                    document.getElementById('pageTitle').textContent = this.querySelector('.sidebar-text').textContent;
                }
            });
        });

        window.showViewAssignmentModal = function showViewAssignmentModal(assignmentId) {
            const assignment = allAssignmentsData.find(a => String(a.id) === String(assignmentId));
            if (!assignment) return;

            document.getElementById('viewAssignmentTitle').textContent = assignment.title;
            document.getElementById('viewAssignmentDueDate').textContent = new Date(assignment.dueDate).toLocaleDateString();
            document.getElementById('viewAssignmentTotalMarks').textContent = assignment.totalMarks || 0;
            document.getElementById('viewAssignmentInstructions').textContent = assignment.instructions;
            
            // Determine if the current user is a student or TM
            const isStudent = loggedInUser && loggedInUser.role === 'student' && assignment.assignedStudentId === loggedInUser.id;
            const isTrainingManager = loggedInUser && ((loggedInUser.role === "training-manager" || loggedInUser.role === "training_manager" || loggedInUser.role === "Training Manager") || loggedInUser.role === 'training_manager' || loggedInUser.role === 'Training Manager');
            
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
                
                const gradeResultSection = document.getElementById('studentGradeResultSection');
                if (gradeResultSection) {
                    if (assignment.score !== undefined && assignment.score !== null && assignment.score !== '') {
                        gradeResultSection.style.display = 'block';
                        document.getElementById('studentGradeScoreDisplay').textContent = `${assignment.score} / ${assignment.totalMarks || 100}`;
                        document.getElementById('studentGradeStatusDisplay').textContent = assignment.status || 'Graded';
                        document.getElementById('studentGradeFeedbackDisplay').textContent = assignment.feedback || 'No formal feedback provided.';
                        // Hide submission section if it's strictly finalized
                        if (assignment.status === 'Graded' || String(assignment.status).toLowerCase() === 'completed') {
                            // studentSection.style.display = 'none'; // Optional to hide 
                        }
                    } else {
                        gradeResultSection.style.display = 'none';
                    }
                }
                
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
                const canGrade = ['Submitted', 'Graded', 'Needs Revision'].includes(assignment.status);
                if (studentSection) studentSection.style.display = 'none';
                if (tmGradeSection) tmGradeSection.style.display = canGrade ? 'block' : 'none';
                if (submitBtn) submitBtn.style.display = 'none';
                if (gradeBtn) {
                    gradeBtn.style.display = canGrade ? 'inline-block' : 'none';
                    gradeBtn.innerHTML = assignment.status === 'Graded' ? '<i class="las la-edit mr-2"></i>Update Grade' : '<i class="las la-check-double mr-2"></i>Submit Grade';
                }
                
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
                            ${(typeof loggedInUser !== "undefined" && loggedInUser && (loggedInUser.role === "training-manager" || loggedInUser.role === "training_manager" || loggedInUser.role === "Training Manager")) ? `<a href="${file.fileUrl}" download="${file.fileName}" class="text-green-600 hover:text-green-800 text-xs px-2"><i class="las la-download"></i></a>` : ""}
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
                        ${(typeof loggedInUser !== "undefined" && loggedInUser && (loggedInUser.role === "training-manager" || loggedInUser.role === "training_manager" || loggedInUser.role === "Training Manager")) ? `<a href="${doc.fileUrl}" download="${doc.fileName}" class="text-green-600 hover:text-green-800 px-3 py-1 text-sm"><i class="las la-download"></i></a>` : ""}
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

        window.hideViewAssignmentModal = function hideViewAssignmentModal() {
            document.getElementById('viewAssignmentModal').classList.add('hidden');
            document.getElementById('viewAssignmentModal').classList.remove('show');
        }

        // Render Training Manager's Assignments Table
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

        // Render Student's Assignments List
        function renderStudentAssignmentsList() {
            const container = document.getElementById('studentAssignmentsList');
            if (!container) return;

            if (!loggedInUser || loggedInUser.role !== 'student') {
                container.innerHTML = '<div class="p-6 bg-white rounded-lg shadow text-gray-500 text-sm text-center">Only students have an assignment list here.</div>';
                return;
            }

            // Get all assignments assigned to logged-in student
            const myAssignments = (typeof allAssignmentsData !== 'undefined' ? allAssignmentsData : []).filter(a =>
                String(a.assignedStudentId) === String(loggedInUser.id)
            );

            if (myAssignments.length === 0) {
                container.innerHTML = '<div class="p-6 bg-white rounded-lg shadow text-gray-500 text-sm text-center">No assignments for you to display.</div>';
                return;
            }

            let html = '<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">';
            
            myAssignments.forEach(assignment => {
                const courseName = assignment.courseId ? ((typeof allCoursesData !== 'undefined' ? allCoursesData : []).find(c => String(c.id) === String(assignment.courseId))?.title || 'Unknown Course') : 'General Assignment';
                
                let statusColor = 'bg-gray-100 text-gray-800';
                let statusIcon = 'la-clock';
                
                if (assignment.status === 'Submitted') {
                    statusColor = 'bg-blue-100 text-blue-800';
                    statusIcon = 'la-paper-plane';
                } else if (assignment.status === 'Graded') {
                    statusColor = 'bg-green-100 text-green-800';
                    statusIcon = 'la-check-circle';
                } else if (assignment.status === 'Needs Revision') {
                    statusColor = 'bg-yellow-100 text-yellow-800';
                    statusIcon = 'la-undo';
                }

                html += `<div class="bg-white p-5 rounded-lg shadow border border-gray-100 flex flex-col h-full">
                    <div class="flex justify-between items-start mb-3">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}">
                            <i class="las ${statusIcon} mr-1"></i> ${assignment.status || 'Assigned'}
                        </span>
                        <span class="text-xs text-gray-500"><i class="las la-calendar mr-1"></i>${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No Date'}</span>
                    </div>
                    <h3 class="text-md font-semibold text-gray-900 mb-1">${assignment.title}</h3>
                    <p class="text-xs text-indigo-600 mb-3 font-medium">${courseName}</p>
                    <p class="text-sm text-gray-600 mb-4 line-clamp-2 flex-grow">${assignment.instructions}</p>
                    <div class="mt-auto pt-4 border-t border-gray-100">
                        <button onclick="showViewAssignmentModal('${assignment.id}')" class="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-2 px-4 rounded transition">
                            ${assignment.status === 'Assigned' || assignment.status === 'Needs Revision' ? 'View & Submit' : 'View Details'}
                        </button>
                    </div>
                </div>`;
            });
            
            html += '</div>';
            container.innerHTML = html;
        }

        function renderMyGrades() {
            const container = document.getElementById('myGradesListContainer');
            if (!container) return;

            if (!loggedInUser || loggedInUser.role !== 'student') {
                container.innerHTML = '<div class="text-center py-8 text-gray-500">Only students have grades.</div>';
                return;
            }

            // All assignments for this student
            const myAssignments = (typeof allAssignmentsData !== 'undefined' ? allAssignmentsData : []).filter(a =>
                String(a.assignedStudentId) === String(loggedInUser.id)
            );

            // Graded assignments
            const gradedAssignments = myAssignments.filter(a => 
                a.status === 'Graded' || (a.score !== undefined && a.score !== null && a.score !== '') || String(a.status).toLowerCase() === 'completed'
            );


            let html = `
            <div class="mb-4 border-b border-gray-200">
                <ul class="flex flex-wrap -mb-px text-sm font-medium text-center" id="myGradesTabs" role="tablist">
                    <li class="mr-2" role="presentation">
                        <button class="inline-block p-4 border-b-2 rounded-t-lg text-indigo-600 border-indigo-600 focus:outline-none" id="grades-tab" type="button" role="tab" aria-controls="grades" aria-selected="true" onclick="
                            document.getElementById('myGradesTabContent_grades').style.display='block';
                            document.getElementById('myGradesTabContent_assignments').style.display='none';
                            this.className='inline-block p-4 border-b-2 rounded-t-lg text-indigo-600 border-indigo-600 focus:outline-none';
                            document.getElementById('assignments-tab').className='inline-block p-4 border-b-2 border-transparent rounded-t-lg text-gray-500 hover:text-gray-600 hover:border-gray-300 focus:outline-none';
                        ">Formal Grades</button>
                    </li>
                    <li class="mr-2" role="presentation">
                        <button class="inline-block p-4 border-b-2 border-transparent rounded-t-lg text-gray-500 hover:text-gray-600 hover:border-gray-300 focus:outline-none" id="assignments-tab" type="button" role="tab" aria-controls="assignments" aria-selected="false" onclick="
                            document.getElementById('myGradesTabContent_assignments').style.display='block';
                            document.getElementById('myGradesTabContent_grades').style.display='none';
                            this.className='inline-block p-4 border-b-2 rounded-t-lg text-indigo-600 border-indigo-600 focus:outline-none';
                            document.getElementById('grades-tab').className='inline-block p-4 border-b-2 border-transparent rounded-t-lg text-gray-500 hover:text-gray-600 hover:border-gray-300 focus:outline-none';
                        ">Status View</button>
                    </li>
                </ul>
            </div>
            `;

            // 1. Table of Grades
            html += `<div id="myGradesTabContent_grades" style="display:block;">`;
            if (gradedAssignments.length > 0) {

                html += `<div class="mb-8">
                    <h4 class="text-md font-semibold text-gray-800 mb-4 px-1 border-l-4 border-indigo-600">Formal Grades</h4>
                    <div class="overflow-x-auto border border-gray-200 rounded-lg">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignment</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comments</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">`;

                gradedAssignments.forEach(a => {
                    const courseName = a.courseId ? ((typeof allCoursesData !== 'undefined' ? allCoursesData : []).find(c => String(c.id) === String(a.courseId))?.title || 'Unknown Course') : 'General Assignment';
                    const scoreText = (a.score !== undefined && a.score !== null && a.score !== '') ? `${a.score} / ${a.totalMarks || 100}` : 'Pending';
                    const feedbackText = a.feedback || '-';
                    const dateText = a.gradedDate || a.submissionDate || 'N/A';
                    
                    let scoreColor = 'text-green-600';
                    if (a.score !== undefined && a.score !== null && a.totalMarks) {
                        const pct = a.score / a.totalMarks;
                        if (pct < 0.5) scoreColor = 'text-red-600';
                        else if (pct < 0.75) scoreColor = 'text-orange-500';
                    }

                    html += `<tr>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${a.title}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${courseName}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${dateText}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold ${scoreColor}">${scoreText}</td>
                        <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title="${feedbackText.replace(/"/g, '&quot;')}">${feedbackText}</td>
                    </tr>`;
                });
                html += `</tbody></table></div></div>`;
            } else {
                html += `<div class="mb-8 text-center py-6 border border-dashed border-gray-300 rounded bg-gray-50 text-gray-500">
                    <i class="las la-certificate text-3xl mb-2 text-gray-400"></i><br>No officially graded assignments yet.
                </div>`;
            }

            html += `</div>`; // End of Grades tab

            // 2. Cards for all assignments
            html += `<div id="myGradesTabContent_assignments" style="display:none;">`;
            
            if (myAssignments.length === 0) {
                html += `<div class="text-center py-6 text-gray-500 text-sm">No assignments found for you.</div>`;
            } else {
                html += '<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">';
                myAssignments.forEach(assignment => {
                    const courseName = assignment.courseId ? ((typeof allCoursesData !== 'undefined' ? allCoursesData : []).find(c => String(c.id) === String(assignment.courseId))?.title || 'Unknown Course') : 'General Assignment';

                    let statusColor = 'bg-gray-100 text-gray-800';
                    let statusIcon = 'la-clock';

                    if (assignment.status === 'Submitted') {
                        statusColor = 'bg-blue-100 text-blue-800';
                        statusIcon = 'la-paper-plane';
                    } else if (assignment.status === 'Graded') {
                        statusColor = 'bg-green-100 text-green-800';
                        statusIcon = 'la-check-circle';
                    } else if (assignment.status === 'Needs Revision') {
                        statusColor = 'bg-yellow-100 text-yellow-800';
                        statusIcon = 'la-undo';
                    }

                    // Grading Info inside card
                    let gradeHtml = '';
                    if (assignment.score !== undefined && assignment.score !== null && assignment.score !== '') {
                        const scoreText = `${assignment.score} / ${assignment.totalMarks || 100}`;
                        let scoreColorText = 'text-green-600';
                        if (assignment.totalMarks) {
                            const pct = assignment.score / assignment.totalMarks;
                            if (pct < 0.5) scoreColorText = 'text-red-600';
                            else if (pct < 0.75) scoreColorText = 'text-orange-500';
                        }
                        gradeHtml = `
                        <div class="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                            <div class="flex justify-between items-center mb-1">
                                <span class="text-xs font-semibold text-gray-700">Grade:</span>
                                <span class="text-sm font-bold ${scoreColorText}">${scoreText}</span>
                            </div>
                        </div>`;
                    }

                    html += `<div class="bg-white p-5 rounded-lg shadow border border-gray-100 flex flex-col h-full">
                        <div class="flex justify-between items-start mb-3">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}">
                                <i class="las ${statusIcon} mr-1"></i> ${(assignment.status && assignment.status !== 'undefined') ? assignment.status : 'Assigned'}
                            </span>
                            <span class="text-xs text-gray-500">${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No Date'}</span>
                        </div>
                        <h3 class="text-md font-semibold text-gray-900 mb-1">${assignment.title}</h3>
                        <p class="text-xs text-indigo-600 mb-2 font-medium">${courseName}</p>
                        
                        ${gradeHtml}

                        <div class="mt-auto pt-4 border-t border-gray-100">
                            <button onclick="showViewAssignmentModal('${assignment.id}')" class="w-full bg-indigo-50 text-indigo-700 font-medium py-2 px-4 rounded">
                                View Details
                            </button>
                        </div>
                    </div>`;
                });
                html += '</div>';
            }
            html += `</div>`; // End of Assignments tab

            container.innerHTML = html;
        }

        // Function to view assignment documents
        window.viewAssignmentDocument = function viewAssignmentDocument(fileUrl, fileName, fileType) {
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
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700 text-3xl font-light">ï¿½</button>
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
                            ${(typeof loggedInUser !== "undefined" && loggedInUser && (loggedInUser.role === "training-manager" || loggedInUser.role === "training_manager" || loggedInUser.role === "Training Manager")) ? `<a href="${fileUrl}" download="${fileName}" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"><i class="las la-download mr-2"></i>Download</a>` : ""}
                            <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }



        // ====================================================
        // CALENDAR FUNCTIONALITY FOR STUDENTS
        // ====================================================

        let currentCalendarDate = new Date();
        let calendarEvents = [];

        function getEventTypeColor(type) {
            const colors = {
                'assignment': 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 border-blue-300',
                'test': 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20 border-orange-300',
                'exam': 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 border-red-300'
            };
            return colors[type] || 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 border-gray-300';
        }

        function getEventTypeIcon(type) {
            const icons = {
                'assignment': '<i class="las la-file-signature text-blue-600 text-lg mr-1"></i>',
                'test': '<i class="las la-clipboard-list text-orange-600 text-lg mr-1"></i>',
                'exam': '<i class="las la-graduation-cap text-red-600 text-lg mr-1"></i>'
            };
            return icons[type] || '<i class="las la-calendar-day text-gray-600 text-lg mr-1"></i>';
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
                    dayHTML += '<span class="block text-xs text-blue-600 font-semibold mt-1"><i class="las la-star"></i></span>';
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

        function selectCalendarDate(date) {
            currentCalendarDate = new Date(date);
            renderCalendar();
        }

        function previousMonth() {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
            renderCalendar();
        }

        function nextMonth() {
            currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
            renderCalendar();
        }

        function goToToday() {
            currentCalendarDate = new Date();
            renderCalendar();
        }

        // ====================================================
        // PREVENT ZOOM & PINCH GESTURES
        // ====================================================

        // Set initial zoom to 100% and lock it
        if (window.devicePixelRatio > 1) {
            document.documentElement.style.zoom = 1 / window.devicePixelRatio;
        }

        // Prevent all zoom gestures
        let lastZoomTime = 0;
        let lastZoomLevel = 1;

        // Continuously monitor zoom level
        setInterval(function() {
            if (window.devicePixelRatio !== lastZoomLevel) {
                lastZoomLevel = window.devicePixelRatio;
                document.documentElement.style.zoom = 1;
                document.body.style.zoom = 1;
            }
        }, 100);

        // Disable pinch-to-zoom on touch devices
        document.addEventListener('touchmove', function(event) {
            if (event.touches.length > 1) {
                event.preventDefault();
            }
        }, { passive: false });

        // Disable double-tap zoom more aggressively
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function(event) {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
                return false;
            }
            lastTouchEnd = now;
        }, { passive: false });

        // Prevent zoom via keyboard
        document.addEventListener('keydown', function(event) {
            if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '-' || event.key === '0')) {
                event.preventDefault();
                return false;
            }
        });

        // Disable zoom via mouse wheel (Ctrl + scroll)
        document.addEventListener('wheel', function(event) {
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                return false;
            }
        }, { passive: false });

        // Prevent zoom on all interactive elements
        document.addEventListener('click', function(event) {
            // Reset zoom on any click
            if (window.devicePixelRatio !== 1) {
                document.documentElement.style.zoom = 1;
                document.body.style.zoom = 1;
            }
        }, true);

        // Prevent zoom on focus (especially for inputs)
        document.addEventListener('focus', function(event) {
            if (event.target.matches('input, textarea, select, button')) {
                document.documentElement.style.zoom = 1;
                document.body.style.zoom = 1;
            }
        }, true);

        // Lock viewport on resize
        window.addEventListener('resize', function() {
            if (window.innerHeight < window.innerWidth) {
                document.documentElement.style.zoom = 1;
                document.body.style.zoom = 1;
            }
        });

        // ====================================================
        // INITIALIZE ON PAGE LOAD
        // ====================================================



