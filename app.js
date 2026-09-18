const STORAGE_KEY = "lessonNotePlatform.lessons.v1";

const browseTab = document.getElementById("browseTab");
const manageTab = document.getElementById("manageTab");
const browsePanel = document.getElementById("browsePanel");
const managePanel = document.getElementById("managePanel");

const classSelect = document.getElementById("classSelect");
const weekSelect = document.getElementById("weekSelect");
const subjectSelect = document.getElementById("subjectSelect");
const viewLessonBtn = document.getElementById("viewLessonBtn");
const emptyBrowseState = document.getElementById("emptyBrowseState");

const lessonSection = document.getElementById("lessonSection");
const lessonMeta = document.getElementById("lessonMeta");
const lessonTitle = document.getElementById("lessonTitle");
const lessonContainer = document.getElementById("lessonContainer");
const openDocLink = document.getElementById("openDocLink");
const closeLessonBtn = document.getElementById("closeLessonBtn");

const lessonForm = document.getElementById("lessonForm");
const lessonId = document.getElementById("lessonId");
const classInput = document.getElementById("classInput");
const weekInput = document.getElementById("weekInput");
const subjectInput = document.getElementById("subjectInput");
const titleInput = document.getElementById("titleInput");
const docUrlInput = document.getElementById("docUrlInput");
const formHeading = document.getElementById("formHeading");
const formMessage = document.getElementById("formMessage");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const clearFormBtn = document.getElementById("clearFormBtn");
const savedLessonsList = document.getElementById("savedLessonsList");
const savedCount = document.getElementById("savedCount");
const searchLessons = document.getElementById("searchLessons");

function loadLessons() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLessons(lessons) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
}

function normalized(value) {
  return value.trim().replace(/\s+/g, " ");
}

function makeId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "lesson-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function parseGoogleDocUrl(url) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname !== "docs.google.com") {
      return null;
    }

    const publishedMatch = parsed.pathname.match(/^\/document\/d\/e\/([^/]+)\/pub$/);
    if (publishedMatch) {
      return {
        originalUrl: url,
        previewUrl: "https://docs.google.com/document/d/e/" + publishedMatch[1] + "/pub?embedded=true"
      };
    }

    const normalMatch = parsed.pathname.match(/^\/document\/d\/([^/]+)/);
    if (!normalMatch) return null;

    const id = normalMatch[1];
    return {
      originalUrl: "https://docs.google.com/document/d/" + id + "/edit",
      previewUrl: "https://docs.google.com/document/d/" + id + "/preview"
    };
  } catch {
    return null;
  }
}

function naturalWeekSort(a, b) {
  const aNum = Number((a.match(/\d+/) || [999])[0]);
  const bNum = Number((b.match(/\d+/) || [999])[0]);
  if (aNum !== bNum) return aNum - bNum;
  return a.localeCompare(b);
}

function uniqueSorted(values, sorter) {
  return [...new Set(values)].sort(sorter || ((a, b) => a.localeCompare(b)));
}

function switchTab(tab) {
  const browsing = tab === "browse";
  browseTab.classList.toggle("active", browsing);
  manageTab.classList.toggle("active", !browsing);
  browsePanel.classList.toggle("hidden", !browsing);
  managePanel.classList.toggle("hidden", browsing);

  if (browsing) refreshBrowseSelectors();
  else renderSavedLessons();
}

function resetSelect(select, text, disabled = true) {
  select.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.textContent = text;
  select.appendChild(option);
  select.disabled = disabled;
}

