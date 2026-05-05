// TechTwin Premium Theme & Modal System

// 1. Theme Switcher Logic
function initTheme() {
    const savedTheme = localStorage.getItem('techtwin-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('techtwin-theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icons = document.querySelectorAll('.theme-toggle-btn i, .sidebar-theme-toggle i');
    icons.forEach(icon => {
        if (theme === 'dark') {
            icon.className = 'bx bx-sun';
        } else {
            icon.className = 'bx bx-moon';
        }
    });

    const labels = document.querySelectorAll('.theme-text-label');
    labels.forEach(label => {
        label.innerText = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    });
}

// Ensure theme is loaded immediately to prevent flashing
initTheme();

// Expose toggle function globally
window.toggleTheme = toggleTheme;

// 2. Premium Modal System
let modalOverlay = null;

function createModalContainer() {
    if (document.getElementById('premium-modal-overlay')) return;

    modalOverlay = document.createElement('div');
    modalOverlay.id = 'premium-modal-overlay';
    modalOverlay.className = 'premium-modal-overlay';
    
    modalOverlay.innerHTML = `
        <div class="premium-modal">
            <div id="premium-modal-icon" class="premium-modal-icon info">
                <i class='bx bx-info-circle'></i>
            </div>
            <h3 id="premium-modal-title" class="premium-modal-title">Notification</h3>
            <p id="premium-modal-message" class="premium-modal-message">Message goes here.</p>
            <button id="premium-modal-close" class="premium-modal-btn">Got it</button>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    document.getElementById('premium-modal-close').addEventListener('click', closePremiumModal);
}

function showPremiumModal(title, message, type = 'info') {
    createModalContainer();

    const overlay = document.getElementById('premium-modal-overlay');
    const titleEl = document.getElementById('premium-modal-title');
    const msgEl = document.getElementById('premium-modal-message');
    const iconContainer = document.getElementById('premium-modal-icon');

    titleEl.innerText = title;
    msgEl.innerHTML = message;

    // Set icon based on type
    let iconClass = 'bx bx-info-circle';
    if (type === 'success') iconClass = 'bx bx-check-circle';
    if (type === 'error' || type === 'warning') iconClass = 'bx bx-x-circle';
    
    // Convert warning to error style just for icon coloring mapping
    const visualType = (type === 'warning') ? 'error' : type;

    iconContainer.className = `premium-modal-icon ${visualType}`;
    iconContainer.innerHTML = `<i class='${iconClass}'></i>`;

    overlay.classList.add('active');
}

function closePremiumModal() {
    const overlay = document.getElementById('premium-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// Make globally accessible
window.showPremiumModal = showPremiumModal;

// Override window.alert visually
window.alert = function(message) {
    showPremiumModal("Notification", message, "info");
};

// Also mock Swal if it's used
window.Swal = {
    fire: function(options) {
        let title = "Notification";
        let message = "";
        let type = "info";
        
        if (typeof options === "string") {
            message = options;
        } else {
            title = options.title || "Notification";
            message = options.text || "";
            if (options.icon) type = options.icon;
        }
        
        showPremiumModal(title, message, type);
        
        return Promise.resolve({ isConfirmed: true });
    }
};

// Add DOMContentLoaded listener to attach toggle events if elements exist
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inject Theme Toggle Button into Sidebar (at the very bottom)
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav && !document.querySelector('.sidebar-theme-toggle')) {
        const li = document.createElement('li');
        li.innerHTML = `<button class="sidebar-theme-toggle sidebar-link" title="Toggle Theme" style="width: 100%; text-align: left; background: transparent; border: none; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 16px; font-family: inherit; margin: 0; padding: 14px 16px;"><i class='bx bx-moon'></i> <span class="theme-text-label">Dark Mode</span></button>`;
        sidebarNav.appendChild(li); // Append at very bottom of sidebar nav
    }

    // 2. Inject Theme Toggle Button into top Navbar (for public pages)
    const navbarNav = document.querySelector('.nav-links');
    if (navbarNav && !sidebarNav && !document.querySelector('.theme-toggle-btn')) {
        const a = document.createElement('a');
        a.href = "#";
        a.className = "theme-toggle-btn";
        a.style.display = "inline-flex";
        a.title = "Toggle Theme";
        a.innerHTML = `<i class='bx bx-moon'></i>`;
        
        const loginBtn = navbarNav.querySelector('.nav-btn');
        if (loginBtn) {
            navbarNav.insertBefore(a, loginBtn);
        } else {
            navbarNav.appendChild(a);
        }
    }

    const btns = document.querySelectorAll('.theme-toggle-btn, .sidebar-theme-toggle');
    btns.forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleTheme();
    }));
    
    // Ensure icon matches current theme dynamically
    updateThemeIcon(document.documentElement.getAttribute('data-theme') || 'light');
});
