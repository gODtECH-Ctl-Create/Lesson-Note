const weekSelect = document.getElementById("weekSelect");
const subjectSelect = document.getElementById("subjectSelect");
const viewLessonBtn = document.getElementById("viewLessonBtn");
const lessonSection = document.getElementById("lessonSection");
const lessonContainer = document.getElementById("lessonContainer");
const lessonTitle = document.getElementById("lessonTitle");
const lessonMeta = document.getElementById("lessonMeta");
const closeLessonBtn = document.getElementById("closeLessonBtn");
const sourceStatus = document.getElementById("sourceStatus");
const sourceUpdated = document.getElementById("sourceUpdated");
const refreshSourceBtn = document.getElementById("refreshSourceBtn");
const toggleCompleteBtn = document.getElementById("toggleCompleteBtn");
const downloadOfflineBtn = document.getElementById("downloadOfflineBtn");
const offlineStatusText = document.getElementById("offlineStatusText");
const offlineProgress = document.getElementById("offlineProgress");
const offlineProgressText = document.getElementById("offlineProgressText");

let sourceMode = "static";
let lessonIndex = {};
let liveManifest = null;
let activeLesson = null;
let loadedTerm = "";
let sourcePromise = null;

function currentTerm() {
  return window.LessonHubTerm?.get() || "first";
}

function currentTermLabel() {
  return window.LessonHubTerm?.label(currentTerm()) || "First Term";
}

function currentClass() {
  return window.LessonHubClass?.get(currentTerm()) || "Class";
}

function updateCompletionButton() {
  if (!toggleCompleteBtn) return;

  if (!activeLesson?.week || !activeLesson?.subject) {
    toggleCompleteBtn.disabled = true;
    toggleCompleteBtn.classList.remove("is-completed");
    toggleCompleteBtn.querySelector("span:last-child").textContent = "Mark as completed";
    return;
  }

  const completed = window.LessonHubProgress?.isCompleted(
    activeLesson.week,
    activeLesson.subject,
    currentClass(),
    currentTerm()
  ) || false;

  toggleCompleteBtn.disabled = false;
  toggleCompleteBtn.classList.toggle("is-completed", completed);
  toggleCompleteBtn.querySelector("span:last-child").textContent = completed ? "Completed" : "Mark as completed";
}

function syncLessonRoute(week = "", subject = "") {
  window.LessonHubRouter?.replaceLessonRoute?.(week, subject);
}

function setActiveLesson(week, subject) {
  activeLesson = { week, subject };
  window.LessonHubProgress?.markStarted(week, subject, currentClass(), currentTerm());
  updateCompletionButton();
}

function weekNumber(label) {
  const match = String(label || "").match(/\d+/);
  return match ? Number(match[0]) : 999;
}

function clearSelect(select, placeholder, disabled = true) {
  select.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.textContent = placeholder;
  select.appendChild(option);
  select.disabled = disabled;
}

function buildStaticIndex() {
  const result = {};

  Object.keys(LESSONS).forEach((week) => {
    result[week] = {};
    Object.keys(LESSONS[week]).forEach((subject) => {
      const lesson = LESSONS[week][subject];
      result[week][subject] = {
        week,
        subject,
        topic: lesson.topic || "",
        dates: lesson.dates || ""
      };
    });
  });

  return result;
}

function buildLiveIndex(manifest) {
  const result = {};

  (manifest.subjects || []).forEach((subjectEntry) => {
    (subjectEntry.weeks || []).forEach((weekEntry) => {
      const week = weekEntry.week;
      if (!result[week]) result[week] = {};

      result[week][subjectEntry.subject] = {
        week,
        subject: subjectEntry.subject,
        topic: weekEntry.topic || "",
        dates: weekEntry.dates || ""
      };
    });
  });

  return result;
}

function indexToCatalogue(index) {
  const items = [];
  Object.keys(index || {}).forEach((week) => {
    Object.keys(index[week] || {}).forEach((subject) => {
      items.push({
        week,
        subject,
        topic: index[week][subject]?.topic || "",
        dates: index[week][subject]?.dates || ""
      });
    });
  });
  return items;
}

