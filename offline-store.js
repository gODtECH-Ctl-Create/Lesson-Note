// LessonHub offline lesson storage powered by IndexedDB.
// Lesson data is isolated by academic term AND class.
(function () {
  const DB_NAME = "lessonhub-offline";
  const DB_VERSION = 2;
  const LESSONS = "lessons";
  const META = "meta";

  let dbPromise = null;

  function currentTerm() {
    return window.LessonHubTerm?.get?.() || "first";
  }

  function currentClass(term = currentTerm()) {
    return window.LessonHubClass?.get?.(term) || "";
  }

  function scopeKey(term = currentTerm(), className = currentClass(term)) {
    return [String(term || "").trim(), String(className || "").trim()].join("::");
  }

  function openDb() {
    if (!("indexedDB" in window)) {
      return Promise.reject(new Error("IndexedDB is not supported on this device."));
    }

    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const tx = request.transaction;

        let lessonStore;
        if (!db.objectStoreNames.contains(LESSONS)) {
          lessonStore = db.createObjectStore(LESSONS, { keyPath: "id" });
          lessonStore.createIndex("scope", "scope", { unique: false });
        } else {
          lessonStore = tx.objectStore(LESSONS);
          if (!lessonStore.indexNames.contains("scope")) {
            lessonStore.createIndex("scope", "scope", { unique: false });
          }
        }

        let metaStore;
        if (!db.objectStoreNames.contains(META)) {
          metaStore = db.createObjectStore(META, { keyPath: "key" });
        } else {
          metaStore = tx.objectStore(META);
        }

        // Version 1 did not include the class in lesson/cache keys. That means
        // Basic 3 data could appear under another selected class. Remove only
        // the old offline cache during this upgrade; progress is stored
        // separately and is not touched.
        if (event.oldVersion > 0 && event.oldVersion < 2) {
          lessonStore.clear();
          metaStore.clear();
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open offline storage."));
    });

    return dbPromise;
  }

  async function get(storeName, key) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function put(storeName, value) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Offline storage transaction was aborted."));
    });
  }

  async function lessonRecords(term = currentTerm(), className = currentClass(term)) {
    if (!term || !className) return [];

    const db = await openDb();
    const scope = scopeKey(term, className);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(LESSONS, "readonly");
      const index = tx.objectStore(LESSONS).index("scope");
      const request = index.getAll(IDBKeyRange.only(scope));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  function lessonId(term, className, week, subject) {
    return [
      String(term || "").trim(),
      String(className || "").trim(),
      String(week || "").trim(),
      String(subject || "").trim()
    ].join("::");
  }

  async function saveLesson(
    term,
    className,
    lesson,
    kind = "live",
    sourceModifiedAt = ""
  ) {
    if (!term || !className || !lesson?.week || !lesson?.subject) return null;

    return put(LESSONS, {
      id: lessonId(term, className, lesson.week, lesson.subject),
      scope: scopeKey(term, className),
      term,
      className,
      week: lesson.week,
      subject: lesson.subject,
      kind,
      lesson,
      sourceModifiedAt: sourceModifiedAt || lesson.modifiedAt || "",
      savedAt: new Date().toISOString()
    });
  }

  async function getLesson(term, className, week, subject) {
    return get(LESSONS, lessonId(term, className, week, subject));
  }

  async function saveManifest(term, className, manifest, index) {
    if (!term || !className) return null;

    return put(META, {
      key: "manifest:" + scopeKey(term, className),
      scope: scopeKey(term, className),
      term,
      className,
      manifest: manifest || null,
      index: index || {},
      modifiedAt: manifest?.modifiedAt || "",
      savedAt: new Date().toISOString()
    });
  }

  async function getManifest(term = currentTerm(), className = currentClass(term)) {
    if (!term || !className) return null;
    return get(META, "manifest:" + scopeKey(term, className));
  }

  async function saveCurriculum(term, className, curriculum) {
    if (!term || !className || !curriculum) return null;

    return put(META, {
      key: "curriculum:" + scopeKey(term, className),
      scope: scopeKey(term, className),
      term,
      className,
      curriculum,
      modifiedAt: curriculum?.modifiedAt || "",
      savedAt: new Date().toISOString()
    });
  }

  async function getCurriculum(term = currentTerm(), className = currentClass(term)) {
    if (!term || !className) return null;
    return get(META, "curriculum:" + scopeKey(term, className));
  }

  async function saveSyncState(term, className, state) {
    if (!term || !className) return null;

    return put(META, {
      key: "sync:" + scopeKey(term, className),
      scope: scopeKey(term, className),
      term,
      className,
      ...state,
      savedAt: new Date().toISOString()
    });
  }

  async function getSyncState(term = currentTerm(), className = currentClass(term)) {
    if (!term || !className) return null;
    return get(META, "sync:" + scopeKey(term, className));
  }

  async function countLessons(term = currentTerm(), className = currentClass(term)) {
    const records = await lessonRecords(term, className);
    return records.length;
  }

  async function clearScope(term = currentTerm(), className = currentClass(term)) {
    if (!term || !className) return;

    const db = await openDb();
    const scope = scopeKey(term, className);

    return new Promise((resolve, reject) => {
      const tx = db.transaction([LESSONS, META], "readwrite");
      const lessonStore = tx.objectStore(LESSONS);
      const index = lessonStore.index("scope");
      const request = index.openCursor(IDBKeyRange.only(scope));

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };

      tx.objectStore(META).delete("manifest:" + scope);
      tx.objectStore(META).delete("curriculum:" + scope);
      tx.objectStore(META).delete("sync:" + scope);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  window.LessonHubOffline = {
    supported: "indexedDB" in window,
    scopeKey,
    lessonId,
    saveLesson,
    getLesson,
    saveManifest,
    getManifest,
    saveCurriculum,
    getCurriculum,
    saveSyncState,
    getSyncState,
    countLessons,
    clearScope
  };
})();
