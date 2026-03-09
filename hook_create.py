import re
file_path = 'c:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Add auto-switch to existing when creating a programme
if "switchProgrammeSubTab('existing')" not in text[text.find("document.getElementById('createProgrammeForm').addEventListener('submit',"):text.find("document.getElementById('createProgrammeForm').addEventListener('submit',")+3000]:
    # Look for renderProgrammesTotalCount()
    # Or showMessageModal('Success', 'Programme created successfully!')
    
    m = re.search(r'(showMessageModal\(\'Success\', \'Programme created successfully!\'\);)', text)
    if m:
        text = text[:m.start()] + "switchProgrammeSubTab('existing');\n                " + text[m.start():]
        with open(file_path, 'w', encoding='utf-8') as f: f.write(text)
        print("Hooked switch for create.")
    else:
        print("Could not find the success message.")

