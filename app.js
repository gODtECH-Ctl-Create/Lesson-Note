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
let loadedScope = "";
let sourcePromise = null;
let updateCheckInFlight = null;

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

function currentTerm() {
  return window.LessonHubTerm?.get() || "first";
}

function currentTermLabel() {
  return window.LessonHubTerm?.label(currentTerm()) || "First Term";
}

function currentClass() {
  return window.LessonHubClass?.get(currentTerm()) || "";
}

function currentScope() {
  return currentTerm() + "::" + currentClass();
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
  const statusClass = ["live", "missing", "cached"].includes(mode) ? mode : "snapshot";
  sourceStatus.className = "status-pill " + statusClass;

  if (updatedAt) {
    const date = new Date(updatedAt);
    sourceUpdated.textContent = Number.isNaN(date.getTime())
      ? ""
      : "Source updated " + date.toLocaleString();
  } else {
    sourceUpdated.textContent = "";
  }
}

async function refreshOfflinePanel(term = currentTerm(), className = currentClass()) {
  if (!offlineStatusText || !downloadOfflineBtn) return;

  if (!className) {
    offlineStatusText.textContent = "Choose a class to manage offline lessons.";
    downloadOfflineBtn.disabled = true;
    return;
  }

  if (!window.LessonHubOffline?.supported) {
    offlineStatusText.textContent = "Offline lesson storage is not supported by this browser.";
    downloadOfflineBtn.disabled = true;
    return;
  }

  try {
    const [count, sync, manifest] = await Promise.all([
      window.LessonHubOffline.countLessons(term, className),
      window.LessonHubOffline.getSyncState(term, className),
      window.LessonHubOffline.getManifest(term, className)
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
    } else if (term === "first" && className === "Basic 3") {
      offlineStatusText.textContent = "The bundled First Term Basic 3 snapshot is available offline after this app is cached.";
      downloadOfflineBtn.textContent = "Save full live copy";
    } else {
      offlineStatusText.textContent = className + " has not been downloaded for " + currentTermLabel() + " yet.";
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

function lastUpdateCheckKey(term = currentTerm(), className = currentClass()) {
  return "lessonhub_last_update_check_" + term + "::" + className;
}

function markUpdateChecked(term = currentTerm(), className = currentClass()) {
  localStorage.setItem(lastUpdateCheckKey(term, className), String(Date.now()));
}

function shouldCheckForUpdates(term = currentTerm(), className = currentClass()) {
  const last = Number(localStorage.getItem(lastUpdateCheckKey(term, className)) || 0);
  return !last || Date.now() - last >= UPDATE_CHECK_INTERVAL_MS;
}

async function checkForUpdates(options = {}) {
  const term = currentTerm();
  const className = currentClass();
  const silent = Boolean(options.silent);

  if (!className) {
    return { checked: false, changed: false };
  }

  if (!navigator.onLine) {
    if (!silent) {
      setSourceStatus("cached", currentTermLabel() + " · Offline · using saved lessons");
      sourceUpdated.textContent = "Connect to the internet to check for new updates.";
    }
    await refreshOfflinePanel(term);
    return { checked: false, changed: false, offline: true };
  }

  if (updateCheckInFlight) return updateCheckInFlight;

  const checkScope = currentScope();

  updateCheckInFlight = (async () => {
    window.lessonApi?.configureForTerm?.(term);

    if (!window.lessonApi?.enabled) {
      return { checked: false, changed: false };
    }

    const cachedManifest = window.LessonHubOffline?.supported
      ? await window.LessonHubOffline.getManifest(term, className).catch(() => null)
      : null;

    if (!silent) {
      refreshSourceBtn.disabled = true;
      sourceStatus.textContent = "Checking " + currentTermLabel() + " for updates…";
      sourceStatus.className = "status-pill";
    }

    try {
      let version;

      try {
        version = await window.lessonApi.call("version");
      } catch (versionError) {
        // Older Apps Script deployments do not know the version action yet.
        // Fall back to the manifest so the app keeps working until redeployed.
        console.warn("Version endpoint unavailable; falling back to manifest.", versionError);
        loadedScope = "";
        sourcePromise = null;
        const result = await loadSource(true);
        markUpdateChecked(term, className);
        return { checked: true, changed: true, fallback: true, result };
      }

      markUpdateChecked(term, className);

      if (currentScope() !== checkScope) {
        return { checked: true, changed: false, ignored: true };
      }

      const localVersion = cachedManifest?.modifiedAt || liveManifest?.modifiedAt || "";
      const remoteVersion = version?.modifiedAt || "";

      if (localVersion && remoteVersion && localVersion === remoteVersion) {
        if (!silent) {
          setSourceStatus(
            cachedManifest ? "cached" : "live",
            currentTermLabel() + " · Everything is up to date",
            remoteVersion
          );
          sourceUpdated.textContent = "Checked just now · no new lesson updates.";
        }
        await refreshOfflinePanel(term);
        return { checked: true, changed: false, version: remoteVersion };
      }

      loadedScope = "";
      sourcePromise = null;
      await loadSource(true);

      if (!silent) {
        sourceUpdated.textContent = "New lesson updates were found.";
      }

      await refreshOfflinePanel(term);
      return { checked: true, changed: true, version: remoteVersion };
    } finally {
      refreshSourceBtn.disabled = false;
      updateCheckInFlight = null;
    }
  })();

  return updateCheckInFlight;
}

function scheduleAutomaticUpdateCheck(term = currentTerm(), className = currentClass()) {
  if (!className || !navigator.onLine || !shouldCheckForUpdates(term, className)) return;

  window.setTimeout(() => {
    if (
      currentTerm() !== term ||
      currentClass() !== className ||
      !navigator.onLine
    ) return;
    checkForUpdates({ silent: true }).catch((error) => {
      console.warn("Automatic lesson update check failed.", error);
    });
  }, 1200);
}

async function loadSource(force = false) {
  const term = currentTerm();
  const className = currentClass();
  const scope = currentScope();

  if (!className) {
    lessonIndex = {};
    populateWeeks();
    setSourceStatus("missing", currentTermLabel() + " · Choose a class");
    return lessonIndex;
  }

  if (!force && loadedScope === scope && sourcePromise) {
    return sourcePromise;
  }

  loadedScope = scope;
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
      ? await window.LessonHubOffline.getManifest(term, className).catch(() => null)
      : null;

    if (!force && cachedManifest?.index && Object.keys(cachedManifest.index).length) {
      lessonIndex = cachedManifest.index;
      liveManifest = cachedManifest.manifest || null;
      populateWeeks();
      window.LessonHubProgress?.setCatalogue(indexToCatalogue(lessonIndex), term, className);
      setSourceStatus("cached", currentTermLabel() + " · Saved on this device", cachedManifest.modifiedAt || "");
      refreshSourceBtn.disabled = false;
      await refreshOfflinePanel(term);
      scheduleAutomaticUpdateCheck(term, className);
      return lessonIndex;
    }

    window.lessonApi?.configureForTerm?.(term);

    if (navigator.onLine && window.lessonApi?.enabled) {
      try {
        const freshManifest = await window.lessonApi.call("manifest", { class: className });

        if (
          !freshManifest.className ||
          String(freshManifest.className).trim().toLowerCase() !== className.trim().toLowerCase()
        ) {
          throw new Error(
            "This term API has not been redeployed with class-aware lesson support yet."
          );
        }

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
        window.LessonHubProgress?.setCatalogue(indexToCatalogue(lessonIndex), term, className);
        await window.LessonHubOffline?.saveManifest(term, className, freshManifest, lessonIndex);

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
      window.LessonHubProgress?.setCatalogue(indexToCatalogue(lessonIndex), term, className);
      setSourceStatus(
        "cached",
        currentTermLabel() + (navigator.onLine ? " · Using saved copy" : " · Offline · using saved copy"),
        cachedManifest.modifiedAt || ""
      );
      refreshSourceBtn.disabled = false;
      await refreshOfflinePanel(term);
      scheduleAutomaticUpdateCheck(term, className);
      return lessonIndex;
    }

    if (termConfig.staticFallback && term === "first" && className === "Basic 3") {
      lessonIndex = buildStaticIndex();
      populateWeeks();
      window.LessonHubProgress?.setCatalogue(indexToCatalogue(lessonIndex), term, className);
      await window.LessonHubOffline?.saveManifest(term, className, null, lessonIndex).catch(() => {});

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
        ? currentTermLabel() + " · " + className + " · Lesson source unavailable"
        : currentTermLabel() + " · " + className + " · Offline · no saved lessons"
    );
    sourceUpdated.textContent = navigator.onLine
      ? "This class is not available from the term document yet, or the Apps Script still needs redeployment."
      : "Connect once to download this class for offline use.";
    refreshSourceBtn.disabled = false;
    await refreshOfflinePanel(term);
    return lessonIndex;
  })();

  return sourcePromise;
}

async function downloadCurrentTerm() {
  const term = currentTerm();
  const className = currentClass();

  if (!className) {
    offlineStatusText.textContent = "Choose a class first.";
    return;
  }

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

    const existingSync = await window.LessonHubOffline.getSyncState(term, className).catch(() => null);
    const existingCount = await window.LessonHubOffline.countLessons(term, className).catch(() => 0);
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
          if (sourceMode === "static" && term === "first" && className === "Basic 3") {
            const staticLesson = LESSONS?.[item.week]?.[item.subject];
            if (!staticLesson) throw new Error("Static lesson not found.");
            await window.LessonHubOffline.saveLesson(term, className, {
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
              class: className,
              subject: item.subject,
              week: item.week
            });
            await window.LessonHubOffline.saveLesson(
        term,
        className,
        lesson,
        "live",
        liveManifest?.modifiedAt || lesson.modifiedAt || ""
      );
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

    const saved = await window.LessonHubOffline.countLessons(term, className);
    await window.LessonHubOffline.saveSyncState(term, className, {
      total: items.length,
      saved,
      modifiedAt: currentVersion
    });

    if (failed) {
      offlineStatusText.textContent =
        saved + " of " + items.length + " lessons saved. Reconnect and try again for the remaining lessons.";
    } else {
      offlineStatusText.textContent =
        "Ready offline · " + saved + " lessons saved for " + className + " · " + currentTermLabel() + ".";
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

  const cached = await window.LessonHubOffline?.getLesson(
    currentTerm(),
    currentClass(),
    week,
    subject
  ).catch(() => null);

  if (cached?.lesson) {
    if (cached.kind === "static") {
      renderStaticLesson(cached.lesson, week, subject);
      return;
    }

    renderLiveLesson(cached.lesson);

    const currentVersion = liveManifest?.modifiedAt || "";
    const stale = Boolean(
      navigator.onLine &&
      window.lessonApi?.enabled &&
      currentVersion &&
      cached.sourceModifiedAt !== currentVersion
    );

    if (!stale) return;

    // Stale-while-revalidate: show the saved lesson immediately, then quietly
    // replace it with the newer copy if this lesson changed upstream.
    try {
      const freshLesson = await window.lessonApi.call("lesson", {
      class: currentClass(),
      subject,
      week
    });
      await window.LessonHubOffline.saveLesson(
        currentTerm(),
        currentClass(),
        freshLesson,
        "live",
        currentVersion || freshLesson.modifiedAt || ""
      );

      if (activeLesson?.week === week && activeLesson?.subject === subject) {
        renderLiveLesson(freshLesson);
      }

      await refreshOfflinePanel();
    } catch (error) {
      console.warn("Could not refresh the saved lesson.", error);
    }
    return;
  }

  if (navigator.onLine && window.lessonApi?.enabled) {
    try {
      const lesson = await window.lessonApi.call("lesson", {
        class: currentClass(),
        subject,
        week
      });
      await window.LessonHubOffline?.saveLesson(
        currentTerm(),
        currentClass(),
        lesson,
        "live",
        liveManifest?.modifiedAt || lesson.modifiedAt || ""
      ).catch(() => {});
      renderLiveLesson(lesson);
      await refreshOfflinePanel();
      return;
    } catch (error) {
      console.warn("Could not load live lesson.", error);
    }
  }

  if (currentTerm() === "first" && currentClass() === "Basic 3") {
    const lesson = LESSONS?.[week]?.[subject];
    if (lesson) {
      await window.LessonHubOffline?.saveLesson(currentTerm(), currentClass(), {
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
  await checkForUpdates({ silent: false });
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

function resetSourceForSelection() {
  loadedScope = "";
  sourcePromise = null;
  updateCheckInFlight = null;
  lessonIndex = {};
  liveManifest = null;
  closeLesson({ updateRoute: false });
  window.lessonApi?.configureForTerm?.(currentTerm());
  refreshOfflinePanel();
}

window.addEventListener("lessonhub:term-selected", resetSourceForSelection);
window.addEventListener("lessonhub:class-selected", resetSourceForSelection);

window.addEventListener("lessonhub:network-changed", (event) => {
  refreshOfflinePanel();
  if (event.detail?.online) {
    scheduleAutomaticUpdateCheck();
  }
});

window.addEventListener("lessonhub:progress-changed", updateCompletionButton);

// Keep long-running installed sessions fresh without repeatedly hitting Apps Script.
// This timer only performs a network check once the six-hour window has elapsed.
window.setInterval(() => {
  if (!navigator.onLine || !currentClass() || !shouldCheckForUpdates(currentTerm(), currentClass())) return;
  checkForUpdates({ silent: true }).catch((error) => {
    console.warn("Scheduled lesson update check failed.", error);
  });
}, 60 * 60 * 1000);
