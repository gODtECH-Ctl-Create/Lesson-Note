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

let sourceMode = "static";
let lessonIndex = {};
let liveManifest = null;

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
  sourceStatus.className = "status-pill " + (mode === "live" ? "live" : "snapshot");

  if (updatedAt) {
    const date = new Date(updatedAt);
    sourceUpdated.textContent = Number.isNaN(date.getTime())
      ? ""
      : "Source updated " + date.toLocaleString();
  } else {
    sourceUpdated.textContent = "";
  }
}

async function loadSource() {
  refreshSourceBtn.disabled = true;
  sourceStatus.textContent = "Loading lesson source…";
  sourceStatus.className = "status-pill";
  sourceUpdated.textContent = "";
  clearSelect(weekSelect, "Loading weeks…", true);
  clearSelect(subjectSelect, "Select subject", true);
  viewLessonBtn.disabled = true;

  if (window.lessonApi?.enabled) {
    try {
      liveManifest = await window.lessonApi.call("manifest");
      lessonIndex = buildLiveIndex(liveManifest);

      if (!Object.keys(lessonIndex).length) {
        throw new Error("The live Google Doc did not return any WEEK headings.");
      }

      populateWeeks();
      setSourceStatus("live", "Live Google Doc", liveManifest.modifiedAt);
      refreshSourceBtn.disabled = false;
      return;
    } catch (error) {
      console.warn("Live source unavailable; using snapshot.", error);
    }
  }

  lessonIndex = buildStaticIndex();
  populateWeeks();

  const reason = window.lessonApi?.enabled
    ? "Live source unavailable · using saved snapshot"
    : "Saved snapshot · live source not connected yet";

  setSourceStatus("static", reason);
  refreshSourceBtn.disabled = false;
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
  lessonMeta.textContent = ["Basic 3", "2026", week, lesson.dates].filter(Boolean).join(" · ");
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
  lessonMeta.textContent = ["Basic 3", "2026", lesson.week, lesson.dates].filter(Boolean).join(" · ");
  lessonTitle.textContent = lesson.subject;
}

async function viewSelectedLesson() {
  const week = weekSelect.value;
  const subject = subjectSelect.value;

  if (!week || !subject) return;

  lessonSection.classList.remove("hidden");
  lessonTitle.textContent = subject;
  lessonMeta.textContent = ["Basic 3", "2026", week].join(" · ");
  lessonContainer.innerHTML = '<p class="placeholder">Loading lesson…</p>';
  lessonSection.scrollIntoView({ behavior: "smooth", block: "start" });

  if (sourceMode === "live" && window.lessonApi?.enabled) {
    try {
      const lesson = await window.lessonApi.call("lesson", { subject, week });
      renderLiveLesson(lesson);
      return;
    } catch (error) {
      lessonContainer.innerHTML =
        '<p class="error">Could not load the live lesson. Refresh the source and try again.</p>';
      return;
    }
  }

  const lesson = LESSONS?.[week]?.[subject];
  if (!lesson) {
    lessonContainer.innerHTML =
      '<p class="error">No lesson was found for this week and subject.</p>';
    return;
  }

  renderStaticLesson(lesson, week, subject);
}

weekSelect.addEventListener("change", populateSubjects);

subjectSelect.addEventListener("change", () => {
  viewLessonBtn.disabled = !subjectSelect.value;
});

viewLessonBtn.addEventListener("click", viewSelectedLesson);

closeLessonBtn.addEventListener("click", () => {
  lessonSection.classList.add("hidden");
  lessonContainer.innerHTML = '<p class="placeholder">Choose a lesson to begin.</p>';
});

refreshSourceBtn.addEventListener("click", loadSource);

loadSource();