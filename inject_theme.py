import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('theme.css', 'r', encoding='utf-8') as f:
    css = f.read()

# insert CSS if not present
if '/* Theme Override CSS */' not in html:
    html = html.replace('</head>', f'<style>\n{css}\n</style>\n</head>')

# HTML for theme switcher
theme_html = '''
                        <!-- Theme Selector -->
                        <div class="relative dropdown">
                            <button type="button" class="text-gray-600 focus:outline-none relative transition hover:text-indigo-600 mx-2 flex items-center" onclick="toggleDropdown(this)" title="Theme">
                                <i class="fas fa-palette text-xl"></i>
                            </button>
                            <div class="dropdown-menu hidden absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg py-1 border border-gray-200 z-[60]">
                                <div class="px-4 py-2 border-b border-gray-200">
                                    <h3 class="text-sm font-semibold text-gray-800">Theme</h3>
                                </div>
                                <button type="button" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 theme-btn" onclick="setTheme('white')">
                                    <span class="w-4 h-4 rounded-full bg-white border border-gray-300"></span> Light
                                </button>
                                <button type="button" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 theme-btn" onclick="setTheme('dark')">
                                    <span class="w-4 h-4 rounded-full bg-gray-900 border border-gray-600"></span> Dark
                                </button>
                                <button type="button" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 theme-btn" onclick="setTheme('purple')">
                                    <span class="w-4 h-4 rounded-full bg-purple-900 border border-purple-600"></span> Purple
                                </button>
                                <button type="button" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 theme-btn" onclick="setTheme('grey')">
                                    <span class="w-4 h-4 rounded-full bg-gray-600 border border-gray-400"></span> Grey
                                </button>
                            </div>
                        </div>'''

if '<!-- Theme Selector -->' not in html:
    # Replace directly before the notification bell dropdown
    # Let's target the exact bell button structure we found in index.html earlier
    bell_pattern = r'(<div class="relative dropdown">\s*<button type="button" class="text-gray-600 focus:outline-none relative" onclick="toggleDropdown\(this\)">\s*<i class="fas fa-bell)'
    html = re.sub(bell_pattern, theme_html + r'\n                        \1', html)

# Add setTheme JS function before closing body
js_code = '''
    <!-- Theme Management -->
    <script>
        function setTheme(theme) {
            document.body.className = document.body.className.replace(/\\btheme-[a-zA-Z0-9]+\\b/g, '').trim();
            if(theme !== 'white') document.body.classList.add('theme-' + theme);
            localStorage.setItem('appTheme', theme);
        }
        
        document.addEventListener('DOMContentLoaded', () => {
            const savedTheme = localStorage.getItem('appTheme') || 'white';
            setTheme(savedTheme);
        });
    </script>
'''

if 'function setTheme(' not in html:
    html = html.replace('</body>', f'{js_code}\n</body>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Theme injection complete.")
