import re

file_path = 'c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the HTML
target_regex = r'(<!-- Helpful Instructions Banner -->[\s\S]*?(?=<!-- Assign Students to Programmes Modal -->))'

m = re.search(target_regex, text)
if not m:
    print("Could not find the target section")
    exit()

block = m.group(1)

# Now we construct the new block by splitting it at <!-- Existing Programmes Table -->
split_m = re.search(r'(<!-- Existing Programmes Table -->[\s\S]*)', block)
if not split_m:
    print("Could not split the block")
    exit()

create_section = block[:split_m.start()]
existing_section = split_m.group(1)

new_html = f"""<!-- Tabs for Programme Management -->
                    <div class=\"border-b border-gray-200 mb-6\">
                        <ul class=\"flex flex-wrap -mb-px text-sm font-medium text-center text-gray-500\">
                            <li class=\"mr-2\">
                                <a href=\"#\" id=\"tab-prog-existing\" onclick=\"switchProgrammeSubTab('existing', event)\" class=\"inline-flex items-center justify-center p-4 border-b-2 border-indigo-600 text-indigo-600 rounded-t-lg active group\">
                                    <i class=\"fas fa-list mr-2\"></i> Existing Programmes
                                </a>
                            </li>
                            <li class=\"mr-2\">
                                <a href=\"#\" id=\"tab-prog-create\" onclick=\"switchProgrammeSubTab('create', event)\" class=\"inline-flex items-center justify-center p-4 border-b-2 border-transparent hover:text-gray-600 hover:border-gray-300 rounded-t-lg group\">
                                    <i class=\"fas fa-plus-circle mr-2\"></i> Create Programme
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div id=\"prog-sub-existing\">
                        {existing_section}
                    </div>

                    <div id=\"prog-sub-create\" class=\"hidden\">
                        {create_section}
                    </div>
"""

text = text.replace(block, new_html)

# Add the switch function
js_to_add = """
// Function to switch programme sub-tabs
function switchProgrammeSubTab(tab, event) {
    if(event) event.preventDefault();
    
    document.getElementById('prog-sub-existing').classList.add('hidden');
    document.getElementById('prog-sub-create').classList.add('hidden');
    
    document.getElementById('tab-prog-existing').className = 'inline-flex items-center justify-center p-4 border-b-2 border-transparent hover:text-gray-600 hover:border-gray-300 rounded-t-lg group';
    document.getElementById('tab-prog-create').className = 'inline-flex items-center justify-center p-4 border-b-2 border-transparent hover:text-gray-600 hover:border-gray-300 rounded-t-lg group';
    
    document.getElementById('prog-sub-' + tab).classList.remove('hidden');
    document.getElementById('tab-prog-' + tab).className = 'inline-flex items-center justify-center p-4 border-b-2 border-indigo-600 text-indigo-600 rounded-t-lg active group';
}
"""

if 'function switchProgrammeSubTab' not in text:
    js_m = re.search(r'function switchCourseTab\(.*?\)\s*\{[\s\S]*?\}', text)
    if js_m:
        text = text[:js_m.end()] + "\n" + js_to_add + text[js_m.end():]
    else:
        # Fallback to appending near the end of functions
        js_m = re.search(r'// Function to populate generic assignment selection', text)
        if js_m:
            text = text[:js_m.start()] + js_to_add + "\n" + text[js_m.start():]
        else:
            text += js_to_add


with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Programme sub-tabs injected.")
