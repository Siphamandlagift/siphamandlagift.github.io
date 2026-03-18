function showAssessmentSuccess(message) {
            const overlay = document.getElementById('assessmentSuccessOverlay');
            const content = document.getElementById('assessmentSuccessContent');
            const msgEl = document.getElementById('assessmentSuccessMessage');
            let svg = document.getElementById('successTickSvg');
            
            msgEl.textContent = message;
            
            overlay.classList.remove('hidden');
            void overlay.offsetWidth;
            
            overlay.classList.remove('opacity-0');
            content.classList.remove('scale-95');
            content.classList.add('scale-100');
            
            svg.classList.remove('hidden');
            const newSvg = svg.cloneNode(true);
            svg.parentNode.replaceChild(newSvg, svg);
        }

        function closeAssessmentSuccess() {
            const overlay = document.getElementById('assessmentSuccessOverlay');
            const content = document.getElementById('assessmentSuccessContent');
            
            overlay.classList.add('opacity-0');
            content.classList.remove('scale-100');
            content.classList.add('scale-95');
            
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, 300);
        }
    
        function readFullMessage(element) {
            // Check if it's currently unread by looking for the span
            const badge = Array.from(element.querySelectorAll('span')).find(s => s.textContent.trim() === 'Unread');
            
            if (badge) {
                // Change to Read
                badge.textContent = 'Read';
                badge.className = 'inline-block mt-2 px-2 py-1 text-xs bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 rounded';
                
                // Remove visual unread indicator (border)
                element.classList.remove('border-l-4', 'border-indigo-600');
                
                decrementMessageBadges();
            }
            
            // Show the modal
            const author = element.querySelector('h4').textContent;
            const title = element.querySelector('p.font-medium').textContent;
            // Use the hidden full content if it exists, otherwise fallback to the paragraph text
            const hiddenContent = element.querySelector('.hidden-full-content');
            const bodyText = hiddenContent ? hiddenContent.textContent : element.querySelectorAll('p.text-gray-600')[0].textContent;
            
            const modalTitle = author.startsWith('You') ? author : 'Message from ' + author;
            showMessageModal(modalTitle, 'Subject: ' + title + '\n\n' + bodyText);
        }

        function decrementNotificationBadges() {
            const badges = document.querySelectorAll('.notif-badge-ui');
            badges.forEach(b => {
                let count = parseInt(b.textContent) || 0;
                if(count > 0) {
                    count--;
                    if(count === 0) {
                        b.style.display = 'none';
                    } else {
                        b.textContent = count;
                    }
                }
            });
        }

        function readDropdownNotification(element) {
            if (!element.hasAttribute('data-read')) {
                element.setAttribute('data-read', 'true');
                element.classList.remove('bg-gray-50');
                element.style.opacity = '0.7';
                decrementNotificationBadges();
            }
        }

        function readDropdownMessage(element) {
            if (!element.hasAttribute('data-read')) {
                element.setAttribute('data-read', 'true');
                element.classList.remove('bg-gray-50', 'bg-indigo-50'); // clear any unread styling if existed
                element.style.opacity = '0.7'; // visually show it's read
                decrementMessageBadges();
            }
        }

        function decrementMessageBadges() {
            const badges = document.querySelectorAll('.msg-badge-ui');
            badges.forEach(b => {
                let count = parseInt(b.textContent) || 0;
                if(count > 0) {
                    count--;
                    if(count === 0) {
                        b.style.display = 'none';
                    } else {
                        b.textContent = count;
                    }
                }
            });
        }

        // Function to simulate user getting a new message, reflecting in Inbox and Envelope Dropdown
        function simulateReceiveMessage(senderName, subject, bodyText) {
            const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            
            // 1. Update Top Envelope Badges (and sidebar badge)
            const badges = document.querySelectorAll('.msg-badge-ui');
            badges.forEach(b => {
                b.style.display = 'flex';
                let count = parseInt(b.textContent) || 0;
                b.textContent = count + 1;
            });

            // Make sure the title and body are safe for using in HTML strings/onclick
            const safeSubject = subject.replace(/['"]/g, "\\'");
            const fullBody = 'Subject: ' + subject + '\n\n' + bodyText;
            const safeContent = fullBody.replace(/['"]/g, "\\'").replace(/\n/g, "\\n");

            // Strip newlines for the tiny truncated preview in the dropdown
            const previewText = bodyText.replace(/\n/g, ' ');

            // 2. Prepend to Dropdown Menu List
            const dropdownList = document.getElementById('dropdownMessagesList');
            if (dropdownList) {
                const dropItem = document.createElement('a');
                dropItem.href = '#';
                dropItem.className = 'block px-4 py-3 border-b border-gray-100 bg-indigo-50 hover:bg-gray-50 transition'; // bg-indigo-50 indicates unread
                dropItem.setAttribute('onclick', `readDropdownMessage(this); showMessageModal('Message from ${senderName}', '${safeContent}')`);
                dropItem.innerHTML = `
                    <div class="flex justify-between items-center mb-1">
                        <p class="text-sm font-semibold text-gray-800">${senderName}</p>
                        <span class="w-2 h-2 bg-indigo-600 rounded-full inline-block"></span>
                    </div>
                    <p class="text-xs font-medium text-gray-700 truncate">${subject}</p>
                    <p class="text-xs text-gray-500 truncate">${previewText.substring(0, 40)}${previewText.length > 40 ? '...' : ''}</p>
                `;
                dropdownList.insertBefore(dropItem, dropdownList.firstChild);
            }

            // 3. Prepend to Inbox Messages List area
            const inboxList = document.getElementById('inboxMessagesList');
            if (inboxList) {
                const inboxItem = document.createElement('div');
                inboxItem.className = 'p-4 hover:bg-gray-50 transition cursor-pointer border-l-4 border-indigo-600 bg-indigo-50/10';
                inboxItem.setAttribute('onclick', 'readFullMessage(this)');
                inboxItem.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <h4 class="font-semibold text-gray-800">${senderName}</h4>
                        <span class="text-xs text-gray-500">${dateStr}</span>
                    </div>
                    <p class="text-sm font-medium text-gray-700 mb-1">${subject}</p>
                    <p class="text-sm text-gray-600 mb-2">${bodyText.substring(0, 100)}${bodyText.length > 100 ? '...' : ''}</p>
                    <span class="inline-block mt-2 px-2 py-1 text-xs bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 rounded unread-badge">Unread</span>
                    <div class="hidden-full-content" style="display:none;">${bodyText}</div>
                `;
                inboxList.insertBefore(inboxItem, inboxList.firstChild);
            }

            // Optional: Show a quick toast or alert
            const notifySubject = subject.length > 20 ? subject.substring(0,20)+'...' : subject;
            // Native notification if available, otherwise just rely on badges
        }