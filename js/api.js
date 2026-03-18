// api.js - Central location for all Backend API calls

const API_BASE_URL = 'http://127.0.0.1:8000/api';

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
        
        for (const backendUser of data.users) {
            if (!window.allUsersData) continue;
            
            const exists = window.allUsersData.find(u => u.email === backendUser.email);
            if (!exists) {
                window.allUsersData.push({
                    id: backendUser.id,   
                    name: backendUser.name,
                    surname: backendUser.surname || '',
                    email: backendUser.email,
                    idNumber: 'SA-' + Math.floor(Math.random() * 10000000), 
                    company: 'Backend Instance',
                    role: backendUser.role,
                    picture: 'https://placehold.co/40x40/10B981/FFFFFF?text=' + backendUser.name.charAt(0),
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
