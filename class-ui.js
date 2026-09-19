// LessonHub class selection and navigation UI

const LESSON_CLASSES = [
  "Nursery 1",
  "Nursery 2",
  "Basic 1",
  "Basic 2",
  "Basic 3",
  "Basic 4",
  "Basic 5"
];

function showScreen(screenId) {
  ["classScreen", "dashboardScreen", "workspaceScreen"].forEach((id) => {
    document.getElementById(id)?.classList.toggle("hidden", id !== screenId);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function syncSelectedClass() {
  const selected = window.LessonHubClass?.get() || "";
  const dashboardClassName = document.getElementById("dashboardClassName");
  const selectedClassName = document.getElementById("selectedClassName");

  if (dashboardClassName) dashboardClassName.textContent = selected || "Class Dashboard";
  if (selectedClassName) selectedClassName.textContent = selected;
}

function resetOpenLesson() {
  const lessonSection = document.getElementById("lessonSection");
  const lessonContainer = document.getElementById("lessonContainer");

  lessonSection?.classList.add("hidden");
  if (lessonContainer) {
    lessonContainer.innerHTML = '<p class="placeholder">Choose a lesson to begin.</p>';
  }
}

function renderClassSelector() {
  const container = document.getElementById("classSelector");
  if (!container) return;

  container.innerHTML = LESSON_CLASSES.map((item) => `
    <button class="class-card" type="button" data-class="${item}">
      <span class="class-card-icon">🎓</span>
      <span class="class-card-copy">
        <strong>${item}</strong>
        <small>Open dashboard</small>
      </span>
      <span class="class-card-arrow" aria-hidden="true">→</span>
    </button>
  `).join("");

  container.querySelectorAll("[data-class]").forEach((button) => {
    button.addEventListener("click", () => {
      window.LessonHubClass?.set(button.dataset.class);
      syncSelectedClass();
      showScreen("dashboardScreen");
    });
  });
}

function setupNavigation() {
  const dashboardBackBtn = document.getElementById("dashboardBackBtn");
  const workspaceBackBtn = document.getElementById("workspaceBackBtn");
  const openLessonsBtn = document.getElementById("openLessonsBtn");

  dashboardBackBtn?.addEventListener("click", () => {
    resetOpenLesson();
    showScreen("classScreen");
  });

  workspaceBackBtn?.addEventListener("click", () => {
    resetOpenLesson();
    syncSelectedClass();
    showScreen("dashboardScreen");
  });

  openLessonsBtn?.addEventListener("click", () => {
    syncSelectedClass();
    showScreen("workspaceScreen");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderClassSelector();
  syncSelectedClass();
  setupNavigation();
});
