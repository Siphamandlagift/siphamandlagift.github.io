import re

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# We want to find the section between the end of Notifications Dropdown and the start of User Dropdown
pattern = r'(<!-- Notifications Dropdown -->.*?</div>\s*</div>)\s*</div>\s*(<div class="relative dropdown">\s*<button type="button" class="flex items-center focus:outline-none" onclick="toggleDropdown\(this\)">\s*<img[^>]+id="topNavUserAvatar">)'

# Wait, let's just do a string replacement of the specific block
# The issue is:
#                             </div>
#                         </div>
#                         </div>
#
#                         <div class="relative dropdown">
#                             <button type="button" class="flex items-center focus:outline-none" onclick="toggleDropdown(this)">
#                                 <img src="https://placehold.co/32x32/FF5733/FFFFFF?text=U" alt="User" class="w-8 h-8 rounded-full" id="topNavUserAvatar">

bad_block = '''                            </div>
                        </div>
                        </div>

                        <div class="relative dropdown">
                            <button type="button" class="flex items-center focus:outline-none" onclick="toggleDropdown(this)">
                                <img src="https://placehold.co/32x32/FF5733/FFFFFF?text=U" alt="User" class="w-8 h-8 rounded-full" id="topNavUserAvatar">'''

good_block = '''                            </div>
                        </div>

                        <div class="relative dropdown">
                            <button type="button" class="flex items-center focus:outline-none" onclick="toggleDropdown(this)">
                                <img src="https://placehold.co/32x32/FF5733/FFFFFF?text=U" alt="User" class="w-8 h-8 rounded-full" id="topNavUserAvatar">'''

if bad_block in text:
    text = text.replace(bad_block, good_block)
    print("Fixed extra div!")
else:
    print("Could not find the exact string. Trying regex.")
    text = re.sub(r'</div>\s*</div>\s*</div>\s*<div class="relative dropdown">\s*<button type="button" class="flex items-center focus:outline-none" onclick="toggleDropdown\(this\)">\s*<img src="[^"]+" alt="User" class="[^"]+" id="topNavUserAvatar">',
                  r'</div>\n                        </div>\n\n                        <div class="relative dropdown">\n                            <button type="button" class="flex items-center focus:outline-none" onclick="toggleDropdown(this)">\n                                <img src="https://placehold.co/32x32/FF5733/FFFFFF?text=U" alt="User" class="w-8 h-8 rounded-full" id="topNavUserAvatar">',
                  text)
    print("Regex apply complete.")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)

