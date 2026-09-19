// LessonHub class selection, navigation and lightweight hash routing.

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
  classes: "classScreen",
  dashboard: "dashboardScreen",
  lessons: "workspaceScreen",
  completed: "completedScreen",
  progress: "progressScreen"
};

function parseRoute() {
  const raw = (window.location.hash || "#/classes").replace(/^#\/?/, "");
  const [pathPart, queryPart = ""] = raw.split("?");
  const route = pathPart || "classes";
  const params = new URLSearchParams(queryPart);
  return { route, params };
}

function routeHash(route, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== "") {
      query.set(key, String(value));
    }
  });

  const suffix = query.toString() ? "?" + query.toString() : "";
  return "#/" + route + suffix;
}

function navigate(route, params = {}, options = {}) {
  const next = routeHash(route, params);
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

function syncSelectedClass() {
  const selected = window.LessonHubClass?.get() || "";
  const bindings = [
    "dashboardClassName",
    "selectedClassName",
    "completedClassName"
  ];

  bindings.forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.textContent = selected || "Class";
  });

  const progressClassName = document.getElementById("progressClassName");
  if (progressClassName) progressClassName.textContent = selected ? selected + " progress" : "Class progress";
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

  const selectedClass = window.LessonHubClass?.get() || "";
  const records = window.LessonHubProgress.recordsForClass(selectedClass);
  const completed = window.LessonHubProgress.catalogue().filter((lesson) => (
    records[lesson.key]?.status === "completed"
  ));

  if (count) count.textContent = String(completed.length);

  if (!completed.length) {
    list.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">✅</span>
        <h2>No completed lessons yet</h2>
        <p>Open a lesson note and mark it as completed. It will appear here automatically.</p>
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

  const selectedClass = window.LessonHubClass?.get() || "";
  const summary = window.LessonHubProgress.summary(selectedClass);
  const records = window.LessonHubProgress.recordsForClass(selectedClass);
  const catalogue = window.LessonHubProgress.catalogue();

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
    list.innerHTML = '<div class="empty-state"><h2>No lessons available</h2><p>Lesson progress will appear here once lessons are loaded.</p></div>';
    return;
  }

  const ranked = [...catalogue].sort((a, b) => {
    const order = { started: 0, completed: 1, none: 2 };
    const statusA = records[a.key]?.status || "none";
    const statusB = records[b.key]?.status || "none";
    return order[statusA] - order[statusB];
  });

  list.innerHTML = ranked.map((lesson) => {
    const record = records[lesson.key] || {};
    const status = record.status || "none";
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
  syncSelectedClass();
  renderCompletedLessons();
  renderProgress();
}

function applyRoute() {
  let { route, params } = parseRoute();
  const selectedClass = window.LessonHubClass?.get() || "";

  if (!ROUTE_SCREENS[route]) route = "classes";

  if (route !== "classes" && !selectedClass) {
    navigate("classes", {}, { replace: true });
    return;
  }

  showScreen(ROUTE_SCREENS[route]);
  syncSelectedClass();

  if (route === "completed") renderCompletedLessons();
  if (route === "progress") renderProgress();

  if (route === "lessons") {
    const week = params.get("week") || "";
    const subject = params.get("subject") || "";

    if (week && subject) {
      window.LessonHubLessons?.restoreFromRoute?.(week, subject);
    } else {
      window.LessonHubLessons?.close?.({ updateRoute: false });
    }
  }
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
      window.LessonHubClass?.set(button.dataset.class);
      syncSelectedClass();
      navigate("dashboard");
    });
  });
}

function setupNavigation() {
  document.getElementById("dashboardBackBtn")?.addEventListener("click", () => {
    resetOpenLesson();
    navigate("classes");
  });

  document.getElementById("workspaceBackBtn")?.addEventListener("click", () => {
    resetOpenLesson();
    navigate("dashboard");
  });

  document.getElementById("completedBackBtn")?.addEventListener("click", () => navigate("dashboard"));
  document.getElementById("progressBackBtn")?.addEventListener("click", () => navigate("dashboard"));

  document.getElementById("openLessonsBtn")?.addEventListener("click", () => navigate("lessons"));
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
  renderClassSelector();
  syncSelectedClass();
  setupNavigation();

  if (!window.location.hash) {
    history.replaceState(null, "", routeHash("classes"));
  }

  applyRoute();
});