with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# 1
text = re.sub(
    r'<a href=\"\$\{doc\.fileUrl\}\" download=\"\$\{doc\.fileName\}\" class=\"text-green-600 hover:text-green-800 text-xs px-2 py-1\">\s*<i class=\"fas fa-download\"></i>\s*</a>',
    r'${(typeof loggedInUser !== "undefined" && loggedInUser && loggedInUser.role === "training-manager") ? `<a href="${doc.fileUrl}" download="${doc.fileName}" class="text-green-600 hover:text-green-800 text-xs px-2 py-1"><i class="fas fa-download"></i></a>` : ""}',
    text
)

# 2
text = re.sub(
    r'<a href=\"\$\{doc\.fileUrl\}\" download=\"\$\{doc\.fileName\}\" class=\"text-green-600 hover:text-green-800 px-3 py-1 text-sm\">\s*<i class=\"fas fa-download\"></i>\s*</a>',
    r'${(typeof loggedInUser !== "undefined" && loggedInUser && loggedInUser.role === "training-manager") ? `<a href="${doc.fileUrl}" download="${doc.fileName}" class="text-green-600 hover:text-green-800 px-3 py-1 text-sm"><i class="fas fa-download"></i></a>` : ""}',
    text
)

# 3
text = re.sub(
    r'<a href=\"\$\{file\.fileUrl\}\" download=\"\$\{file\.fileName\}\" class=\"text-green-600 hover:text-green-800 text-xs px-2\">\s*<i class=\"fas fa-download\"></i>\s*</a>',
    r'${(typeof loggedInUser !== "undefined" && loggedInUser && loggedInUser.role === "training-manager") ? `<a href="${file.fileUrl}" download="${file.fileName}" class="text-green-600 hover:text-green-800 text-xs px-2"><i class="fas fa-download"></i></a>` : ""}',
    text
)

# 4
text = re.sub(
    r'<a href=\"\$\{fileUrl\}\" download=\"\$\{fileName\}\" class=\"px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition\">\s*<i class=\"fas fa-download mr-2\"></i>Download\s*</a>',
    r'${(typeof loggedInUser !== "undefined" && loggedInUser && loggedInUser.role === "training-manager") ? `<a href="${fileUrl}" download="${fileName}" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"><i class="fas fa-download mr-2"></i>Download</a>` : ""}',
    text
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS")