// LessonHub lesson progress persistence.
// Progress is isolated by academic term AND class.

(function () {
  const storageKey = "lessonhub_lesson_progress_v2";
  const legacyStorageKey = "lessonhub_lesson_progress_v1";
  const catalogueKey = "lessonhub_lesson_catalogue_v1";

  function readJson(key, fallback = {}) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
      return value && typeof value === "object" ? value : fallback;
    } catch (error) {
      console.warn("Could not read LessonHub local data.", error);
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function currentTerm() {
    return window.LessonHubTerm?.get() || "first";
  }

  function currentClass() {
    return window.LessonHubClass?.get(currentTerm()) || "";
  }

  function scopeKey(term = currentTerm(), className = currentClass()) {
    return term + "::" + className;
  }

  function lessonKey(week, subject) {
    return [String(week || "").trim(), String(subject || "").trim()].join("::");
  }

  function staticCatalogue() {
    const items = [];
    const lessons = typeof LESSONS !== "undefined" ? LESSONS : {};

    Object.keys(lessons).forEach((week) => {
      Object.keys(lessons[week] || {}).forEach((subject) => {
        const lesson = lessons[week][subject] || {};
        items.push({
          week,
          subject,
          topic: lesson.topic || "",
          dates: lesson.dates || "",
          key: lessonKey(week, subject)
        });
      });
    });

    return sortCatalogue(items);
  }

  function sortCatalogue(items) {
    return [...items].sort((a, b) => {
      const weekA = Number((String(a.week).match(/\d+/) || [999])[0]);
      const weekB = Number((String(b.week).match(/\d+/) || [999])[0]);
      return weekA - weekB || String(a.subject).localeCompare(String(b.subject));
    });
  }

  function catalogue(term = currentTerm()) {
    const cache = readJson(catalogueKey, {});
    if (Array.isArray(cache[term]) && cache[term].length) {
      return sortCatalogue(cache[term]);
    }

    // The bundled lesson snapshot belongs to First Term.
    return term === "first" ? staticCatalogue() : [];
  }

  function setCatalogue(items, term = currentTerm()) {
    const cache = readJson(catalogueKey, {});
    cache[term] = sortCatalogue((items || []).map((item) => ({
      week: item.week,
      subject: item.subject,
      topic: item.topic || "",
      dates: item.dates || "",
      key: lessonKey(item.week, item.subject)
    })));
    writeJson(catalogueKey, cache);
  }

  function readProgress() {
    const current = readJson(storageKey, {});
    if (Object.keys(current).length) return current;

    // One-time compatibility: old data represented First Term progress by class only.
    const legacy = readJson(legacyStorageKey, {});
    const migrated = {};
    Object.entries(legacy).forEach(([className, records]) => {
      if (records && typeof records === "object") {
        migrated["first::" + className] = records;
      }
    });

    if (Object.keys(migrated).length) writeJson(storageKey, migrated);
    return migrated;
  }

  function writeProgress(value) {
    writeJson(storageKey, value);
    window.dispatchEvent(new CustomEvent("lessonhub:progress-changed"));
  }

  function recordsForClass(className = currentClass(), term = currentTerm()) {
    if (!className || !term) return {};
    return readProgress()[scopeKey(term, className)] || {};
  }

  function recordFor(week, subject, className = currentClass(), term = currentTerm()) {
    return recordsForClass(className, term)[lessonKey(week, subject)] || null;
  }

  function update(week, subject, patch, className = currentClass(), term = currentTerm()) {
    if (!term || !className || !week || !subject) return null;

    const all = readProgress();
    const key = scopeKey(term, className);
    const records = all[key] || {};
    const lessonId = lessonKey(week, subject);
    const previous = records[lessonId] || {};

    records[lessonId] = {
      ...previous,
      week,
      subject,
      term,
      className,
      ...patch
    };

    all[key] = records;
    writeProgress(all);
    return records[lessonId];
  }

  function markStarted(week, subject, className = currentClass(), term = currentTerm()) {
    const existing = recordFor(week, subject, className, term);
    if (existing?.status === "completed") return existing;

    return update(week, subject, {
      status: "started",
      openedAt: existing?.openedAt || new Date().toISOString()
    }, className, term);
  }

  function setCompleted(week, subject, completed, className = currentClass(), term = currentTerm()) {
    const existing = recordFor(week, subject, className, term);

    if (completed) {
      return update(week, subject, {
        status: "completed",
        completedAt: new Date().toISOString(),
        openedAt: existing?.openedAt || new Date().toISOString()
      }, className, term);
    }

    return update(week, subject, {
      status: "started",
      completedAt: null,
      openedAt: existing?.openedAt || new Date().toISOString()
    }, className, term);
  }

  function isCompleted(week, subject, className = currentClass(), term = currentTerm()) {
    return recordFor(week, subject, className, term)?.status === "completed";
  }

  function summary(className = currentClass(), term = currentTerm()) {
    const lessons = catalogue(term);
    const records = recordsForClass(className, term);
    let completed = 0;
    let started = 0;

    lessons.forEach((lesson) => {
      const status = records[lesson.key]?.status;
      if (status === "completed") completed += 1;
      else if (status === "started") started += 1;
    });

    const total = lessons.length;
    const remaining = Math.max(0, total - completed - started);

    return {
      total,
      completed,
      started,
      remaining,
      percent: total ? Math.round((completed / total) * 100) : 0
    };
  }

  window.LessonHubProgress = {
    catalogue,
    setCatalogue,
    lessonKey,
    recordsForClass,
    recordFor,
    markStarted,
    setCompleted,
    isCompleted,
    summary
  };
})();
