// api.js - Central location for all Backend API calls

// Automatically switch between local testing and the live Afrihost server
const isLocalhost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

// Pointing to your new Afrihost Ubuntu server with HTTPS!
const LIVE_API_URL = 'https://skillsconnect-sa.co.za/api'; 

const API_BASE_URL = isLocalhost ? 'http://127.0.0.1:8000/api' : LIVE_API_URL;

// Handle real login logic through the python backend
async function loginViaBackend(email, password) {
    try {
        console.log('Attempting secure backend login for:', email);
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Login successful! Token generated.', data);
            
            // Save the secure JWT token in localStorage so we can use it for specific api calls later
            localStorage.setItem('lms_token', data.token);
            
            // Format the user to match what the frontend expects
            return {
                success: true,
                user: {
                   ...data.user,
                   fullName: data.user.name + " " + (data.user.surname || ""),
                   picture: 'https://placehold.co/96x96/ADD8E6/00008B?text=' + data.user.name.charAt(0).toUpperCase()
                }
            };
        } else {
            const err = await response.json();
            return { success: false, message: err.detail || 'Login failed' };
        }
    } catch(error) {
        console.error('Backend unreachable:', error);
        return { success: false, message: 'Could not connect to server' };
    }
}

async function fetchUsersFromBackend() {
    try {
        console.log('Fetching true users from SQLite database...');
        const response = await fetch(`${API_BASE_URL}/users`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
                console.log('Dynamically loaded users from database:', data.users);
        
        if (window.allUsersData) {
            // Clear current data completely and rely entirely on Backend
            window.allUsersData.length = 0;
            
            for (const backendUser of data.users) {
                window.allUsersData.push({
                    id: backendUser.id,   
                    name: backendUser.name,
                    surname: backendUser.surname || '',
                    email: backendUser.email,
                    idNumber: 'SA-' + Math.floor(Math.random() * 10000000), 
                    company: 'Backend Instance',
                    role: backendUser.role,
                    picture: 'https://placehold.co/40x40/10B981/FFFFFF?text=' + backendUser.name.charAt(0).toUpperCase(),
                    status: 'active',
                    password: 'password123'
                });
            }
        }

        if (typeof renderUserTable === 'function' && document.getElementById('userTableBody')) {
            renderUserTable();
        }
    } catch (error) {
        console.error('Failed to connect to Python backend. Ensure the server is running.', error);
    }
}

async function addUserToDatabase(userData) {
    try {
        console.log('Sending new user to backend database...');
        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: userData.name,
                surname: userData.surname,
                email: userData.email,
                role: userData.role,
                password: userData.password || 'password123'
            })
        });

        if (response.ok) {
            console.log('Successfully saved to true backend database!');
            await fetchUsersFromBackend();
            return true;
        } else {
            console.error('Backend returned an error');
            return false;
        }
    } catch(err) {
        console.error('Cannot post to Backend:', err);
        return false;
    }
}

window.loginViaBackend = loginViaBackend;
window.addUserToDatabase = addUserToDatabase;
window.fetchUsersFromBackend = fetchUsersFromBackend;

async function fetchCoursesFromBackend() {
    try {
        console.log('Fetching true courses from SQLite database...');
        const response = await fetch(`${API_BASE_URL}/courses`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        console.log('Dynamically loaded courses from database:', data.courses);
        
        if (window.allCoursesData) {
            window.allCoursesData.length = 0;
            
            for (const backendCourse of data.courses) {
                window.allCoursesData.push({
                    id: backendCourse.id,
                    name: backendCourse.name,
                    description: backendCourse.description,
                    students: 0,
                    instructor: 'System Admin',
                    picture: backendCourse.picture || 'https://placehold.co/400x200/e2e8f0/64748b?text=Course',
                    videos: backendCourse.videos || [],
                    questions: backendCourse.questions || [],
                    assignments: backendCourse.assignments || [],
                    completionDeadline: backendCourse.completionDeadline,
                    pdfFileName: ''
                });
            }
        }
        
        if (typeof renderCoursesTable === 'function') renderCoursesTable();
        if (typeof renderCourseCards === 'function') renderCourseCards();
    } catch (error) {
        console.error('Failed to connect to Python backend for courses:', error);
    }
}

async function addCourseToDatabase(courseData) {
    try {
        console.log('Sending new course to backend database...', courseData);
        const response = await fetch(`${API_BASE_URL}/courses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: courseData.name,
                description: courseData.description,
                completionDeadline: courseData.completionDeadline || null,
                picture: courseData.picture || null,
                videos: courseData.videos || [],
                questions: courseData.questions || [],
                assignments: courseData.assignments || []
            })
        });

        if (response.ok) {
            console.log('Successfully saved course to true backend database!');
            await fetchCoursesFromBackend();
            return true;
        } else {
            console.error('Backend returned an error');
            return false;
        }
    } catch(err) {
        console.error('Cannot post to Backend:', err);
        return false;
    }
}

window.fetchCoursesFromBackend = fetchCoursesFromBackend;
window.addCourseToDatabase = addCourseToDatabase;

