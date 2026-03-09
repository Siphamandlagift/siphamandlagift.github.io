import re

with open('index.html', encoding='utf-8') as f:
    text = f.read()

pattern = r"const notifications = \[\.\.\.userNotifications, \.\.\.sampleNotifications\];.*?const oldNotifications = \[.*?\];"

match = re.search(pattern, text, re.DOTALL)
if match:
    old_block = match.group(0)
    new_block = old_block + "\n            // Ensure they are fully sorted\n            notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));\n            // User requested ONLY the latest notification\n            const notificationsToShow = notifications.slice(0, 1);\n"

    text = text.replace(old_block, new_block)
    
    text = text.replace("notifications.forEach(notification => {", "notificationsToShow.forEach(notification => {")

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Patched successfully")
else:
    print("Could not find block")
