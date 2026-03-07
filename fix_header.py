import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Update the notifications dropdown 
# Original:
# <div class="dropdown-menu hidden mt-2 w-64 bg-white rounded-md shadow-lg py-1">
#     <div class="px-4 py-2 border-b border-gray-200">
#         <h3 class="text-sm font-semibold text-gray-800">Notifications</h3>
#     </div>
#     <p class="block px-4 py-2 text-sm text-gray-700">No new notifications.</p>
#     <div class="px-4 py-2 border-t border-gray-200">
#         <a href="#" class="text-xs text-indigo-600 hover:underline">View all notifications</a>
#     </div>
# </div>

old_notifications = '''                            <button type="button" class="text-gray-600 focus:outline-none relative" onclick="toggleDropdown(this)">
                                <i class="fas fa-bell text-xl"></i>
                                <span class="notification-badge bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">0</span>
                            </button>
                            <div class="dropdown-menu hidden mt-2 w-64 bg-white rounded-md shadow-lg py-1">
                                <div class="px-4 py-2 border-b border-gray-200">
                                    <h3 class="text-sm font-semibold text-gray-800">Notifications</h3>
                                </div>
                                <p class="block px-4 py-2 text-sm text-gray-700">No new notifications.</p>
                                <div class="px-4 py-2 border-t border-gray-200">
                                    <a href="#" class="text-xs text-indigo-600 hover:underline">View all notifications</a>
                                </div>
                            </div>'''

new_notifications_and_messages = '''                            <!-- Messages Dropdown -->
                            <div class="relative dropdown mr-2">
                                <button type="button" class="text-gray-600 hover:text-indigo-600 focus:outline-none relative transition" onclick="toggleDropdown(this)" title="Messages">
                                    <i class="fas fa-envelope text-xl"></i>
                                    <span class="notification-badge bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">2</span>
                                </button>
                                <div class="dropdown-menu hidden absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                                    <div class="px-4 py-2 border-b border-gray-200">
                                        <h3 class="text-sm font-semibold text-gray-800">Messages</h3>
                                    </div>
                                    <div class="max-h-60 overflow-y-auto">
                                        <a href="#" class="block px-4 py-3 border-b border-gray-100 hover:bg-gray-50 dropdown-nav-link" data-section="messages">
                                            <p class="text-sm font-semibold text-gray-800">Jane Manager</p>
                                            <p class="text-xs text-gray-600 truncate">Assignment Submission Guidelines...</p>
                                        </a>
                                        <a href="#" class="block px-4 py-3 hover:bg-gray-50 dropdown-nav-link" data-section="messages">
                                            <p class="text-sm font-semibold text-gray-800">Admin User</p>
                                            <p class="text-xs text-gray-600 truncate">System Maintenance Notice</p>
                                        </a>
                                    </div>
                                    <div class="px-4 py-2 border-t border-gray-200 text-center">
                                        <a href="#" class="text-xs text-indigo-600 hover:underline font-medium dropdown-nav-link" data-section="messages">View all messages</a>
                                    </div>
                                </div>
                            </div>

                            <!-- Notifications Dropdown -->
                            <button type="button" class="text-gray-600 hover:text-indigo-600 focus:outline-none relative transition" onclick="toggleDropdown(this)" title="Notifications">
                                <i class="fas fa-bell text-xl"></i>
                                <span class="notification-badge bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">5</span>
                            </button>
                            <div class="dropdown-menu hidden absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                                <div class="px-4 py-2 border-b border-gray-200">
                                    <h3 class="text-sm font-semibold text-gray-800">Notifications</h3>
                                </div>
                                <div class="max-h-60 overflow-y-auto">
                                    <a href="#" class="block px-4 py-3 border-b border-gray-100 hover:bg-gray-50 dropdown-nav-link" data-section="notifications">
                                        <p class="text-sm font-semibold text-gray-800">Assignment Due Soon</p>
                                        <p class="text-xs text-gray-600 truncate">React Project assignment is due in 3 days</p>
                                    </a>
                                </div>
                                <div class="px-4 py-2 border-t border-gray-200 text-center">
                                    <a href="#" class="text-xs text-indigo-600 hover:underline font-medium dropdown-nav-link" data-section="notifications">View all notifications</a>
                                </div>
                            </div>'''

if old_notifications in html:
    html = html.replace(old_notifications, new_notifications_and_messages)
    print("Replaced dropdowns successfully.")
else:
    print("Could not find exact old_notifications string, trying regex.")
    
    html = re.sub(r'<button type="button"\s+class="text-gray-600 focus:outline-none relative"\s+onclick="toggleDropdown\(this\)">\s*<i class="fas fa-bell text-xl"></i>\s*<span class="notification-badge[^>]+>0</span>\s*</button>\s*<div class="dropdown-menu hidden mt-2 w-64 bg-white rounded-md shadow-lg py-1">\s*<div class="px-4 py-2 border-b border-gray-200">\s*<h3 class="text-sm font-semibold text-gray-800">Notifications</h3>\s*</div>\s*<p class="block px-4 py-2 text-sm text-gray-700">No new notifications\.</p>\s*<div class="px-4 py-2 border-t border-gray-200">\s*<a href="#" class="text-xs text-indigo-600 hover:underline">View all notifications</a>\s*</div>\s*</div>', new_notifications_and_messages, html, flags=re.DOTALL)


with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