function populateWeeks() {
  clearSelect(weekSelect, "Select week", false);
  clearSelect(subjectSelect, "Select subject", true);
  viewLessonBtn.disabled = true;

  Object.keys(lessonIndex)
    .sort((a, b) => weekNumber(a) - weekNumber(b) || a.localeCompare(b))
    .forEach((week) => {
      const option = document.createElement("option");
      option.value = week;
      option.textContent = week;
      weekSelect.appendChild(option);
    });

  if (!Object.keys(lessonIndex).length) {
    clearSelect(weekSelect, "No lessons available", true);
  }
}

function populateSubjects() {
  clearSelect(subjectSelect, "Select subject", true);
  viewLessonBtn.disabled = true;

  const week = weekSelect.value;
  if (!week || !lessonIndex[week]) return;

  Object.keys(lessonIndex[week])
    .sort((a, b) => a.localeCompare(b))
    .forEach((subject) => {
      const option = document.createElement("option");
      option.value = subject;
      option.textContent = subject;
      subjectSelect.appendChild(option);
    });

  subjectSelect.disabled = false;
}

function setSourceStatus(mode, message, updatedAt = "") {
  sourceMode = mode;
  sourceStatus.textContent = message;
  sourceStatus.className = "status-pill " + (mode === "live" ? "live" : mode === "missing" ? "missing" : "snapshot");

  if (updatedAt) {
    const date = new Date(updatedAt);
    sourceUpdated.textContent = Number.isNaN(date.getTime())
      ? ""
      : "Source updated " + date.toLocaleString();
  } else {
    sourceUpdated.textContent = "";
  }
}

async function refreshOfflinePanel(term = currentTerm()) {
  if (!offlineStatusText || !downloadOfflineBtn) return;

  if (!window.LessonHubOffline?.supported) {
    offlineStatusText.textContent = "Offline lesson storage is not supported by this browser.";
    downloadOfflineBtn.disabled = true;
    return;
  }

  try {
    const [count, sync, manifest] = await Promise.all([
      window.LessonHubOffline.countLessons(term),
      window.LessonHubOffline.getSyncState(term),
      window.LessonHubOffline.getManifest(term)
    ]);

    const total = sync?.total || indexToCatalogue(lessonIndex).length || 0;
    const hasUpdate = Boolean(
      sync?.modifiedAt &&
      manifest?.modifiedAt &&
      sync.modifiedAt !== manifest.modifiedAt
    );

    if (count > 0) {
      const completeText = total ? count + " of " + total + " lessons saved" : count + " lessons saved";
      const lastSync = sync?.savedAt ? new Date(sync.savedAt).toLocaleString() : "";

      offlineStatusText.textContent = hasUpdate
        ? completeText + " · Update available"
        : completeText + (lastSync ? " · Last synced " + lastSync : " · Available offline");

      downloadOfflineBtn.textContent = hasUpdate ? "Update offline copy" : "Update offline copy";
    } else if (term === "first") {
      offlineStatusText.textContent = "The bundled First Term snapshot is available offline after this app is cached.";
      downloadOfflineBtn.textContent = "Save full live copy";
    } else {
      offlineStatusText.textContent = "This term has not been downloaded to this device yet.";
      downloadOfflineBtn.textContent = "Download for offline";
    }
  } catch (error) {
    console.warn("Could not read offline status.", error);
    offlineStatusText.textContent = "Offline status is unavailable.";
  }
}

function setOfflineProgress(done, total, message = "") {
  const percent = total ? Math.round((done / total) * 100) : 0;
  if (offlineProgress) offlineProgress.style.width = percent + "%";
  if (offlineProgressText) {
    offlineProgressText.textContent = message || (total ? done + " of " + total + " lessons saved" : "");
  }
}

async function useCachedManifest(term) {
  if (!window.LessonHubOffline?.supported) return false;

  try {
    const cached = await window.LessonHubOffline.getManifest(term);
    if (!cached?.index || !Object.keys(cached.index).length) return false;

    lessonIndex = cached.index;
    liveManifest = cached.manifest || null;
    populateWeeks();
    window.LessonHubProgress?.setCatalogue(indexToCatalogue(lessonIndex), term);
    setSourceStatus("cached", currentTermLabel() + " · Saved on this device", cached.modifiedAt || "");
    refreshSourceBtn.disabled = false;
    await refreshOfflinePanel(term);
    return true;
  } catch (error) {
    console.warn("Could not load the saved lesson manifest.", error);
    return false;
  }
}

