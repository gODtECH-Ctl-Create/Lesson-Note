// LessonHub class selection UI

const LESSON_CLASSES = [
  "Nursery 1",
  "Nursery 2",
  "Basic 1",
  "Basic 2",
  "Basic 3",
  "Basic 4",
  "Basic 5"
];

function renderClassSelector() {
  const container = document.getElementById("classSelector");
  if (!container) return;

  container.innerHTML = LESSON_CLASSES.map((item) => `
    <button class="class-card" data-class="${item}">
      ${item}
    </button>
  `).join("");

  container.querySelectorAll("[data-class]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.class;

      LessonHubClass.set(selected);

      const classScreen = document.getElementById("classScreen");
      const workspaceScreen = document.getElementById("workspaceScreen");
      const selectedName = document.getElementById("selectedClassName");

      if (selectedName) {
        selectedName.textContent = selected;
      }

      if (classScreen) {
        classScreen.classList.add("hidden");
      }

      if (workspaceScreen) {
        workspaceScreen.classList.remove("hidden");
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderClassSelector();
});
