function toggleTheme() {
    const body = document.body;
    if (body.classList.contains('dark')) {
        body.classList.remove('dark');
        // Switch to light mode
    } else {
        body.classList.add('dark');
        // Switch to dark mode
    }
}




// Attach the toggle function to a button with id "theme-toggle-button"
const toggleButton = document.getElementById('theme-toggle-button');
if (toggleButton) {
    toggleButton.addEventListener('click', toggleTheme);
}
