import re
text = open('index.html', encoding='utf-8').read()
text = re.sub(r'<div class="mb-4">\s*<h5 class="text-sm font-semibold text-gray-700 mb-2"><i class="fas fa-book text-indigo-500 mr-2"></i>Assign Courses to Group</h5>\s*<div class="p-3 bg-gray-50 border border-gray-200 rounded-md max-h-48 overflow-y-auto" id="groupCoursesList">\s*<!-- Course checkboxes will be loaded here -->\s*</div>\s*</div>', '', text)
open('index.html', 'w', encoding='utf-8').write(text)

