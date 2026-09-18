const LIVE_API_URL = String(window.LESSON_API_URL || "").trim();

window.lessonApi = {
  enabled: /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(LIVE_API_URL),

  call(action, params = {}) {
    if (!this.enabled) {
      return Promise.reject(new Error("Live Google Doc API is not configured."));
    }

    return new Promise((resolve, reject) => {
      const callbackName = "__lessonApi_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("The live Google Doc request timed out."));
      }, 15000);

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
