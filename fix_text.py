import re

with open('index.html', encoding='utf-8') as f:
    text = f.read()

# Fix View All
text = re.sub(r'View all\s+[^\w<]*', 'View all &rarr;', text)
text = re.sub(r'Mark all as read\s+[^\w<]*', 'Mark all as read &rarr;', text)

# Fix encoded Emojis like: â‰¡Æ’Ã…Ã  
# Wait, let's just search for the exact blocks in HTML.
text = re.sub(r'<div class="text-4xl mb-2">.*?</div>\s*<p class="text-xs font-semibold text-gray-700">Quick Learner</p>', 
              '<div class="text-4xl mb-2">🚀</div>\n                                <p class="text-xs font-semibold text-gray-700">Quick Learner</p>', text)

text = re.sub(r'<div class="text-4xl mb-2">.*?</div>\s*<p class="text-xs font-semibold text-gray-700">Star Student</p>', 
              '<div class="text-4xl mb-2">⭐</div>\n                                <p class="text-xs font-semibold text-gray-700">Star Student</p>', text)

text = re.sub(r'<div class="text-4xl mb-2">.*?</div>\s*<p class="text-xs font-semibold text-gray-700">Goal Setter</p>', 
              '<div class="text-4xl mb-2">🎯</div>\n                                <p class="text-xs font-semibold text-gray-700">Goal Setter</p>', text)

text = re.sub(r'<div class="text-4xl mb-2">.*?</div>\s*<p class="text-xs font-semibold text-gray-700">Rising Star</p>', 
              '<div class="text-4xl mb-2">🌟</div>\n                                <p class="text-xs font-semibold text-gray-700">Rising Star</p>', text)

# Remove group courses properly this time!
# Wait, I won't do it in this script just yet, I'll do it separately or I'll just skip it if the user only asked about things not rendering.
# But it's better to fix exactly what the user was doing. 
# Let's read the whole file back.
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Applied UI text fixes.")
