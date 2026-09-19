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
    apiUrl: "https://script.google.com/macros/s/AKfycbyRJjkphjFUzEFuvfpr2TcCs3-Ite-663JxqHy7qFlq1fOIG2kN5YBiqjZHS6MiLUxD/exec",
    staticFallback: false
  },
  third: {
    label: "Third Term",
    apiUrl: "https://script.google.com/macros/s/AKfycbz5q1jBvfhfzIwUAxWkdPYxQgsp6AiwM5i3RvexbXQFL3Gxd3fNDlvRb1rT4JP9j10/exec",
    staticFallback: false
  }
};

// Backwards compatibility for older code paths.
window.LESSON_API_URL = window.LESSON_TERM_CONFIG.first.apiUrl;