function fillSelect(select, values, placeholder) {
  resetSelect(select, placeholder, false);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function refreshBrowseSelectors() {
  const lessons = loadLessons();
  const previousClass = classSelect.value;

  const classes = uniqueSorted(lessons.map((x) => x.className));
  fillSelect(classSelect, classes, "Select class");

  if (classes.includes(previousClass)) {
    classSelect.value = previousClass;
    populateWeeks();
  } else {
    resetSelect(weekSelect, "Select week");
    resetSelect(subjectSelect, "Select subject");
    viewLessonBtn.disabled = true;
  }

  emptyBrowseState.classList.toggle("hidden", lessons.length > 0);
}

function populateWeeks() {
  const lessons = loadLessons();
  const selectedClass = classSelect.value;

  const weeks = uniqueSorted(
    lessons.filter((x) => x.className === selectedClass).map((x) => x.week),
    naturalWeekSort
  );

  fillSelect(weekSelect, weeks, "Select week");
  resetSelect(subjectSelect, "Select subject");
  viewLessonBtn.disabled = true;
}

function populateSubjects() {
  const lessons = loadLessons();
  const selectedClass = classSelect.value;
  const selectedWeek = weekSelect.value;

  const subjects = uniqueSorted(
    lessons
      .filter((x) => x.className === selectedClass && x.week === selectedWeek)
      .map((x) => x.subject)
  );

  fillSelect(subjectSelect, subjects, "Select subject");
  viewLessonBtn.disabled = true;
}

function selectedLesson() {
  return loadLessons().find(
    (lesson) =>
      lesson.className === classSelect.value &&
      lesson.week === weekSelect.value &&
      lesson.subject === subjectSelect.value
  );
}

function showLesson(lesson) {
  if (!lesson) return;

  lessonMeta.textContent = [lesson.className, lesson.week].filter(Boolean).join(" · ");
  lessonTitle.textContent = lesson.title || lesson.subject;
  openDocLink.href = lesson.docUrl;

  lessonContainer.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.className = "lesson-frame";
  iframe.src = lesson.previewUrl;
  iframe.title = [lesson.subject, lesson.week, lesson.className].join(" - ");
  iframe.loading = "lazy";
  iframe.setAttribute("allowfullscreen", "");
  lessonContainer.appendChild(iframe);

  lessonSection.classList.remove("hidden");
  lessonSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearForm() {
  lessonForm.reset();
  lessonId.value = "";
  formHeading.textContent = "Add Lesson";
  cancelEditBtn.classList.add("hidden");
  formMessage.classList.add("hidden");
  formMessage.textContent = "";
}

function setMessage(message, type = "success") {
  formMessage.textContent = message;
  formMessage.className = "form-message " + type;
}

function editLesson(id) {
  const lesson = loadLessons().find((x) => x.id === id);
  if (!lesson) return;

  lessonId.value = lesson.id;
  classInput.value = lesson.className;
  weekInput.value = lesson.week;
  subjectInput.value = lesson.subject;
  titleInput.value = lesson.title || "";
  docUrlInput.value = lesson.docUrl;

  formHeading.textContent = "Edit Lesson";
  cancelEditBtn.classList.remove("hidden");
  window.scrollTo({ top: managePanel.offsetTop - 20, behavior: "smooth" });
}

function deleteLesson(id) {
  const lessons = loadLessons();
  const lesson = lessons.find((x) => x.id === id);
  if (!lesson) return;

  const label = [lesson.className, lesson.week, lesson.subject].join(" · ");
  if (!window.confirm('Delete "' + label + '" from this browser?')) return;

  saveLessons(lessons.filter((x) => x.id !== id));
  renderSavedLessons();
  refreshBrowseSelectors();
}

function renderSavedLessons() {
  const query = searchLessons.value.trim().toLowerCase();
  const allLessons = loadLessons();

  const lessons = allLessons
    .filter((lesson) =>
      [lesson.className, lesson.week, lesson.subject, lesson.title]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    )
    .sort((a, b) =>
      a.className.localeCompare(b.className) ||
      naturalWeekSort(a.week, b.week) ||
      a.subject.localeCompare(b.subject)
    );

  savedCount.textContent =
    allLessons.length === 1 ? "1 lesson saved on this device" : allLessons.length + " lessons saved on this device";

  savedLessonsList.innerHTML = "";

  if (!lessons.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state compact";
    empty.textContent = allLessons.length ? "No saved lessons match your search." : "No lessons saved yet.";
    savedLessonsList.appendChild(empty);
    return;
  }

  lessons.forEach((lesson) => {
    const card = document.createElement("article");
    card.className = "saved-item";

    const main = document.createElement("div");
    main.className = "saved-item-main";

    const title = document.createElement("h3");
    title.textContent = lesson.title || lesson.subject;

    const meta = document.createElement("p");
    meta.textContent = [lesson.className, lesson.week, lesson.subject].join(" · ");

    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "saved-actions";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "secondary-btn small-btn";
    open.textContent = "View";
    open.addEventListener("click", () => {
      switchTab("browse");
      classSelect.value = lesson.className;
      populateWeeks();
      weekSelect.value = lesson.week;
      populateSubjects();
      subjectSelect.value = lesson.subject;
      viewLessonBtn.disabled = false;
      showLesson(lesson);
    });

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary-btn small-btn";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editLesson(lesson.id));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger-btn small-btn";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteLesson(lesson.id));

    actions.append(open, edit, remove);
    card.append(main, actions);
    savedLessonsList.appendChild(card);
  });
}

lessonForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const className = normalized(classInput.value);
  const week = normalized(weekInput.value);
  const subject = normalized(subjectInput.value);
  const title = normalized(titleInput.value);
  const parsedUrl = parseGoogleDocUrl(docUrlInput.value.trim());

  if (!className || !week || !subject) {
    setMessage("Class, week, and subject are required.", "error");
    return;
  }

  if (!parsedUrl) {
    setMessage("Please enter a valid Google Docs document link.", "error");
    return;
  }

  const lessons = loadLessons();
  const editingId = lessonId.value;

  const duplicate = lessons.find(
    (x) =>
      x.id !== editingId &&
      x.className.toLowerCase() === className.toLowerCase() &&
      x.week.toLowerCase() === week.toLowerCase() &&
      x.subject.toLowerCase() === subject.toLowerCase()
  );

  if (duplicate) {
    setMessage("A lesson already exists for this class, week, and subject. Edit the existing one instead.", "error");
    return;
  }

  const entry = {
    id: editingId || makeId(),
    className,
    week,
    subject,
    title,
    docUrl: parsedUrl.originalUrl,
    previewUrl: parsedUrl.previewUrl,
    updatedAt: new Date().toISOString()
  };

  const next = editingId
    ? lessons.map((x) => (x.id === editingId ? entry : x))
    : [...lessons, entry];

  saveLessons(next);
  clearForm();
  setMessage(editingId ? "Lesson updated on this device." : "Lesson saved on this device.");
  renderSavedLessons();
  refreshBrowseSelectors();
});

browseTab.addEventListener("click", () => switchTab("browse"));
manageTab.addEventListener("click", () => switchTab("manage"));

classSelect.addEventListener("change", populateWeeks);
weekSelect.addEventListener("change", populateSubjects);
subjectSelect.addEventListener("change", () => {
  viewLessonBtn.disabled = !subjectSelect.value;
});

viewLessonBtn.addEventListener("click", () => showLesson(selectedLesson()));
closeLessonBtn.addEventListener("click", () => lessonSection.classList.add("hidden"));
clearFormBtn.addEventListener("click", clearForm);
cancelEditBtn.addEventListener("click", clearForm);
searchLessons.addEventListener("input", renderSavedLessons);

refreshBrowseSelectors();
renderSavedLessons();