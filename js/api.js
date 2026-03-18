// api.js - Central location for all Backend API calls

const API_BASE_URL = 'http://127.0.0.1:8000/api';

async function fetchUsersFromBackend() {
    try {
        console.log('Fetching users from backend...');
        const response = await fetch(API_BASE_URL + '/users');
        const data = await response.json();
        
        console.log('Successfully fetched users from backend!', data.users);
        
        // Ensure we don't duplicate
        for (const backendUser of data.users) {
            if (!window.allUsersData) continue;
            
            const exists = window.allUsersData.find(u => u.id === backendUser.id);
            if (!exists) {
                window.allUsersData.push({
                    id: backendUser.id,
                    name: backendUser.name,
                    surname: backendUser.surname || '',
                    email: backendUser.email || 'user' + Math.floor(Math.random() * 1000) + '@test.com',
                    idNumber: 'BE-' + Math.floor(Math.random() * 10000),
                    company: 'Backend Inc',
                    role: backendUser.role,
                    picture: 'https://placehold.co/40x40/4F46E5/FFFFFF?text=' + backendUser.name.charAt(0),
                    status: 'active',
                    password: '123'
                });
            }
        }
        
        // Re-render
        if (typeof renderUserTable === 'function' && document.getElementById('userTableBody')) {
            renderUserTable();
        }
        
    } catch (error) {
        console.error('Failed to connect to Python backend:', error);
    }
}
