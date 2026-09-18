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
      const dashboardScreen = document.getElementById("dashboardScreen");
      const dashboardClassName = document.getElementById("dashboardClassName");

      if (dashboardClassName) {
        dashboardClassName.textContent = selected;
      }

      classScreen?.classList.add("hidden");
      dashboardScreen?.classList.remove("hidden");

      const lessonsBtn = document.getElementById("openLessonsBtn");
      lessonsBtn?.addEventListener("click", () => {
        dashboardScreen?.classList.add("hidden");
        document.getElementById("workspaceScreen")?.classList.remove("hidden");
        const selectedName = document.getElementById("selectedClassName");
        if (selectedName) selectedName.textContent = selected;
      }, { once: true });
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderClassSelector();
});
