import re

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

start_pattern = r'<div class=\"bg-white rounded-lg shadow overflow-hidden mb-6\">'
end_pattern = r'<!-- Profile Content \(Placeholder\) -->'

start_idx = text.find(start_pattern, text.find('<div id=\"my-gradesContent\"'))
end_idx = text.find(end_pattern, start_idx)

if start_idx != -1 and end_idx != -1:
    new_block = '''<div class="bg-white rounded-lg shadow overflow-hidden mb-6">
                        <div class="px-6 py-4 border-b border-gray-200">
                            <h3 class="text-lg font-semibold text-gray-800">Course Grades</h3>
                        </div>
                        <div class="p-6" id="myGradesListContainer">
                            <div class="text-center py-8 text-gray-500">
                                <i class="las la-graduation-cap text-4xl mb-3 text-gray-400"></i>
                                <p>No graded assignments found.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Profile Content (Placeholder) -->'''
    
    # We replace from start_idx to end_pattern with the new block (which includes end_pattern)
    text = text[:start_idx] + new_block + text[end_idx + len(end_pattern):]
    
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(text)
    print('Patched HTML for My Grades!')
else:
    print('Failed to find patterns')
