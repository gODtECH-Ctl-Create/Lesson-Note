const weekSelect = document.getElementById("weekSelect");
const subjectSelect = document.getElementById("subjectSelect");
const viewLessonBtn = document.getElementById("viewLessonBtn");
const lessonSection = document.getElementById("lessonSection");
const lessonContainer = document.getElementById("lessonContainer");
const lessonTitle = document.getElementById("lessonTitle");
const lessonMeta = document.getElementById("lessonMeta");
const closeLessonBtn = document.getElementById("closeLessonBtn");

function weekNumber(label) {
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : 999;
}

function loadWeeks() {
  Object.keys(LESSONS)
    .sort((a, b) => weekNumber(a) - weekNumber(b))
    .forEach((week) => {
      const option = document.createElement("option");
      option.value = week;
      option.textContent = week;
      weekSelect.appendChild(option);
    });
}

function resetSubjects() {
  subjectSelect.innerHTML = '<option value="">Select subject</option>';
  subjectSelect.disabled = true;
  viewLessonBtn.disabled = true;
}

weekSelect.addEventListener("change", () => {
  resetSubjects();

  const selectedWeek = weekSelect.value;
  if (!selectedWeek || !LESSONS[selectedWeek]) return;

  Object.keys(LESSONS[selectedWeek])
    .sort((a, b) => a.localeCompare(b))
    .forEach((subject) => {
      const option = document.createElement("option");
      option.value = subject;
      option.textContent = subject;
      subjectSelect.appendChild(option);
    });

  subjectSelect.disabled = false;
});

subjectSelect.addEventListener("change", () => {
  viewLessonBtn.disabled = !subjectSelect.value;
});

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeWordText(value) {
  return value.replace(/\s+/g, " ").trim();
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
  const sorted = [...record.ranges].sort((a, b) => a[0] - b[0]);
  sorted.forEach(([start, end, mask]) => {
    if (mask & 1) covered += Math.max(0, end - start);
  });

  return covered >= record.text.length;
}

const SECTION_HEADINGS = new Set([
  "Lesson Content",
  "Teacher & Learner Activities",
  "Assessment & Homework"
]);

function renderDocumentContent(content) {
  const blocks = content
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

    if (looksLikeSubheading) {
      html += '<p class="doc-subheading">' + rendered.html + "</p>";
    } else {
      html += '<p class="doc-paragraph">' + rendered.html + "</p>";
    }
  });

  closeList();
  return html;
}

function renderLesson(lesson, week, subject) {
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
  body.innerHTML = renderDocumentContent(lesson.content);
  article.appendChild(body);

  lessonContainer.appendChild(article);

  lessonMeta.textContent = [
    "Basic 3",
    "2026",
    week,
    lesson.dates
  ].filter(Boolean).join(" · ");

  lessonTitle.textContent = subject;
}

viewLessonBtn.addEventListener("click", () => {
  const week = weekSelect.value;
  const subject = subjectSelect.value;
  const lesson = LESSONS?.[week]?.[subject];

  lessonSection.classList.remove("hidden");

  if (!lesson) {
    lessonContainer.innerHTML =
      '<p class="error">No lesson was found for this week and subject in the source document.</p>';
    return;
  }

  renderLesson(lesson, week, subject);
  lessonSection.scrollIntoView({ behavior: "smooth", block: "start" });
});

closeLessonBtn.addEventListener("click", () => {
  lessonSection.classList.add("hidden");
  lessonContainer.innerHTML =
    '<p class="placeholder">Choose a lesson to begin.</p>';
});

loadWeeks();