async function loadSource(force = false) {
  const term = currentTerm();

  if (!force && loadedTerm === term && sourcePromise) {
    return sourcePromise;
  }

  loadedTerm = term;
  sourcePromise = (async () => {
    refreshSourceBtn.disabled = true;
    sourceStatus.textContent = force
      ? "Checking " + currentTermLabel() + " for updates…"
      : "Loading " + currentTermLabel() + " lesson source…";
    sourceStatus.className = "status-pill";
    sourceUpdated.textContent = "";
    clearSelect(weekSelect, "Loading weeks…", true);
    clearSelect(subjectSelect, "Select subject", true);
    viewLessonBtn.disabled = true;
    closeLesson({ updateRoute: false });

    const termConfig = window.LessonHubTerm?.config(term) || {};
    const cachedManifest = window.LessonHubOffline?.supported
      ? await window.LessonHubOffline.getManifest(term).catch(() => null)
      : null;

    if (!force && cachedManifest?.index && Object.keys(cachedManifest.index).length) {
      lessonIndex = cachedManifest.index;
      liveManifest = cachedManifest.manifest || null;
      populateWeeks();
      window.LessonHubProgress?.setCatalogue(indexToCatalogue(lessonIndex), term);
      setSourceStatus("cached", currentTermLabel() + " · Saved on this device", cachedManifest.modifiedAt || "");
      refreshSourceBtn.disabled = false;
      await refreshOfflinePanel(term);
      return lessonIndex;
    }

    window.lessonApi?.configureForTerm?.(term);

    if (navigator.onLine && window.lessonApi?.enabled) {
      try {
        const freshManifest = await window.lessonApi.call("manifest");
        const freshIndex = buildLiveIndex(freshManifest);

        if (!Object.keys(freshIndex).length) {
          throw new Error("The live Google Doc did not return any WEEK headings.");
        }

        const unchanged = Boolean(
          force &&
          cachedManifest?.modifiedAt &&
          freshManifest.modifiedAt &&
          cachedManifest.modifiedAt === freshManifest.modifiedAt
        );

        liveManifest = freshManifest;
        lessonIndex = freshIndex;
        populateWeeks();
        window.LessonHubProgress?.setCatalogue(indexToCatalogue(lessonIndex), term);
        await window.LessonHubOffline?.saveManifest(term, freshManifest, lessonIndex);

        setSourceStatus(
          "live",
          unchanged
            ? currentTermLabel() + " · Everything is up to date"
            : currentTermLabel() + " · Live Google Doc",
          freshManifest.modifiedAt
        );

        refreshSourceBtn.disabled = false;
        await refreshOfflinePanel(term);
        return lessonIndex;
      } catch (error) {
        console.warn("Live source unavailable for " + currentTermLabel() + ".", error);
      }
    }

    if (cachedManifest?.index && Object.keys(cachedManifest.index).length) {
      lessonIndex = cachedManifest.index;
      liveManifest = cachedManifest.manifest || null;
      populateWeeks();
      window.LessonHubProgress?.setCatalogue(indexToCatalogue(lessonIndex), term);
      setSourceStatus(
        "cached",
        currentTermLabel() + (navigator.onLine ? " · Using saved copy" : " · Offline · using saved copy"),
        cachedManifest.modifiedAt || ""
      );
      refreshSourceBtn.disabled = false;
      await refreshOfflinePanel(term);
      return lessonIndex;
    }

    if (termConfig.staticFallback && term === "first") {
      lessonIndex = buildStaticIndex();
      populateWeeks();
      window.LessonHubProgress?.setCatalogue(indexToCatalogue(lessonIndex), term);
      await window.LessonHubOffline?.saveManifest(term, null, lessonIndex).catch(() => {});

      setSourceStatus(
        "static",
        currentTermLabel() + (navigator.onLine ? " · Saved snapshot" : " · Offline · saved snapshot")
      );

      refreshSourceBtn.disabled = false;
      await refreshOfflinePanel(term);
      return lessonIndex;
    }

    lessonIndex = {};
    populateWeeks();
    setSourceStatus(
      "missing",
      navigator.onLine
        ? currentTermLabel() + " · Lesson source unavailable"
        : currentTermLabel() + " · Offline · no saved lessons"
    );
    sourceUpdated.textContent = navigator.onLine
      ? "Try Check for updates again."
      : "Connect once to download this term for offline use.";
    refreshSourceBtn.disabled = false;
    await refreshOfflinePanel(term);
    return lessonIndex;
  })();

  return sourcePromise;
}

