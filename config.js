// LessonHub term source configuration.
// First Term keeps the current connected Google Doc/API and bundled snapshot.
// Add the Second and Third Term Apps Script /exec URLs when those documents are ready.
window.LESSON_TERM_CONFIG = {
  first: {
    label: "First Term",
    apiUrl: "https://script.google.com/macros/s/AKfycbxDaT73zIeDj2TwjbWRr-pbPrN8xVJCqusn1WHgVzNCu1leKh3T9P7RK_XINC_txQ5t/exec",
    staticFallback: true
  },
  second: {
    label: "Second Term",
    apiUrl: "",
    staticFallback: false
  },
  third: {
    label: "Third Term",
    apiUrl: "",
    staticFallback: false
  }
};

// Backwards compatibility for older code paths.
window.LESSON_API_URL = window.LESSON_TERM_CONFIG.first.apiUrl;
