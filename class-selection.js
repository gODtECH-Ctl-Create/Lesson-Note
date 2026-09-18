// LessonHub class selection layer
// This controls the first step before teachers access lesson notes.

(function () {
  const selectedClassKey = "lessonhub_selected_class";

  window.LessonHubClass = {
    get() {
      return localStorage.getItem(selectedClassKey) || "";
    },

    set(className) {
      localStorage.setItem(selectedClassKey, className);
      window.dispatchEvent(new CustomEvent("lessonhub:class-selected", {
        detail: { className }
      }));
    },

    clear() {
      localStorage.removeItem(selectedClassKey);
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    const selected = LessonHubClass.get();
    if (selected) {
      document.documentElement.dataset.selectedClass = selected;
    }
  });
})();
