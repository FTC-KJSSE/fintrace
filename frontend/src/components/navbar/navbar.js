export function initNavbar(onModeChange) {
  const buttons = document.querySelectorAll(".nav-mode");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onModeChange(btn.dataset.mode);
    });
  });
}
