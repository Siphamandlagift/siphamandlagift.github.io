
        // Global variables for message modal
        const messageModal = document.getElementById('messageModal');
        const messageModalTitle = document.getElementById('messageModalTitle');
        const messageModalContent = document.getElementById('messageModalContent');

        

        

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

        

        

        // Bulk Upload Functions
        const bulkUploadModal = document.getElementById('bulkUploadModal');
        const bulkUploadForm = document.getElementById('bulkUploadForm');
        const bulkUploadFileInput = document.getElementById('bulkUploadFileInput');

        

        

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

                allUsersData.push(newUser);
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
        

        // Login functionality
        document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('loginUsernameInput').value;
            const password = document.getElementById('loginPasswordInput').value;
            const role = document.getElementById('userRoleSelect').value;
            
            // In a real app, you'd validate credentials against a backend
            // For this demo, we just find the user by name and role
            const userLoggedIn = allUsersData.find(u => u.name.toLowerCase() === username.toLowerCase() && u.role === role);

            if (!userLoggedIn) {
                showMessageModal('Login Error', 'Invalid username or role. Please try again.');
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
        

        // Load data from localStorage
        

        // --- LEARNER GROUPS MANAGEMENT ---
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
        
        // Function to get default users
        

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
            allUsersData.push(newUser); // Add new user to the global array
            saveToLocalStorage(); // Save to localStorage

            renderUserTable(); // Re-render the user table to include the new user
            updateDashboardStats(); // Update dashboard stats after adding user

            showMessageModal('Success', `${name} ${surname} has been added as a ${role.replace('_', ' ')}.`);
            hideAddUserModal();
        });

        


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
            initializeData(); // Load data from localStorage or use defaults
            
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
                // Show login modal
                document.getElementById('loginModal').classList.remove('hidden');
            }
            
            renderUserTable(); // Initial render of the user table with dummy data
            renderAllExistingCoursesTable(); // Initial render of the admin courses table
            
            // Initialize assignment event listeners
            initializeAssignmentEventListeners();
        });


        // Course Management Specific Logic
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
        
        let currentCourseQuestions = [];
        let currentCoursePdfFileName = '';
        const coursePicturePreview = document.getElementById('coursePicturePreview');
        const coursePictureInput = document.getElementById('coursePictureInput');
        const coursePdfInput = document.getElementById('coursePdfInput');
        const coursePdfFileNameDisplay = document.getElementById('coursePdfFileName');

        // Function to render question input fields based on type
        


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
        

        // Render Training Manager's Courses Table
        

        // Render ALL Existing Courses Table (for Admin overview)
        


        // PDF Viewer Modal Logic
        const pdfViewerModal = document.getElementById('pdfViewerModal');
        const pdfModalTitle = document.getElementById('pdfModalTitle');
        const simulatedPdfContentFileName = document.getElementById('simulatedPdfContentFileName');
        let currentViewingDocumentId = null; // To keep track of which document is being viewed

        

        

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
        

        // Assign Students Modal Logic
        const assignStudentsModal = document.getElementById('assignStudentsModal');
        const assignStudentsModalTitle = document.getElementById('assignStudentsModalTitle');
        const assignStudentsList = document.getElementById('assignStudentsList');
        const noStudentsAvailableMsg = document.getElementById('noStudentsAvailable');
        let currentProgrammeIdToAssign = null;

        

        
        

        

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
                        message += `\n\n✅ Added: ${addedCount} student(s)`;
                    }
                    if (removedCount > 0) {
                        message += `\n\n❌ Removed: ${removedCount} student(s)`;
                    }
                    if (addedCount > 0) {
                        message += `\n\n📚 Each newly assigned student has been enrolled in ${programmeLinkedCourses.length} course(s) from this programme.`;
                    }
                    
                    showMessageModal('Programme Assignment Updated! 🎉', message);
                    renderExistingProgramsTable(); // Re-render programme table
                    renderProgrammesForAssignmentTable(); // Re-render assignment table
                    renderAssignmentOverview(); // Update assignment overview
                    updateDashboardStats(); // Refresh dashboard counts
                }
            }
            hideAssignStudentsModal();
        });

        // Helper functions for assignment modal
        

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
        

        // Direct Course Assignment Functions
        const assignStudentsToCoursesModal = document.getElementById('assignStudentsToCoursesModal');
        const assignStudentsToCoursesModalTitle = document.getElementById('assignStudentsToCoursesModalTitle');
        const assignStudentsToCoursesList = document.getElementById('assignStudentsToCouresList');
        const noStudentsAvailableForCourse = document.getElementById('noStudentsAvailableForCourse');
        let currentCourseIdToAssign = null;

        

        

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
            const sampleNotifications = [
                {
                    id: 999,
                    title: 'Welcome to SkillsConnect',
                    message: 'Start your learning journey by exploring your assigned courses!',
                    type: 'info',
                    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    read: true
                }
            ];
            
            const notifications = [...userNotifications, ...sampleNotifications];
            
            // Sample notifications - in a real system these would come from a database
            const oldNotifications = [
                {
                    id: 1,
                    title: 'Course Completion Reminder',
                    message: 'Remember to complete "Health & Safety Fundamentals" by 25 August 2025',
                    type: 'warning',
                    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
                    read: false
                },
                {
                    id: 2,
                    title: 'Assignment Due Soon',
                    message: 'Your "Fire Safety Assessment" assignment is due in 3 days (22 January 2026)',
                    type: 'warning',
                    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
                    read: false
                },
                {
                    id: 3,
                    title: 'Course Completed',
                    message: 'Congratulations! You completed "Introduction to Web Development"',
                    type: 'success',
                    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    read: false
                },
                {
                    id: 4,
                    title: 'Badge Earned',
                    message: 'You earned the "Quick Learner" badge for completing your first 5 hours of learning',
                    type: 'info',
                    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
                    read: true
                },
                {
                    id: 5,
                    title: 'New Course Launch',
                    message: 'New course available: "Advanced Fire Safety Procedures" - Enroll now to get started!',
                    type: 'info',
                    timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000),
                    read: true
                },
                {
                    id: 6,
                    title: 'Grade Posted',
                    message: 'Your grade for "Data Science Quiz" has been posted: 88/100',
                    type: 'success',
                    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                    read: true
                },
                {
                    id: 7,
                    title: 'Training Manager Message',
                    message: 'Your trainer Jane sent you feedback: "Great progress on the latest assignments! Keep it up."',
                    type: 'info',
                    timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
                    read: true
                }
            ];
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
        // Function to get default assignments
        

        // Show the create assignment modal
        

        // Hide the create assignment modal
        

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

        

        

        

        function clearAssignmentQuestions() {
            assignmentQuestions = [];
            renderAssignmentQuestions();
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
                        showMessageModal('Selection Required ⚠️', 'Please select at least one student to assign this assignment to.');
                        return;
                    }

                    if (!title || !instructions || !dueDate) {
                        showMessageModal('Input Error ⚠️', 'Please fill all required fields:\n• Assignment Title\n• Instructions\n• Due Date');
                        return;
                    }

                    if (!documentFiles || documentFiles.length === 0) {
                        showMessageModal('Document Required ⚠️', 'Please upload at least one document (PDF, PPT, or Word file) for this assignment.');
                        return;
                    }

                    // Validate questions if added
                    if (assignmentQuestions.length > 0) {
                        const invalidQuestion = assignmentQuestions.find(q => !q.text.trim());
                        if (invalidQuestion) {
                            showMessageModal('Question Error ⚠️', `Question ${invalidQuestion.number} is empty. Please enter question text or remove it.`);
                            return;
                        }
                        
                        const totalQuestionMarks = assignmentQuestions.reduce((sum, q) => sum + q.marks, 0);
                        if (totalQuestionMarks !== totalMarks && totalMarks > 0) {
                            showMessageModal('Marks Mismatch ⚠️', `Total question marks (${totalQuestionMarks}) must equal assignment total marks (${totalMarks}).`);
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
                    const questionsInfo = assignmentQuestions.length > 0 ? `\n❓ Questions: ${assignmentQuestions.length}` : '';
                    const documentsInfo = documents.length > 1 ? `\n📎 Documents: ${documents.length} files` : `\n📎 Document: ${documents[0].fileName}`;
                    
                    showMessageModal('Assignment Created Successfully! 🎉', 
                        `Assignment "${title}" ${typeInfo}${courseInfo} has been created and assigned to:\n\n👥 ${studentList}\n\n📅 Due Date: ${new Date(dueDate).toLocaleDateString()}${documentsInfo}${questionsInfo}`);
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
        

        // Render admin all certificates table
        

        // Render certificate templates for training manager
        

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

        const studentCourses = [
          { 
            id: 1, 
            name: "Health & Safety", 
            progress: 40,
            picture: "https://images.unsplash.com/photo-1576091160399-2b6ba8a7f0f0?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
            description: "Learn essential health and safety practices in the workplace",
            sections: [
              {
                id: 101,
                title: "Introduction",
                videoDuration: "12 minutes",
                questions: [
                  {
                    id: 1,
                    type: 'multiple-choice',
                    question: 'What is the primary goal of health and safety?',
                    options: ['Maximize productivity', 'Protect worker wellbeing', 'Reduce costs', 'Increase efficiency'],
                    correctAnswer: 1
                  },
                  {
                    id: 2,
                    type: 'true-false',
                    question: 'Health and safety regulations are optional.',
                    correctAnswer: false
                  }
                ]
              },
              {
                id: 102,
                title: "Chapter 1: Workplace Hazards",
                videoDuration: "18 minutes",
                questions: [
                  {
                    id: 3,
                    type: 'multiple-choice',
                    question: 'Which of these is a common workplace hazard?',
                    options: ['Proper lighting', 'Slippery floors', 'Good ventilation', 'Ergonomic furniture'],
                    correctAnswer: 1
                  },
                  {
                    id: 4,
                    type: 'multiple-choice',
                    question: 'What should you do if you notice a hazard?',
                    options: ['Ignore it', 'Report it immediately', 'Handle it yourself', 'Wait for others to notice'],
                    correctAnswer: 1
                  }
                ]
              },
              {
                id: 103,
                title: "Chapter 2: Safety Procedures",
                videoDuration: "15 minutes",
                questions: [
                  {
                    id: 5,
                    type: 'true-false',
                    question: 'Personal Protective Equipment (PPE) is always required.',
                    correctAnswer: true
                  },
                  {
                    id: 6,
                    type: 'multiple-choice',
                    question: 'What is the first step in an emergency?',
                    options: ['Alert management', 'Ensure everyone is safe', 'Document the incident', 'Continue working'],
                    correctAnswer: 1
                  }
                ]
              }
            ]
          },
          { 
            id: 2, 
                        name: "Fire Fighting",
                        documents: [
                            {
                                id: 4003,
                                title: 'Fire Safety Training',
                                type: 'ppt',
                                fileName: 'fire_safety_training.ppt',
                                description: 'Comprehensive PowerPoint on fire detection, prevention, and emergency procedures.',
                                icon: 'las la-file-powerpoint',
                                color: 'orange',
                                isRead: true,
                                createdDate: '2023-12-20',
                                fileSize: '3.2 MB'
                            },
                            {
                                id: 4004,
                                title: 'Fire Safety Policy',
                                type: 'pdf',
                                fileName: 'fire_safety_policy.pdf',
                                description: 'PDF document outlining fire safety policies and procedures.',
                                icon: 'las la-file-pdf',
                                color: 'red',
                                isRead: true,
                                createdDate: '2023-12-20',
                                fileSize: '2.0 MB'
                            }
                        ]
                    },
                    { 
                        id: 2, 
                        name: "Fire Fighting",
            progress: 100,
            picture: "https://images.unsplash.com/photo-1559838106-d8493e3e4ffd?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
            description: "Comprehensive fire safety and firefighting procedures",
            sections: [
              {
                id: 201,
                title: "Introduction",
                videoDuration: "10 minutes",
                questions: [
                  {
                    id: 1,
                    type: 'multiple-choice',
                    question: 'What is the primary purpose of fire safety training?',
                    options: ['Save lives and property', 'Pass time', 'Look good', 'Follow rules'],
                    correctAnswer: 0
                  }
                ]
              },
              {
                id: 202,
                title: "Chapter 1: Fire Basics",
                videoDuration: "14 minutes",
                questions: [
                  {
                    id: 2,
                    type: 'true-false',
                    question: 'Fire requires oxygen, fuel, and heat to burn.',
                    correctAnswer: true
                  }
                ]
              }
            ]
          },
          { 
            id: 3, 
            name: "First Aid", 
            progress: 75,
            picture: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
            description: "Master essential first aid techniques and emergency response",
            sections: [
              {
                id: 301,
                title: "Introduction",
                videoDuration: "11 minutes",
                questions: [
                  {
                    id: 1,
                    type: 'multiple-choice',
                    question: 'What is first aid?',
                    options: ['Medical treatment', 'Emergency care before professional help', 'Medicine', 'Surgery'],
                    correctAnswer: 1
                  }
                ]
              },
              {
                id: 302,
                title: "Chapter 1: CPR & Recovery Position",
                videoDuration: "20 minutes",
                questions: [
                  {
                    id: 2,
                    type: 'true-false',
                    question: 'CPR should be performed on all unconscious people.',
                    correctAnswer: false
                  }
                ]
              },
              {
                id: 303,
                title: "Chapter 2: Wound Care",
                videoDuration: "16 minutes",
                questions: [
                  {
                    id: 3,
                    type: 'multiple-choice',
                    question: 'What is the first step in treating a wound?',
                    options: ['Apply bandage', 'Stop the bleeding', 'Disinfect', 'Call emergency'],
                    correctAnswer: 1
                  }
                ]
              }
            ]
          }
];



// Function to display student's assigned programmes


// Function to view programme details


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
window.viewStudentCourse = 



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
    if (!course) return; let sections = course.sections || course.videos; if(!sections) return;

    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    document.getElementById('sectionTitle').textContent = section.title;
    document.getElementById('courseVideoDuration').textContent = section.videoDuration || section.duration || 'N/A';

    const videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer) {
        let vidUrl = section.videoUrl || section.url;
        if (vidUrl) {
            let embedUrl = vidUrl;
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
        } else if (section.fileName || section.isFile) {
            videoPlayer.innerHTML = `
                <div class="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center">
                    <i class="las la-file-video text-6xl text-blue-400 mb-4 transition animate-pulse"></i>
                    <p class="text-white text-xl font-medium mb-2">Simulated Local Video</p>
                    <p class="text-gray-400 text-sm">File: ${section.fileName || 'uploaded_video.mp4'}</p>
                    <div class="mt-6 w-64 bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div class="bg-blue-500 h-2 rounded-full w-1/3"></div>
                    </div>
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
                        <div class="flex flex-col">
                            <h4 class="text-lg font-semibold text-gray-800">${qText}</h4>
                            <span class="text-sm text-gray-500 mt-1">Assign a ranking number to each item (1 = first, ${items.length} = last).</span>
                        </div>
                    </div>
                    <div class="space-y-3 ml-11 mt-3">
                        ${items.map((item, iIndex) => `
                            <div class="flex items-center gap-3 p-2 bg-white rounded border border-gray-100 shadow-sm">
                                <input type="number" min="1" max="${items.length}" name="question-${q.id}-order-${iIndex}" data-item="${item.replace(/"/g, '&quot;')}" class="w-16 p-2 border border-gray-300 rounded-md text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200" placeholder="#">
                                <span class="text-gray-700 font-medium">${item}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (q.type === 'long-answer') {
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
                                        ${(typeof loggedInUser !== "undefined" && loggedInUser && loggedInUser.role === "training-manager") ? `<a href="${doc.fileUrl}" download="${doc.fileName}" class="text-green-600 hover:text-green-800 text-xs px-2 py-1"><i class="las la-download"></i></a>` : ""}
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
                        const userOrders = [];
                        for (let iIndex = 0; iIndex < q.correctOrder.length; iIndex++) {
                            const inputEl = document.querySelector(`input[name="question-${q.id}-order-${iIndex}"]`);
                            if (!inputEl || !inputEl.value) {
                                isAnswered = false;
                                isCorrect = false;
                                break;
                            }
                            userOrders.push({
                                item: inputEl.getAttribute('data-item'),
                                rank: parseInt(inputEl.value)
                            });
                        }
                        
                        if (isAnswered) {
                            userOrders.sort((a, b) => a.rank - b.rank);
                            const userSortedItems = userOrders.map(o => o.item);
                            for (let i = 0; i < q.correctOrder.length; i++) {
                                if (userSortedItems[i] !== q.correctOrder[i]) {
                                    isCorrect = false;
                                    break;
                                }
                            }
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
        // Function to get default certificates
        

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
        // Function to get default badges
        
        studentBadgesData = [
            { studentId: 3, badgeId: 1, earnedDate: '2024-01-15' },
            { studentId: 3, badgeId: 2, earnedDate: '2024-02-20' },
            { studentId: 4, badgeId: 1, earnedDate: '2024-02-10' }
        ];

        // Rollout assignments: documents required to be read by students
        // Each entry: { id, courseId, documentId, studentId, assignedBy, assignedDate, isRead, readDate }
        documentRollouts = [];
        
        // Student notifications system
        studentNotifications = [];

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
        

        // Function to show badge details
        

        // Function to close badge viewer
        function closeBadgeViewer() {
            document.getElementById('badgeViewerModal').classList.add('hidden');
            document.getElementById('badgeViewerModal').classList.remove('show');
        }

        // Function to render created badges table (for training managers)
        

        // Function to render all badges table (for admin)
        

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

        window.showViewAssignmentModal = 

        window.hideViewAssignmentModal = 

        // Render Training Manager's Assignments Table
        

        // Render Student's Assignments List
        

        // Function to view assignment documents
        window.viewAssignmentDocument = 



        // ====================================================
        // CALENDAR FUNCTIONALITY FOR STUDENTS
        // ====================================================

        let currentCalendarDate = new Date();
        calendarEvents = [
            { date: new Date(2026, 0, 25), title: 'JavaScript Assignment Due', type: 'assignment', color: 'blue' },
            { date: new Date(2026, 0, 28), title: 'Web Development Test', type: 'test', color: 'orange' },
            { date: new Date(2026, 1, 5), title: 'Mid-term Exam', type: 'exam', color: 'red' },
            { date: new Date(2026, 1, 10), title: 'React Project Due', type: 'assignment', color: 'blue' },
            { date: new Date(2026, 1, 15), title: 'CSS Quiz', type: 'test', color: 'orange' },
            { date: new Date(2026, 1, 22), title: 'Final Exam', type: 'exam', color: 'red' },
        ];

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
                'assignment': '📝',
                'test': '✏️',
                'exam': '📚'
            };
            return icons[type] || '📌';
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

        document.addEventListener('DOMContentLoaded', function() {
            // Reset zoom on load
            document.documentElement.style.zoom = 1;
            document.body.style.zoom = 1;
            
            // Reset body display properties
            document.body.style.display = '';
            document.body.style.flexDirection = '';
            document.body.style.alignItems = '';
            document.body.style.justifyContent = '';
            document.body.style.minHeight = '';
            
            // Set default user info if not set
            const sidebarUsername = document.getElementById('sidebarUsername');
            const sidebarUserrole = document.getElementById('sidebarUserrole');
            const topNavUsername = document.getElementById('topNavUsername');
            const greetingName = document.getElementById('greetingName');
            
            if (!sidebarUsername.textContent) {
                sidebarUsername.textContent = 'Admin User';
                sidebarUserrole.textContent = 'Administrator';
                topNavUsername.textContent = 'Admin User';
                greetingName.textContent = 'Admin';
            }
            
            // Hide sidebar and content initially - show only after login
            const sidebar = document.getElementById('sidebar');
            const contentArea = document.getElementById('contentArea');
            const main = document.querySelector('main');
            
            if (sidebar) sidebar.style.display = 'none';
            if (contentArea) contentArea.style.display = 'none';
            if (main) main.style.display = 'none';
            
            // Hide nav sections by default
            const adminNav = document.getElementById('adminNav');
            const trainingManagerNav = document.getElementById('trainingManagerNav');
            const studentNav = document.getElementById('studentNav');
            
            if (adminNav) adminNav.classList.add('hidden');
            if (trainingManagerNav) trainingManagerNav.classList.add('hidden');
            if (studentNav) studentNav.classList.add('hidden');
            
            // Show login modal - requires authentication
            const loginModal = document.getElementById('loginModal');
            if (loginModal) {
                loginModal.classList.remove('hidden');
            }
            
            // Set first section as active
            const firstSection = document.querySelector('.content-section');
            if (firstSection) {
                firstSection.classList.add('active');
            }
            
            // Initialize calendar for students
            renderCalendar();
        });

