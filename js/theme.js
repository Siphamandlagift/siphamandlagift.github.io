function setTheme(theme) {
            // Close dropdowns
            document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.add('hidden'));
            document.body.className = document.body.className.replace(/\btheme-[a-zA-Z0-9]+\b/g, '').trim();
            if(theme !== 'white') document.body.classList.add('theme-' + theme);
            localStorage.setItem('appTheme', theme);
        }
        
        document.addEventListener('DOMContentLoaded', () => {
            const savedTheme = localStorage.getItem('appTheme') || 'white';
            setTheme(savedTheme);
        });