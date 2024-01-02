const darkModeToggle = document.getElementById("dark-mode-toggle");
const body = document.body;

// Check for dark mode preference in local storage
if (localStorage.getItem("dark-mode") === "enabled") {
    body.classList.add("dark-mode");
}

//Toggle dark mode
darkModeToggle.addEventListener("click", () => {
    if (body.classList.contains("dark-mode")) {
        body.classList.remove("dark-mode");
        localStorage.setItem("dark-mode", "disabled");
    } else {
        body.classList.add("dark-mode");
        localStorage.setItem("dark-mode", "enabled");
    }
});


