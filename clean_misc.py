import re
with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove the test users note from login screen if anyone sees it
text = re.sub(r'<span class="text-gray-500">Test users: admin, jane, alice, bob, charlie, diana, ethan, fiona</span>', '', text)

# Change the default profile data from the CSV Template:
text = text.replace('John Doe,john@example.com,EMP001,TechCorp,student,password123', 'student_name,student@domain.com,12345,Company_A,student,strongpass')
text = text.replace('Jane Smith,jane@example.com,EMP002,TechCorp,training_manager,password123', 'manager_name,manager@domain.com,67890,Company_B,training_manager,strongpass')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)
