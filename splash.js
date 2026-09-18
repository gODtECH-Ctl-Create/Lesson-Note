// LessonHub startup loading screen

document.addEventListener("DOMContentLoaded", () => {
  const splash = document.getElementById("lessonSplash");
  if (!splash) return;

  setTimeout(() => {
    splash.classList.add("hide-splash");
    setTimeout(() => splash.remove(), 500);
  }, 2500);
});
