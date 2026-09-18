// LessonHub class dashboard layer
// Provides the selected class context for the teacher experience.

(function () {
  window.LessonHubDashboard = {
    currentClass() {
      return window.LessonHubClass?.get() || "";
    },

    title() {
      const current = this.currentClass();
      return current ? `${current} Dashboard` : "Class Dashboard";
    },

    lessonFilter() {
      return {
        className: this.currentClass()
      };
    }
  };
})();
