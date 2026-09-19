// LessonHub PWA registration, install prompt and connectivity state.
(function () {
  let installPrompt = null;

  function updateConnectionState() {
    const indicator = document.getElementById("connectionStatus");
    if (!indicator) return;

    const online = navigator.onLine;
    indicator.textContent = online ? "Online" : "Offline";
    indicator.classList.toggle("is-offline", !online);

    window.dispatchEvent(new CustomEvent("lessonhub:network-changed", {
      detail: { online }
    }));
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    try {
      await navigator.serviceWorker.register("./service-worker.js", { scope: "./" });
    } catch (error) {
      console.warn("LessonHub service worker registration failed.", error);
    }
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;

    const button = document.getElementById("installAppBtn");
    if (button) button.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    const button = document.getElementById("installAppBtn");
    if (button) button.hidden = true;
  });

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("installAppBtn");

    button?.addEventListener("click", async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      button.hidden = true;
    });

    updateConnectionState();
    registerServiceWorker();
  });

  window.addEventListener("online", updateConnectionState);
  window.addEventListener("offline", updateConnectionState);
})();
