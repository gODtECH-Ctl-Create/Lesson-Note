// LessonHub term selection, class selection and hash routing.

const LESSON_CLASSES = [
  "Nursery 1",
  "Nursery 2",
  "Basic 1",
  "Basic 2",
  "Basic 3",
  "Basic 4",
  "Basic 5"
];

const ROUTE_SCREENS = {
  terms: "termScreen",
  classes: "classScreen",
  dashboard: "dashboardScreen",
  lessons: "workspaceScreen",
  curriculum: "curriculumScreen",
  completed: "completedScreen",
  progress: "progressScreen"
};

const TERM_ICONS = {
  first: "1",
  second: "2",
  third: "3"
};

function parseRoute() {
  const raw = (window.location.hash || "#/terms").replace(/^#\/?/, "");
  const [pathPart, queryPart = ""] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const params = new URLSearchParams(queryPart);

  if (!segments.length || segments[0] === "terms") {
    return { route: "terms", term: "", params, legacy: false };
  }

  if (window.LESSON_TERM_CONFIG?.[segments[0]]) {
    return {
      term: segments[0],
      route: segments[1] || "classes",
      params,
      legacy: false
    };
  }

  // Compatibility with old routes such as #/dashboard.
  if (ROUTE_SCREENS[segments[0]]) {
    return {
      term: window.LessonHubTerm?.get() || "first",
      route: segments[0],
      params,
      legacy: true
    };
  }

  return { route: "terms", term: "", params, legacy: false };
}

function routeHash(route, params = {}, term = window.LessonHubTerm?.get() || "") {
  if (route === "terms") return "#/terms";

  const safeTerm = window.LESSON_TERM_CONFIG?.[term] ? term : "first";
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? "?" + query.toString() : "";
  return "#/" + safeTerm + "/" + route + suffix;
}

function navigate(route, params = {}, options = {}) {
  const term = options.term || window.LessonHubTerm?.get() || "";
  const next = routeHash(route, params, term);

  if (options.replace) {
    history.replaceState(null, "", next);
    applyRoute();
    return;
  }

  if (window.location.hash === next) {
    applyRoute();
  } else {
    window.location.hash = next;
  }
}

function showScreen(screenId) {
  Object.values(ROUTE_SCREENS).forEach((id) => {
    document.getElementById(id)?.classList.toggle("hidden", id !== screenId);
  });
  window.scrollTo({ top: 0, behavior: "auto" });
}

function syncContextLabels() {
  const term = window.LessonHubTerm?.get() || "";
  const termLabel = window.LessonHubTerm?.label(term) || "";
  const selectedClass = window.LessonHubClass?.get(term) || "";

  const textBindings = {
    dashboardClassName: selectedClass || "Class Dashboard",
    selectedClassName: selectedClass || "Class",
    completedClassName: selectedClass || "Class",
    completedTermName: termLabel || "Term",
    progressTermName: termLabel || "this term",
    dashboardTermBadge: termLabel,
    workspaceTermChip: termLabel,
    curriculumTermName: termLabel || "this term",
    classTermEyebrow: termLabel || "Academic term"
  };

  Object.entries(textBindings).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  const curriculumClassName = document.getElementById("curriculumClassName");
  if (curriculumClassName) {
    curriculumClassName.textContent = selectedClass ? selectedClass + " curriculum" : "Class curriculum";
  }

  const curriculumTermEyebrow = document.getElementById("curriculumTermEyebrow");
  if (curriculumTermEyebrow) {
    curriculumTermEyebrow.textContent = termLabel ? termLabel + " · Main curriculum" : "Main curriculum";
  }

  const progressClassName = document.getElementById("progressClassName");
  if (progressClassName) {
    progressClassName.textContent = selectedClass ? selectedClass + " progress" : "Class progress";
  }

  const workspaceTermEyebrow = document.getElementById("workspaceTermEyebrow");
  if (workspaceTermEyebrow) {
    workspaceTermEyebrow.textContent = termLabel ? termLabel + " lesson notes" : "Lesson notes";
  }

  const completedTermEyebrow = document.getElementById("completedTermEyebrow");
  if (completedTermEyebrow) {
    completedTermEyebrow.textContent = termLabel ? termLabel + " · Completed lessons" : "Completed lessons";
  }

  const progressTermEyebrow = document.getElementById("progressTermEyebrow");
  if (progressTermEyebrow) {
    progressTermEyebrow.textContent = termLabel ? termLabel + " · Class progress" : "Class progress";
  }
}

function resetOpenLesson() {
  window.LessonHubLessons?.close?.({ updateRoute: false });
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function openLessonFromTracker(week, subject) {
  navigate("lessons", { week, subject });
}

function renderCompletedLessons() {
  const list = document.getElementById("completedList");
  const count = document.getElementById("completedCount");
  if (!list || !window.LessonHubProgress) return;

  const term = window.LessonHubTerm?.get() || "";
  const selectedClass = window.LessonHubClass?.get(term) || "";
  const records = window.LessonHubProgress.recordsForClass(selectedClass, term);
  const completed = window.LessonHubProgress.catalogue(term, selectedClass).filter((lesson) => (
    records[lesson.key]?.status === "completed"
  ));

  if (count) count.textContent = String(completed.length);

  if (!completed.length) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">✅</span>
        <h2>No completed lessons yet</h2>
        <p>Open a lesson note and mark it as completed. It will appear here automatically for this term.</p>
        <button class="primary-btn" type="button" data-go-lessons>Open lesson notes</button>
      </div>
    `;
    list.querySelector("[data-go-lessons]")?.addEventListener("click", () => navigate("lessons"));
    return;
  }

  list.innerHTML = completed.map((lesson) => {
    const record = records[lesson.key] || {};
    return `
      <button class="status-row" type="button" data-week="${lesson.week}" data-subject="${lesson.subject}">
        <span class="status-dot status-dot-completed">✓</span>
        <span class="status-row-copy">
          <strong>${lesson.subject}</strong>
          <small>${lesson.week}${lesson.topic ? " · " + lesson.topic : ""}</small>
        </span>
        <span class="status-row-meta">
          <small>${record.completedAt ? "Completed " + formatDate(record.completedAt) : "Completed"}</small>
          <span aria-hidden="true">→</span>
        </span>
      </button>
    `;
  }).join("");

  list.querySelectorAll("[data-week][data-subject]").forEach((row) => {
    row.addEventListener("click", () => openLessonFromTracker(row.dataset.week, row.dataset.subject));
  });
}

function renderProgress() {
  if (!window.LessonHubProgress) return;

  const term = window.LessonHubTerm?.get() || "";
  const selectedClass = window.LessonHubClass?.get(term) || "";
  const summary = window.LessonHubProgress.summary(selectedClass, term);
  const records = window.LessonHubProgress.recordsForClass(selectedClass, term);
  const catalogue = window.LessonHubProgress.catalogue(term, selectedClass);

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  };

  setText("progressPercent", summary.percent + "%");
  setText("progressCompletedCount", summary.completed);
  setText("progressStartedCount", summary.started);
  setText("progressRemainingCount", summary.remaining);

  const progressBar = document.getElementById("progressBar");
  if (progressBar) progressBar.style.width = summary.percent + "%";

  const list = document.getElementById("progressLessonList");
  if (!list) return;

  if (!catalogue.length) {
    const termLabel = window.LessonHubTerm?.label(term) || "This term";
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📚</span>
        <h2>No lessons loaded for ${termLabel}</h2>
        <p>Connect this term's lesson document, then open Lesson Notes to load its weeks and subjects.</p>
        <button class="primary-btn" type="button" data-go-lessons>Open lesson notes</button>
      </div>
    `;
    list.querySelector("[data-go-lessons]")?.addEventListener("click", () => navigate("lessons"));
    return;
  }

  const ranked = [...catalogue].sort((a, b) => {
    const order = { started: 0, completed: 1, none: 2 };
    const statusA = records[a.key]?.status || "none";
    const statusB = records[b.key]?.status || "none";
    return order[statusA] - order[statusB];
  });

  list.innerHTML = ranked.map((lesson) => {
    const status = records[lesson.key]?.status || "none";
    const label = status === "completed" ? "Completed" : status === "started" ? "In progress" : "Not started";
    const icon = status === "completed" ? "✓" : status === "started" ? "◐" : "○";

    return `
      <button class="status-row" type="button" data-week="${lesson.week}" data-subject="${lesson.subject}">
        <span class="status-dot status-dot-${status}">${icon}</span>
        <span class="status-row-copy">
          <strong>${lesson.subject}</strong>
          <small>${lesson.week}${lesson.topic ? " · " + lesson.topic : ""}</small>
        </span>
        <span class="status-badge status-badge-${status}">${label}</span>
      </button>
    `;
  }).join("");

  list.querySelectorAll("[data-week][data-subject]").forEach((row) => {
    row.addEventListener("click", () => openLessonFromTracker(row.dataset.week, row.dataset.subject));
  });
}

function refreshTrackerPages() {
  syncContextLabels();
  renderCompletedLessons();
  renderProgress();
}

async function applyRoute() {
  let { route, term, params, legacy } = parseRoute();

  if (!ROUTE_SCREENS[route]) {
    navigate("terms", {}, { replace: true });
    return;
  }

  if (route === "terms") {
    showScreen("termScreen");
    return;
  }

  if (!window.LESSON_TERM_CONFIG?.[term]) {
    navigate("terms", {}, { replace: true });
    return;
  }

  if (window.LessonHubTerm?.get() !== term) {
    window.LessonHubTerm?.set(term);
    window.lessonApi?.configureForTerm?.(term);
  }

  if (legacy) {
    navigate(route, Object.fromEntries(params.entries()), { term, replace: true });
    return;
  }

  const selectedClass = window.LessonHubClass?.get(term) || "";

  if (route !== "classes" && !selectedClass) {
    navigate("classes", {}, { term, replace: true });
    return;
  }

  showScreen(ROUTE_SCREENS[route]);
  syncContextLabels();

  if (route === "curriculum") {
    await window.LessonHubCurriculum?.load?.();
  }

  if (route === "lessons") {
    await window.LessonHubLessons?.prepareSource?.();
    const week = params.get("week") || "";
    const subject = params.get("subject") || "";

    if (week && subject) {
      await window.LessonHubLessons?.restoreFromRoute?.(week, subject);
    } else {
      window.LessonHubLessons?.close?.({ updateRoute: false });
    }
  }

  if (route === "completed" || route === "progress") {
    await window.LessonHubLessons?.prepareSource?.();
    if (route === "completed") renderCompletedLessons();
    if (route === "progress") renderProgress();
  }
}

function renderTermSelector() {
  const container = document.getElementById("termSelector");
  if (!container) return;

  container.innerHTML = window.LessonHubTerm.all().map(({ key, label }) => {
    const connected = Boolean(window.LESSON_TERM_CONFIG?.[key]?.apiUrl) ||
      Boolean(window.LESSON_TERM_CONFIG?.[key]?.staticFallback);
    const sourceText = connected ? "Open term workspace" : "Ready for lesson document";

    return `
      <button class="term-card" type="button" data-term="${key}">
        <span class="term-number">${TERM_ICONS[key]}</span>
        <span class="term-card-copy">
          <strong>${label}</strong>
          <small>${sourceText}</small>
        </span>
        <span class="class-card-arrow" aria-hidden="true">→</span>
      </button>
    `;
  }).join("");

  container.querySelectorAll("[data-term]").forEach((button) => {
    button.addEventListener("click", () => {
      const term = button.dataset.term;
      window.LessonHubTerm.set(term);
      window.lessonApi?.configureForTerm?.(term);
      navigate("classes", {}, { term });
    });
  });
}

function renderClassSelector() {
  const container = document.getElementById("classSelector");
  if (!container) return;

  container.innerHTML = LESSON_CLASSES.map((item) => `
    <button class="class-card" type="button" data-class="${item}">
      <span class="class-card-icon">🎓</span>
      <span class="class-card-copy">
        <strong>${item}</strong>
        <small>Open dashboard</small>
      </span>
      <span class="class-card-arrow" aria-hidden="true">→</span>
    </button>
  `).join("");

  container.querySelectorAll("[data-class]").forEach((button) => {
    button.addEventListener("click", () => {
      const term = window.LessonHubTerm?.get() || "";
      window.LessonHubClass?.set(button.dataset.class, term);
      syncContextLabels();
      navigate("dashboard");
    });
  });
}

function setupNavigation() {
  document.getElementById("classBackBtn")?.addEventListener("click", () => navigate("terms"));

  document.getElementById("dashboardBackBtn")?.addEventListener("click", () => {
    resetOpenLesson();
    navigate("classes");
  });

  document.getElementById("workspaceBackBtn")?.addEventListener("click", () => {
    resetOpenLesson();
    navigate("dashboard");
  });

  document.getElementById("curriculumBackBtn")?.addEventListener("click", () => navigate("dashboard"));
  document.getElementById("completedBackBtn")?.addEventListener("click", () => navigate("dashboard"));
  document.getElementById("progressBackBtn")?.addEventListener("click", () => navigate("dashboard"));

  document.getElementById("openLessonsBtn")?.addEventListener("click", () => navigate("lessons"));
  document.getElementById("openCurriculumBtn")?.addEventListener("click", () => navigate("curriculum"));
  document.getElementById("openCompletedBtn")?.addEventListener("click", () => navigate("completed"));
  document.getElementById("openProgressBtn")?.addEventListener("click", () => navigate("progress"));
}

window.LessonHubRouter = {
  navigate,
  parseRoute,
  replaceLessonRoute(week = "", subject = "") {
    const params = week && subject ? { week, subject } : {};
    history.replaceState(null, "", routeHash("lessons", params));
  },
  refreshTrackerPages
};

window.addEventListener("hashchange", applyRoute);
window.addEventListener("lessonhub:progress-changed", refreshTrackerPages);

document.addEventListener("DOMContentLoaded", () => {
  renderTermSelector();
  renderClassSelector();
  syncContextLabels();
  setupNavigation();

  if (!window.location.hash) {
    history.replaceState(null, "", routeHash("terms"));
  }

  applyRoute();
});
