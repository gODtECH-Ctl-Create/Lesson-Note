const weekSelect = document.getElementById("weekSelect");
const subjectSelect = document.getElementById("subjectSelect");
const viewLessonBtn = document.getElementById("viewLessonBtn");
const lessonSection = document.getElementById("lessonSection");
const lessonContainer = document.getElementById("lessonContainer");
const lessonTitle = document.getElementById("lessonTitle");
const lessonMeta = document.getElementById("lessonMeta");
const closeLessonBtn = document.getElementById("closeLessonBtn");

function loadWeeks() {
  Object.keys(LESSONS).forEach((week) => {
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

  Object.keys(LESSONS[selectedWeek]).forEach((subject) => {
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

viewLessonBtn.addEventListener("click", () => {
  const week = weekSelect.value;
  const subject = subjectSelect.value;
  const lesson = LESSONS?.[week]?.[subject];

  lessonSection.classList.remove("hidden");

  if (!lesson) {
    lessonContainer.innerHTML =
      '<p class="error">Lesson not found for this week and subject.</p>';
    return;
  }

  lessonMeta.textContent = `Basic 3 · 2026 · ${week}`;
  lessonTitle.textContent = subject;

  if (lesson.type === "google-doc") {
    lessonContainer.innerHTML = `
      <iframe
        class="lesson-frame"
        src="${lesson.url}"
        title="${subject} - ${week}"
        loading="lazy"
      ></iframe>
    `;
  } else if (lesson.type === "html") {
    lessonContainer.innerHTML = lesson.content;
  } else {
    lessonContainer.innerHTML =
      '<p class="error">This lesson type is not supported.</p>';
  }

  lessonSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

closeLessonBtn.addEventListener("click", () => {
  lessonSection.classList.add("hidden");
  lessonContainer.innerHTML =
    '<p class="placeholder">Choose a lesson to begin.</p>';
});

loadWeeks();