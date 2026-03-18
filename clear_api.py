import re

with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/js/api.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''        console.log('Dynamically loaded users from database:', data.users);
        
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
        }'''

# Replace the loop part
content = re.sub(r"console\.log\('Dynamically loaded users from database:', data\.users\);.*?if \(typeof renderUserTable", replacement + "\n\n        if (typeof renderUserTable", content, flags=re.DOTALL)

with open('c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/js/api.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("api.js updated!")
