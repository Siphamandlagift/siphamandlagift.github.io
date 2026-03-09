
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
    