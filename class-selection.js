// LessonHub academic-term and class selection state.

(function () {
  const selectedTermKey = "lessonhub_selected_term";
  const legacyClassKey = "lessonhub_selected_class";
  const validTerms = ["first", "second", "third"];

  function normalizeTerm(term) {
    return validTerms.includes(term) ? term : "";
  }

  window.LessonHubTerm = {
    all() {
      return validTerms.map((key) => ({
        key,
        label: window.LESSON_TERM_CONFIG?.[key]?.label || key
      }));
    },

    get() {
      return normalizeTerm(localStorage.getItem(selectedTermKey) || "");
    },

    set(term) {
      const normalized = normalizeTerm(term);
      if (!normalized) return;
      localStorage.setItem(selectedTermKey, normalized);
      document.documentElement.dataset.selectedTerm = normalized;
      window.dispatchEvent(new CustomEvent("lessonhub:term-selected", {
        detail: { term: normalized, label: this.label(normalized) }
      }));
    },

    label(term = this.get()) {
      return window.LESSON_TERM_CONFIG?.[term]?.label || "";
    },

    config(term = this.get()) {
      return window.LESSON_TERM_CONFIG?.[term] || null;
    },

    clear() {
      localStorage.removeItem(selectedTermKey);
      delete document.documentElement.dataset.selectedTerm;
    }
  };

  function classKey(term = window.LessonHubTerm.get()) {
    return term ? "lessonhub_selected_class_" + term : legacyClassKey;
  }

  window.LessonHubClass = {
    get(term = window.LessonHubTerm.get()) {
      if (!term) return "";

      const scoped = localStorage.getItem(classKey(term));
      if (scoped) return scoped;

      // Preserve the class selected before term support was introduced.
      if (term === "first") {
        const legacy = localStorage.getItem(legacyClassKey) || "";
        if (legacy) {
          localStorage.setItem(classKey(term), legacy);
          return legacy;
        }
      }

      return "";
    },

    set(className, term = window.LessonHubTerm.get()) {
      if (!term || !className) return;
      localStorage.setItem(classKey(term), className);
      document.documentElement.dataset.selectedClass = className;
      window.dispatchEvent(new CustomEvent("lessonhub:class-selected", {
        detail: { term, className }
      }));
    },

    clear(term = window.LessonHubTerm.get()) {
      if (term) localStorage.removeItem(classKey(term));
      delete document.documentElement.dataset.selectedClass;
    }
  };

  window.addEventListener("DOMContentLoaded", () => {
    const term = window.LessonHubTerm.get();
    const selectedClass = window.LessonHubClass.get(term);
    if (term) document.documentElement.dataset.selectedTerm = term;
    if (selectedClass) document.documentElement.dataset.selectedClass = selectedClass;
  });
})();
