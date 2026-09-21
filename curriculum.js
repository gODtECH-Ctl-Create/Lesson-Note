// LessonHub class curriculum viewer.
// The selected class parent Google Docs tab is the curriculum source.
(function () {
  const container = document.getElementById("curriculumContainer");
  const status = document.getElementById("curriculumStatus");
  const updated = document.getElementById("curriculumUpdated");
  const refreshButton = document.getElementById("refreshCurriculumBtn");

  let loadedScope = "";
  let loadPromise = null;

  function currentTerm() {
    return window.LessonHubTerm?.get?.() || "first";
  }

  function currentClass() {
    return window.LessonHubClass?.get?.(currentTerm()) || "";
  }

  function currentScope() {
    return currentTerm() + "::" + currentClass();
  }

  function currentTermLabel() {
    return window.LessonHubTerm?.label?.(currentTerm()) || "Term";
  }

  function normalizeClassName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function setStatus(mode, message, modifiedAt = "") {
    if (status) {
      status.textContent = message;
      const statusClass = ["live", "cached", "missing"].includes(mode) ? mode : "snapshot";
      status.className = "status-pill " + statusClass;
    }

    if (!updated) return;

    if (!modifiedAt) {
      updated.textContent = "";
      return;
    }

    const date = new Date(modifiedAt);
    updated.textContent = Number.isNaN(date.getTime())
      ? ""
      : "Curriculum updated " + date.toLocaleString();
  }

  function render(payload) {
    if (!container) return;

    const html = String(payload?.html || "").trim();

    container.innerHTML = html
      ? '<article class="lesson-document live-document curriculum-document">' + html + "</article>"
      : [
          '<div class="empty-state curriculum-empty">',
          '<span class="empty-icon">🗂️</span>',
          "<h2>No curriculum content yet</h2>",
          "<p>Add the class curriculum to the parent class tab in the Google Doc. It will appear here automatically.</p>",
          "</div>"
        ].join("");
  }

  async function fetchLive(term, className) {
    window.lessonApi?.configureForTerm?.(term);

    if (!window.lessonApi?.enabled) {
      throw new Error("The Google Docs source is not configured for this term.");
    }

    const payload = await window.lessonApi.call("curriculum", { class: className });

    if (
      !payload?.className ||
      normalizeClassName(payload.className) !== normalizeClassName(className)
    ) {
      throw new Error("The curriculum response did not match the selected class.");
    }

    if (typeof window.LessonHubOffline?.saveCurriculum === "function") {
      try {
        await window.LessonHubOffline.saveCurriculum(term, className, payload);
      } catch (error) {
        console.warn("Could not cache curriculum for offline use.", error);
      }
    }

    return payload;
  }

  async function refreshCachedInBackground(cached, term, className, scope) {
    if (!navigator.onLine || !window.lessonApi?.enabled) return;

    try {
      const version = await window.lessonApi.call("version");
      if (currentScope() !== scope) return;

      const localVersion = cached?.modifiedAt || cached?.curriculum?.modifiedAt || "";
      const remoteVersion = version?.modifiedAt || "";

      if (!remoteVersion || (localVersion && localVersion === remoteVersion)) {
        return;
      }

      const fresh = await fetchLive(term, className);
      if (currentScope() !== scope) return;

      render(fresh);
      setStatus("live", currentTermLabel() + " · " + className + " · Curriculum", fresh.modifiedAt);
    } catch (error) {
      console.warn("Could not refresh cached curriculum.", error);
    }
  }

  async function load(force = false) {
    const term = currentTerm();
    const className = currentClass();
    const scope = currentScope();

    if (!container || !className) return null;

    if (!force && loadedScope === scope && loadPromise) {
      return loadPromise;
    }

    loadedScope = scope;
    loadPromise = (async () => {
      if (refreshButton) refreshButton.disabled = true;

      let cached = null;

      if (typeof window.LessonHubOffline?.getCurriculum === "function") {
        try {
          cached = await window.LessonHubOffline.getCurriculum(term, className);
        } catch (error) {
          console.warn("Could not read saved curriculum.", error);
        }
      }

      if (!force && cached?.curriculum) {
        render(cached.curriculum);
        setStatus(
          "cached",
          currentTermLabel() + " · " + className + " · Saved curriculum",
          cached.modifiedAt || cached.curriculum.modifiedAt || ""
        );

        if (refreshButton) refreshButton.disabled = false;
        refreshCachedInBackground(cached, term, className, scope);
        return cached.curriculum;
      }

      if (!navigator.onLine) {
        render(null);
        setStatus("missing", currentTermLabel() + " · " + className + " · Curriculum not saved offline");
        if (updated) updated.textContent = "Connect once and open this curriculum to save it on this device.";
        if (refreshButton) refreshButton.disabled = false;
        return null;
      }

      try {
        const payload = await fetchLive(term, className);

        if (currentScope() !== scope) return payload;

        render(payload);
        setStatus(
          "live",
          currentTermLabel() + " · " + className + " · Curriculum",
          payload.modifiedAt
        );
        return payload;
      } catch (error) {
        console.warn("Could not load class curriculum.", error);

        if (cached?.curriculum) {
          render(cached.curriculum);
          setStatus(
            "cached",
            currentTermLabel() + " · " + className + " · Using saved curriculum",
            cached.modifiedAt || ""
          );
          return cached.curriculum;
        }

        render(null);
        setStatus("missing", currentTermLabel() + " · " + className + " · Curriculum unavailable");
        if (updated) {
          updated.textContent = error?.message
            ? "Could not load curriculum: " + error.message
            : "Could not load curriculum from the live Google Doc.";
        }
        return null;
      } finally {
        if (refreshButton) refreshButton.disabled = false;
      }
    })();

    return loadPromise;
  }

  async function downloadForOffline() {
    const term = currentTerm();
    const className = currentClass();

    if (!term || !className || !navigator.onLine) return null;

    try {
      return await fetchLive(term, className);
    } catch (error) {
      console.warn("Could not save curriculum for offline use.", error);
      return null;
    }
  }

  function reset() {
    loadedScope = "";
    loadPromise = null;
  }

  refreshButton?.addEventListener("click", () => load(true));

  window.addEventListener("lessonhub:term-selected", reset);
  window.addEventListener("lessonhub:class-selected", reset);

  window.LessonHubCurriculum = {
    load,
    downloadForOffline,
    reset
  };
})();
