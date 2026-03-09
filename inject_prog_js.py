import re

file_path = 'c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

js_to_add = '''
// Function to switch programme sub-tabs
function switchProgrammeSubTab(tab, event) {
    if(event) event.preventDefault();
    
    document.getElementById('prog-sub-existing').classList.add('hidden');
    document.getElementById('prog-sub-create').classList.add('hidden');
    
    document.getElementById('tab-prog-existing').className = 'inline-flex items-center justify-center p-4 border-b-2 border-transparent hover:text-gray-600 hover:border-gray-300 rounded-t-lg group text-gray-500';
    document.getElementById('tab-prog-create').className = 'inline-flex items-center justify-center p-4 border-b-2 border-transparent hover:text-gray-600 hover:border-gray-300 rounded-t-lg group text-gray-500';
    
    document.getElementById('prog-sub-' + tab).classList.remove('hidden');
    document.getElementById('tab-prog-' + tab).className = 'inline-flex items-center justify-center p-4 border-b-2 border-indigo-600 text-indigo-600 rounded-t-lg active group';
}
'''

if 'function switchProgrammeSubTab' not in text:
    # Inject after switchCourseTab
    m = re.search(r'(function switchCourseTab\(tab, event\)\s*\{[\s\S]*?\n\})', text)
    if m:
        text = text[:m.end()] + "\n\n" + js_to_add + text[m.end():]
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print("Injected JS successfully.")
    else:
        print("Could not find switchCourseTab.")
else:
    print("Function already exists!")
