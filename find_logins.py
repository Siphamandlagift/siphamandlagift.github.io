import re

with open('js/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# find anywhere we have passwords or usernames
print("EMAILS:")
emails = re.findall(r"['\"]?email['\"]?\s*:\s*['\"]([^'\"]+)['\"]", text)
print(list(set(emails)))

print("\\nPASSWORDS:")
passwords = re.findall(r"['\"]?password['\"]?\s*:\s*['\"]([^'\"]+)['\"]", text)
print(list(set(passwords)))

print("\\nALL DATA USERS:")
print(text[text.find("let allUsersData = ["):text.find("let allUsersData = [")+400])

