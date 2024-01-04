const darkModeToggle = document.getElementById("dark-mode-toggle");
const body = document.body;

// Check for dark mode preference in local storage
const darkModePreference = localStorage.getItem("dark-mode");
if (darkModePreference === "disabled") {
    body.classList.remove("dark-mode");
    localStorage.setItem("dark-mode", "disabled");
} else {
    // Enable dark mode by default
    body.classList.add("dark-mode");
    localStorage.setItem("dark-mode", "enabled");
}

// Toggle dark mode
darkModeToggle.addEventListener("click", () => {
    if (body.classList.contains("dark-mode")) {
        body.classList.remove("dark-mode");
        localStorage.setItem("dark-mode", "disabled");
    } else {
        body.classList.add("dark-mode");
        localStorage.setItem("dark-mode", "enabled");
    }
});
