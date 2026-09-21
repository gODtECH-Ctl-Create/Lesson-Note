let LIVE_API_URL = "";

function isValidLessonApiUrl(value) {
  return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(String(value || "").trim());
}

window.lessonApi = {
  currentTerm: "",

  configureForTerm(termKey = window.LessonHubTerm?.get?.() || "first") {
    const termConfig = window.LESSON_TERM_CONFIG?.[termKey] || {};
    this.currentTerm = termKey;
    LIVE_API_URL = String(termConfig.apiUrl || "").trim();
    return this.enabled;
  },

  get enabled() {
    return isValidLessonApiUrl(LIVE_API_URL);
  },

  call(action, params = {}) {
    if (!this.enabled) {
      return Promise.reject(new Error("Live Google Doc API is not configured for this term."));
    }

    return new Promise((resolve, reject) => {
      const callbackName = "__lessonApi_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const timeoutMs = action === "curriculum" ? 45000 : 15000;
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error(
          action === "curriculum"
            ? "The curriculum request took too long to load."
            : "The live Google Doc request timed out."
        ));
      }, timeoutMs);

      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = (payload) => {
        cleanup();
        if (!payload || payload.ok === false) {
          reject(new Error(payload?.error || "The live Google Doc request failed."));
          return;
        }
        resolve(payload);
      };

      const url = new URL(LIVE_API_URL);
      url.searchParams.set("action", action);
      url.searchParams.set("prefix", callbackName);

      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });

      script.src = url.toString();
      script.onerror = () => {
        cleanup();
        reject(new Error("Could not reach the live Google Doc API."));
      };

      document.head.appendChild(script);
    });
  }
};

// Configure the persisted term immediately when possible.
window.lessonApi.configureForTerm(window.LessonHubTerm?.get?.() || "first");