async function downloadCurrentTerm() {
  const term = currentTerm();

  if (!window.LessonHubOffline?.supported) {
    offlineStatusText.textContent = "Offline storage is not supported on this browser.";
    return;
  }

  if (!navigator.onLine && term !== "first") {
    offlineStatusText.textContent = "Connect to the internet once to download this term.";
    return;
  }

  downloadOfflineBtn.disabled = true;
  refreshSourceBtn.disabled = true;
  setOfflineProgress(0, 0, "Preparing lesson download…");

  try {
    if (navigator.onLine) {
      await loadSource(true);
    } else {
      await loadSource(false);
    }

    const items = indexToCatalogue(lessonIndex);
    if (!items.length) {
      throw new Error("No lessons are available to download.");
    }

    const existingSync = await window.LessonHubOffline.getSyncState(term).catch(() => null);
    const existingCount = await window.LessonHubOffline.countLessons(term).catch(() => 0);
    const currentVersion = liveManifest?.modifiedAt || (sourceMode === "static" ? "static" : "");

    if (
      existingCount >= items.length &&
      existingSync?.modifiedAt &&
      currentVersion &&
      existingSync.modifiedAt === currentVersion
    ) {
      setOfflineProgress(items.length, items.length, "Everything is already up to date.");
      offlineStatusText.textContent = "All available lessons are already saved on this device.";
      return;
    }

    let completed = 0;
    let failed = 0;
    let cursor = 0;

    async function worker() {
      while (cursor < items.length) {
        const item = items[cursor++];
        try {
          if (sourceMode === "static" && term === "first") {
            const staticLesson = LESSONS?.[item.week]?.[item.subject];
            if (!staticLesson) throw new Error("Static lesson not found.");
            await window.LessonHubOffline.saveLesson(term, {
              ...staticLesson,
              week: item.week,
              subject: item.subject
            }, "static");
          } else {
            window.lessonApi?.configureForTerm?.(term);
            if (!window.lessonApi?.enabled || !navigator.onLine) {
              throw new Error("Internet connection is required for this lesson.");
            }
            const lesson = await window.lessonApi.call("lesson", {
              subject: item.subject,
              week: item.week
            });
            await window.LessonHubOffline.saveLesson(term, lesson, "live");
          }
        } catch (error) {
          failed += 1;
          console.warn("Could not save lesson for offline use.", item, error);
        } finally {
          completed += 1;
          setOfflineProgress(
            completed,
            items.length,
            completed + " of " + items.length + " processed" + (failed ? " · " + failed + " failed" : "")
          );
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(3, items.length) },
      () => worker()
    );

    await Promise.all(workers);

    const saved = await window.LessonHubOffline.countLessons(term);
    await window.LessonHubOffline.saveSyncState(term, {
      total: items.length,
      saved,
      modifiedAt: currentVersion
    });

    if (failed) {
      offlineStatusText.textContent =
        saved + " of " + items.length + " lessons saved. Reconnect and try again for the remaining lessons.";
    } else {
      offlineStatusText.textContent =
        "Ready offline · " + saved + " lessons saved for " + currentTermLabel() + ".";
      setOfflineProgress(items.length, items.length, "Offline download complete.");
    }
  } catch (error) {
    console.warn("Offline download failed.", error);
    offlineStatusText.textContent = error.message || "Could not download lessons for offline use.";
  } finally {
    downloadOfflineBtn.disabled = false;
    refreshSourceBtn.disabled = false;
    await refreshOfflinePanel(term);
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeWordText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function fnv1a(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function findFormattingRecord(rawText) {
  const normalized = normalizeWordText(rawText);
  const candidates = [
    normalized,
    normalized.replace(/^•\s*/, ""),
    normalized.replace(/^\d+\.\s*/, ""),
    normalized.replace(/^•\s*/, "").replace(/^\d+\.\s*/, "")
  ];

  for (const candidate of [...new Set(candidates)]) {
    const record = window.FORMAT_RANGES?.[fnv1a(candidate)];
    if (record && record[0] === candidate.length) {
      return { text: candidate, ranges: record[1] };
    }
  }

  return { text: normalized, ranges: [] };
}

function renderStyledText(rawText) {
  const record = findFormattingRecord(rawText);
  const text = record.text;
  const masks = new Uint8Array(text.length);

  record.ranges.forEach(([start, end, mask]) => {
    for (let i = start; i < end && i < masks.length; i++) {
      masks[i] |= mask;
    }
  });

  let html = "";
  let start = 0;

  while (start < text.length) {
    const mask = masks[start];
    let end = start + 1;
    while (end < text.length && masks[end] === mask) end++;

    let segment = escapeHtml(text.slice(start, end));
    if (mask & 4) segment = "<u>" + segment + "</u>";
    if (mask & 2) segment = "<em>" + segment + "</em>";
    if (mask & 1) segment = "<strong>" + segment + "</strong>";

    html += segment;
    start = end;
  }

  return { html, record };
}

function isFullyBold(record) {
  if (!record.text.length || !record.ranges.length) return false;

  let covered = 0;
  record.ranges.forEach(([start, end, mask]) => {
    if (mask & 1) covered += Math.max(0, end - start);
  });

  return covered >= record.text.length;
}

const SECTION_HEADINGS = new Set([
  "Lesson Content",
  "Teacher & Learner Activities",
  "Assessment & Homework"
]);

function renderStaticDocumentContent(content) {
  const blocks = String(content || "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  let html = "";
  let openList = null;

  function closeList() {
    if (openList) {
      html += "</" + openList + ">";
      openList = null;
    }
  }

  blocks.forEach((block) => {
    const normalized = normalizeWordText(block);

    if (SECTION_HEADINGS.has(normalized)) {
      closeList();
      html += '<h4 class="doc-section">' + escapeHtml(normalized) + "</h4>";
      return;
    }

    const bullet = /^•\s*/.test(normalized);
    const numbered = /^\d+\.\s*/.test(normalized);

    if (bullet || numbered) {
      const listTag = bullet ? "ul" : "ol";
      if (openList !== listTag) {
        closeList();
        html += '<' + listTag + ' class="doc-list">';
        openList = listTag;
      }

      const clean = bullet
        ? normalized.replace(/^•\s*/, "")
        : normalized.replace(/^\d+\.\s*/, "");

      html += "<li>" + renderStyledText(clean).html + "</li>";
      return;
    }

    closeList();

    const rendered = renderStyledText(normalized);
    const looksLikeSubheading =
      isFullyBold(rendered.record) ||
      (rendered.record.text.length < 90 && /[:?]$/.test(rendered.record.text));

    html += looksLikeSubheading
      ? '<p class="doc-subheading">' + rendered.html + "</p>"
      : '<p class="doc-paragraph">' + rendered.html + "</p>";
  });

  closeList();
  return html;
}

function setLessonMeta(week, dates = "") {
  lessonMeta.textContent = [
    currentTermLabel(),
    currentClass(),
    "2026",
    week,
    dates
  ].filter(Boolean).join(" · ");
}

function renderStaticLesson(lesson, week, subject) {
  lessonContainer.innerHTML = "";

  const article = document.createElement("article");
  article.className = "lesson-document";

  if (lesson.topic) {
    const topic = document.createElement("h3");
    topic.className = "lesson-topic";
    topic.textContent = lesson.topic;
    article.appendChild(topic);
  }

  const body = document.createElement("div");
  body.className = "lesson-text";
  body.innerHTML = renderStaticDocumentContent(lesson.content);
  article.appendChild(body);

  lessonContainer.appendChild(article);
  setActiveLesson(week, subject);
  setLessonMeta(week, lesson.dates);
  lessonTitle.textContent = subject;
}

function renderLiveLesson(lesson) {
  lessonContainer.innerHTML = "";

  const article = document.createElement("article");
  article.className = "lesson-document live-document";

  if (lesson.topic) {
    const topic = document.createElement("h3");
    topic.className = "lesson-topic";
    topic.textContent = lesson.topic;
    article.appendChild(topic);
  }

  const body = document.createElement("div");
  body.className = "lesson-text live-doc-content";
  body.innerHTML = lesson.html || '<p class="placeholder">This lesson has no content yet.</p>';
  article.appendChild(body);

  lessonContainer.appendChild(article);
  setActiveLesson(lesson.week, lesson.subject);
  setLessonMeta(lesson.week, lesson.dates);
  lessonTitle.textContent = lesson.subject;
}

async function viewSelectedLesson() {
  const week = weekSelect.value;
  const subject = subjectSelect.value;

  if (!week || !subject) return;

  lessonSection.classList.remove("hidden");
  lessonTitle.textContent = subject;
  setLessonMeta(week);
  lessonContainer.innerHTML = '<p class="placeholder">Loading lesson…</p>';
  activeLesson = { week, subject };
  updateCompletionButton();
  syncLessonRoute(week, subject);
  lessonSection.scrollIntoView({ behavior: "smooth", block: "start" });

  const cached = await window.LessonHubOffline?.getLesson(currentTerm(), week, subject).catch(() => null);

  if (cached?.lesson) {
    if (cached.kind === "static") {
      renderStaticLesson(cached.lesson, week, subject);
    } else {
      renderLiveLesson(cached.lesson);
    }
    return;
  }

  if (sourceMode === "live" && navigator.onLine && window.lessonApi?.enabled) {
    try {
      const lesson = await window.lessonApi.call("lesson", { subject, week });
      await window.LessonHubOffline?.saveLesson(currentTerm(), lesson, "live").catch(() => {});
      renderLiveLesson(lesson);
      await refreshOfflinePanel();
      return;
    } catch (error) {
      console.warn("Could not load live lesson.", error);
    }
  }

  if (currentTerm() === "first") {
    const lesson = LESSONS?.[week]?.[subject];
    if (lesson) {
      await window.LessonHubOffline?.saveLesson(currentTerm(), {
        ...lesson,
        week,
        subject
      }, "static").catch(() => {});
      renderStaticLesson(lesson, week, subject);
      await refreshOfflinePanel();
      return;
    }
  }

  lessonContainer.innerHTML = navigator.onLine
    ? '<p class="error">This lesson is not saved yet. Use “Download for offline” or try Check for updates.</p>'
    : '<p class="error">This lesson is not available offline on this device yet. Connect once and download this term.</p>';
}

weekSelect.addEventListener("change", populateSubjects);

subjectSelect.addEventListener("change", () => {
  viewLessonBtn.disabled = !subjectSelect.value;
});

viewLessonBtn.addEventListener("click", viewSelectedLesson);

function closeLesson(options = {}) {
  lessonSection.classList.add("hidden");
  lessonContainer.innerHTML = '<p class="placeholder">Choose a lesson to begin.</p>';
  activeLesson = null;
  updateCompletionButton();

  if (options.updateRoute !== false) {
    syncLessonRoute();
  }
}

closeLessonBtn.addEventListener("click", () => closeLesson());

toggleCompleteBtn?.addEventListener("click", () => {
  if (!activeLesson?.week || !activeLesson?.subject || !window.LessonHubProgress) return;

  const completed = window.LessonHubProgress.isCompleted(
    activeLesson.week,
    activeLesson.subject,
    currentClass(),
    currentTerm()
  );

  window.LessonHubProgress.setCompleted(
    activeLesson.week,
    activeLesson.subject,
    !completed,
    currentClass(),
    currentTerm()
  );

  updateCompletionButton();
});

refreshSourceBtn.addEventListener("click", async () => {
  if (!navigator.onLine) {
    setSourceStatus("cached", currentTermLabel() + " · Offline · using saved lessons");
    sourceUpdated.textContent = "Connect to the internet to check for new updates.";
    await refreshOfflinePanel();
    return;
  }

  loadedTerm = "";
  sourcePromise = null;
  await loadSource(true);
});

downloadOfflineBtn?.addEventListener("click", downloadCurrentTerm);

async function restoreFromRoute(week, subject) {
  if (!week || !subject) return;
  await loadSource();

  const weekExists = [...weekSelect.options].some((option) => option.value === week);
  if (!weekExists) return;

  weekSelect.value = week;
  populateSubjects();

  const subjectExists = [...subjectSelect.options].some((option) => option.value === subject);
  if (!subjectExists) return;

  subjectSelect.value = subject;
  viewLessonBtn.disabled = false;
  await viewSelectedLesson();
}

window.LessonHubLessons = {
  prepareSource: () => loadSource(),
  restoreFromRoute,
  close: closeLesson
};

window.addEventListener("lessonhub:term-selected", () => {
  loadedTerm = "";
  sourcePromise = null;
  lessonIndex = {};
  liveManifest = null;
  closeLesson({ updateRoute: false });
  window.lessonApi?.configureForTerm?.(currentTerm());
  refreshOfflinePanel();
});

window.addEventListener("lessonhub:network-changed", () => {
  refreshOfflinePanel();
});

window.addEventListener("lessonhub:progress-changed", updateCompletionButton);
