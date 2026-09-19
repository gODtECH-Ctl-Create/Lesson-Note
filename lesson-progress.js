// LessonHub lesson progress persistence.
// Progress is stored per class in localStorage so refreshes do not erase it.

(function () {
  const storageKey = "lessonhub_lesson_progress_v1";

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch (error) {
      console.warn("Could not read LessonHub progress.", error);
      return {};
    }
  }

  function write(value) {
    localStorage.setItem(storageKey, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("lessonhub:progress-changed"));
  }

  function lessonKey(week, subject) {
    return [String(week || "").trim(), String(subject || "").trim()].join("::");
  }

  function currentClass() {
    return window.LessonHubClass?.get() || "";
  }

  function catalogue() {
    const items = [];
    const lessons = window.LESSONS || {};

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

    return items.sort((a, b) => {
      const weekA = Number((a.week.match(/\d+/) || [999])[0]);
      const weekB = Number((b.week.match(/\d+/) || [999])[0]);
      return weekA - weekB || a.subject.localeCompare(b.subject);
    });
  }

  function recordsForClass(className = currentClass()) {
    return read()[className] || {};
  }

  function recordFor(week, subject, className = currentClass()) {
    return recordsForClass(className)[lessonKey(week, subject)] || null;
  }

  function update(week, subject, patch, className = currentClass()) {
    if (!className || !week || !subject) return null;

    const all = read();
    const classRecords = all[className] || {};
    const key = lessonKey(week, subject);
    const previous = classRecords[key] || {};

    classRecords[key] = {
      ...previous,
      week,
      subject,
      ...patch
    };

    all[className] = classRecords;
    write(all);
    return classRecords[key];
  }

  function markStarted(week, subject, className = currentClass()) {
    const existing = recordFor(week, subject, className);
    if (existing?.status === "completed") return existing;

    return update(week, subject, {
      status: "started",
      openedAt: new Date().toISOString()
    }, className);
  }

  function setCompleted(week, subject, completed, className = currentClass()) {
    if (completed) {
      return update(week, subject, {
        status: "completed",
        completedAt: new Date().toISOString(),
        openedAt: recordFor(week, subject, className)?.openedAt || new Date().toISOString()
      }, className);
    }

    return update(week, subject, {
      status: "started",
      completedAt: null,
      openedAt: recordFor(week, subject, className)?.openedAt || new Date().toISOString()
    }, className);
  }

  function isCompleted(week, subject, className = currentClass()) {
    return recordFor(week, subject, className)?.status === "completed";
  }

  function summary(className = currentClass()) {
    const lessons = catalogue();
    const records = recordsForClass(className);
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
    lessonKey,
    recordsForClass,
    recordFor,
    markStarted,
    setCompleted,
    isCompleted,
    summary
  };
})();