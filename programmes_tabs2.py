import re

file_path = 'c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Make sure we don't apply twice
if 'id="prog-sub-existing"' in text:
    print("Already applied!")
    exit()

# 1. Insert Tabs before Helpful Instructions
text = text.replace('<!-- Helpful Instructions Banner -->', '''<!-- Tabs for Programme Management -->
                    <div class="border-b border-gray-200 mb-6">
                        <ul class="flex flex-wrap -mb-px text-sm font-medium text-center text-gray-500">
                            <li class="mr-2">
                                <a href="#" id="tab-prog-existing" onclick="switchProgrammeSubTab('existing', event)" class="inline-flex items-center justify-center p-4 border-b-2 border-indigo-600 text-indigo-600 rounded-t-lg active group">
                                    <i class="fas fa-list mr-2"></i> Existing Programmes
                                </a>
                            </li>
                            <li class="mr-2">
                                <a href="#" id="tab-prog-create" onclick="switchProgrammeSubTab('create', event)" class="inline-flex items-center justify-center p-4 border-b-2 border-transparent hover:text-gray-600 hover:border-gray-300 rounded-t-lg group">
                                    <i class="fas fa-plus-circle mr-2"></i> Create Programme
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div id="prog-sub-create" class="hidden">
                    <!-- Helpful Instructions Banner -->''', 1)

# 2. Close Create Section and Start Existing Section
text = text.replace('<!-- Existing Programmes Table -->', '''</div>

                    <div id="prog-sub-existing">
                    <!-- Existing Programmes Table -->''', 1)

# 3. Find the end of Existing Programmes Table to close its div
# It ends right before the next <div id="xxxContent" or just closing the main div.
# Actually, I can just inject the closing div </div> at the end of 'programme-managementContent'
# How do I find it?
# The div#programme-managementContent ends when the next <div id="user-managementContent" class="content-section"> begins
# Let's check what comes next.
# Usually, another content-section.
