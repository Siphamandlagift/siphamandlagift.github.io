import re

file_path = 'c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# The target HTML chunk we want to replace
target_html = '''<!-- Tabs for Programme Management -->
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

                    <div id="prog-sub-create" class="hidden">'''

replacement_html = '''<!-- Tabs for Programme Management -->
                    <div class="border-b border-gray-200 mb-6">
                        <ul class="flex flex-wrap -mb-px text-sm font-medium text-center text-gray-500">
                            <li class="mr-2">
                                <a href="#" id="tab-prog-create" onclick="switchProgrammeSubTab('create', event)" class="inline-flex items-center justify-center p-4 border-b-2 border-indigo-600 text-indigo-600 rounded-t-lg active group">
                                    <i class="fas fa-plus-circle mr-2"></i> Create Programme
                                </a>
                            </li>
                            <li class="mr-2">
                                <a href="#" id="tab-prog-existing" onclick="switchProgrammeSubTab('existing', event)" class="inline-flex items-center justify-center p-4 border-b-2 border-transparent hover:text-gray-600 hover:border-gray-300 rounded-t-lg group text-gray-500">
                                    <i class="fas fa-list mr-2"></i> Existing Programmes
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div id="prog-sub-create">'''

# Let's also hide the existing section
target_existing = '''</div>
                    <div id="prog-sub-existing">
                    <!-- Existing Programmes Table -->'''

replacement_existing = '''</div>
                    <div id="prog-sub-existing" class="hidden">
                    <!-- Existing Programmes Table -->'''

if target_html in text and target_existing in text:
    text = text.replace(target_html, replacement_html)
    text = text.replace(target_existing, replacement_existing)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print("Swapped tabs successfully.")
else:
    print("Could not find the target text to replace. Let me try regex.")
    
    # Try regex if exact match fails
    m = re.search(r'<!-- Tabs for Programme Management -->[\s\S]*?<div id="prog-sub-create" class="hidden">', text)
    if m:
        text = text[:m.start()] + replacement_html + text[m.end():]
        m2 = re.search(r'</div>\s*<div id="prog-sub-existing">\s*<!-- Existing Programmes Table -->', text)
        if m2:
            text = text[:m2.start()] + replacement_existing + text[m2.end():]
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(text)
            print("Swapped tabs using regex successfully.")
        else:
            print("Regex existing failed.")
    else:
        print("Regex failed.")
