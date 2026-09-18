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
      LessonHubClass.set(button.dataset.class);
      document.body.classList.add("class-selected");
      document.getElementById("selectedClassName").textContent = button.dataset.class;
      document.getElementById("classWelcome").classList.add("hidden");
      document.getElementById("lessonWorkspace").classList.remove("hidden");
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderClassSelector();
});
