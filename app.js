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

function renderTextLesson(lesson, week, subject) {
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
  body.textContent = lesson.content;
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

  if (lesson.type === "text") {
    renderTextLesson(lesson, week, subject);
  } else if (lesson.type === "google-doc") {
    lessonMeta.textContent = ["Basic 3", "2026", week].join(" · ");
    lessonTitle.textContent = subject;
    lessonContainer.innerHTML =
      '<iframe class="lesson-frame" src="' + lesson.url +
      '" title="' + subject + ' - ' + week + '" loading="lazy"></iframe>';
  } else {
    lessonContainer.innerHTML =
      '<p class="error">This lesson type is not supported.</p>';
  }

  lessonSection.scrollIntoView({ behavior: "smooth", block: "start" });
});

closeLessonBtn.addEventListener("click", () => {
  lessonSection.classList.add("hidden");
  lessonContainer.innerHTML =
    '<p class="placeholder">Choose a lesson to begin.</p>';
});

loadWeeks();