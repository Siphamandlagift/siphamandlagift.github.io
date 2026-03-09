import os
import re

with open('index.html', encoding='utf-8') as f:
    text = f.read()

old_trigger = "showMessageModal('Section Complete', \You scored " + "/ (%) on . Great job!\);"
new_trigger = "showAssessmentSuccess(\You scored " + "/ (%) on . Great job!\);"

if old_trigger in text:
    text = text.replace(old_trigger, new_trigger)
    print('Submit trigger replaced')

css = '''
<style>
/* Custom CSS for Checkmark Animation */
.checkmark-circle {
    animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}
.checkmark-check {
    animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards;
}
@keyframes stroke {
    100% { stroke-dashoffset: 0; }
}
</style>
'''
text = text.replace('</head>', css + '\n</head>')

html = '''
    <!-- Assessment Success Animation Modal -->
    <div id="assessmentSuccessOverlay" class="fixed inset-0 z-[1000] hidden flex items-center justify-center bg-gray-900 bg-opacity-75 backdrop-blur-sm transition-opacity opacity-0">
        <div class="bg-white rounded-2xl p-8 flex flex-col items-center justify-center transform scale-95 transition-all duration-300 shadow-2xl" id="assessmentSuccessContent">
            <!-- SVG Tick Animation -->
            <div class="w-24 h-24 mb-4">
                <svg viewBox="0 0 52 52" class="w-full h-full text-green-500 hidden" id="successTickSvg">
                    <circle class="checkmark-circle stroke-current" fill="none" cx="26" cy="26" r="25" stroke-width="2" stroke-dasharray="166" stroke-dashoffset="166" />
                    <path class="checkmark-check stroke-current" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" stroke-width="4" stroke-dasharray="48" stroke-dashoffset="48" />
                </svg>
            </div>
            <h3 class="text-2xl font-bold text-gray-800 mb-2">Successfully Submitted!</h3>
            <p id="assessmentSuccessMessage" class="text-gray-600 text-center mb-6"></p>
            <button onclick="closeAssessmentSuccess()" class="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium transition-colors">Continue</button>
        </div>
    </div>

    <script>
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
    </script>
'''

text = text.replace('</body>', html + '\n</body>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)
print('Done')
