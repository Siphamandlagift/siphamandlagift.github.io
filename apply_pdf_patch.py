with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Update viewDocument Modal to show exact PDF if fileUrl exists
# Replace the <div class="bg-blue-50 ...> ... </div> with dynamic iframe logic

patch1 = """
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <p class="text-sm text-blue-800">
                            <i class="fas fa-info-circle mr-2"></i>
                            This is a simulated document viewer. In a production environment, this would display the actual ${doc.type.toUpperCase()} file content.
                        </p>
                    </div>
"""

replacement1 = """
                    ${(doc.fileUrl && (doc.type.toUpperCase() === 'PDF')) ? 
                        `<iframe src="${doc.fileUrl}#toolbar=0" class="w-full h-[500px] border border-gray-300 rounded-lg mb-6" oncontextmenu="return false;"></iframe>` : 
                        `<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                            <p class="text-sm text-blue-800">
                                <i class="fas fa-info-circle mr-2"></i>
                                ${(doc.fileUrl && doc.type.toUpperCase() !== 'PDF') ? 'Document attached but cannot be previewed natively in the browser without downloading.' : 'This is a simulated document viewer. In a production environment, this would display the actual ' + doc.type.toUpperCase() + ' file content.'}
                            </p>
                        </div>`
                    }
"""

text = text.replace(patch1, replacement1)

# Update viewAssignmentDocument identically
patch2 = """
                            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
                                <p class="text-sm text-blue-800">
                                    <i class="fas fa-info-circle mr-2"></i>
                                    This is a simulated document viewer. In a production environment, this would display the actual ${typeLabel.toLowerCase()} content using an embedded viewer.
                                </p>
                            </div>
"""

replacement2 = """
                            ${(fileUrl && fileType === 'PDF') ? 
                                `<iframe src="${fileUrl}#toolbar=0" class="w-full h-[500px] border border-gray-300 rounded-lg mb-6" oncontextmenu="return false;"></iframe>` : 
                                `<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
                                    <p class="text-sm text-blue-800">
                                        <i class="fas fa-info-circle mr-2"></i>
                                        ${(fileUrl && fileType !== 'PDF') ? 'Document attached but cannot be previewed natively in the browser without downloading.' : 'This is a simulated document viewer. In a production environment, this would display the actual ' + typeLabel.toLowerCase() + ' content using an embedded viewer.'}
                                    </p>
                                </div>`
                            }
"""

text = text.replace(patch2, replacement2)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS")