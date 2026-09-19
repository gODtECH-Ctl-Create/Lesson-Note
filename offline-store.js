// LessonHub offline lesson storage powered by IndexedDB.
(function () {
  const DB_NAME = "lessonhub-offline";
  const DB_VERSION = 1;
  const LESSONS = "lessons";
  const META = "meta";

  let dbPromise = null;

  function openDb() {
    if (!("indexedDB" in window)) {
      return Promise.reject(new Error("IndexedDB is not supported on this device."));
    }

    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(LESSONS)) {
          const lessons = db.createObjectStore(LESSONS, { keyPath: "id" });
          lessons.createIndex("term", "term", { unique: false });
        }

        if (!db.objectStoreNames.contains(META)) {
          db.createObjectStore(META, { keyPath: "key" });
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

  async function lessonRecords(term) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(LESSONS, "readonly");
      const index = tx.objectStore(LESSONS).index("term");
      const request = index.getAll(IDBKeyRange.only(term));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  function lessonId(term, week, subject) {
    return [term, week, subject].map((value) => String(value || "").trim()).join("::");
  }

  async function saveLesson(term, lesson, kind = "live", sourceModifiedAt = "") {
    if (!term || !lesson?.week || !lesson?.subject) return null;

    return put(LESSONS, {
      id: lessonId(term, lesson.week, lesson.subject),
      term,
      week: lesson.week,
      subject: lesson.subject,
      kind,
      lesson,
      sourceModifiedAt: sourceModifiedAt || lesson.modifiedAt || "",
      savedAt: new Date().toISOString()
    });
  }

  async function getLesson(term, week, subject) {
    return get(LESSONS, lessonId(term, week, subject));
  }

  async function saveManifest(term, manifest, index) {
    return put(META, {
      key: "manifest:" + term,
      term,
      manifest: manifest || null,
      index: index || {},
      modifiedAt: manifest?.modifiedAt || "",
      savedAt: new Date().toISOString()
    });
  }

  async function getManifest(term) {
    return get(META, "manifest:" + term);
  }

  async function saveSyncState(term, state) {
    return put(META, {
      key: "sync:" + term,
      term,
      ...state,
      savedAt: new Date().toISOString()
    });
  }

  async function getSyncState(term) {
    return get(META, "sync:" + term);
  }

  async function countLessons(term) {
    const records = await lessonRecords(term);
    return records.length;
  }

  async function clearTerm(term) {
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction([LESSONS, META], "readwrite");
      const lessonStore = tx.objectStore(LESSONS);
      const index = lessonStore.index("term");
      const request = index.openCursor(IDBKeyRange.only(term));

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        cursor.delete();
        cursor.continue();
      };

      tx.objectStore(META).delete("manifest:" + term);
      tx.objectStore(META).delete("sync:" + term);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  window.LessonHubOffline = {
    supported: "indexedDB" in window,
    lessonId,
    saveLesson,
    getLesson,
    saveManifest,
    getManifest,
    saveSyncState,
    getSyncState,
    countLessons,
    clearTerm
  };
})();
