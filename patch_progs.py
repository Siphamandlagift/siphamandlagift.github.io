import re

file_path = 'c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

if 'id="prog-sub-existing"' in text:
    print("Already applied")
    exit()

text = text.replace('<!-- Helpful Instructions Banner -->', '''<!-- Tabs for Programme Management -->
                    <div class="border-b border-gray-200 mb-6">
                        <ul class="flex flex-wrap -mb-px text-sm font-medium text-center text-gray-500">
                            <li class="mr-2">
                                <a href="#" id="tab-prog-existing" onclick="switchProgrammeSubTab('existing', event)" class="inline-flex items-center justify-center p-4 border-b-2 border-indigo-600 text-indigo-600 rounded-t-lg active group">
                                    <i class="fas fa-list mr-2"></i> Existing Programmes
                                </a>
                            </li>
                            <li class="mr-2">
                                <a href="#" id="tab-prog-create" onclick="switchProgrammeSubTab('create', event)" class="inline-flex items-center justify-center p-4 border-b-2 border-transparent hover:text-gray-600 hover:border-gray-300 rounded-t-lg group text-gray-500">
                                    <i class="fas fa-plus-circle mr-2"></i> Create Programme
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div id="prog-sub-create" class="hidden">
                    <!-- Helpful Instructions Banner -->''', 1)

text = text.replace('<!-- Existing Programmes Table -->', '''</div>
                    <div id="prog-sub-existing">
                    <!-- Existing Programmes Table -->''', 1)

text = text.replace('<!-- Course Assignment section removed', '''</div>\n                <!-- Course Assignment section removed''', 1)

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
if 'switchProgrammeSubTab' not in text:
    text = text.replace('// Function to load and display documents for a specific course', js_to_add + '\n// Function to load and display documents for a specific course', 1)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)
print('Patched successfully!')
