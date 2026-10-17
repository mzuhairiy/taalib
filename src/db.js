// Thin native IndexedDB wrapper. This is the client's durable cache — the
// working copy the app reads/writes synchronously-feeling via save.js, kept
// in sync with Postgres (the source of truth) by sync.js.
//
// Object stores:
//   subjects  (keyPath "id")
//   sessions  (keyPath "id", indexes on subjectId and date)
//   settings  (keyPath "userId" — one row, the signed-in user's)
//   meta      (keyPath "key" — lastPulledAt per table, which userId the
//              cache belongs to)
//
// Every subject/session row carries `dirty: boolean`, set on local mutation
// and cleared once pushed. That flag is the entire conflict-resolution
// mechanism: a dirty row is never overwritten by an incoming pull until it
// has been confirmed pushed.

const DB_NAME = "taalib";
const DB_VERSION = 1;

let dbPromise = null;

/**
 * Test-only: close the live connection and drop the cached promise, so a
 * fresh indexedDB.open() runs against a clean database. Just dropping the
 * promise without closing the connection leaves it open, which makes the
 * next test's indexedDB.deleteDatabase() block forever waiting for it.
 */
export async function _resetForTests() {
  if (dbPromise) {
    try { (await dbPromise).close(); } catch { /* already closed/erroring, fine */ }
  }
  dbPromise = null;
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("subjects")) {
        db.createObjectStore("subjects", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("sessions")) {
        const store = db.createObjectStore("sessions", { keyPath: "id" });
        store.createIndex("subjectId", "subjectId", { unique: false });
        store.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeNames, mode) {
  return openDb().then(db => db.transaction(storeNames, mode));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(storeName) {
  const t = await tx([storeName], "readonly");
  return reqToPromise(t.objectStore(storeName).getAll());
}

export async function get(storeName, key) {
  const t = await tx([storeName], "readonly");
  return reqToPromise(t.objectStore(storeName).get(key));
}

export async function put(storeName, value) {
  const t = await tx([storeName], "readwrite");
  return reqToPromise(t.objectStore(storeName).put(value));
}

export async function putAll(storeName, values) {
  if (!values.length) return;
  const t = await tx([storeName], "readwrite");
  const store = t.objectStore(storeName);
  for (const v of values) store.put(v);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function remove(storeName, key) {
  const t = await tx([storeName], "readwrite");
  return reqToPromise(t.objectStore(storeName).delete(key));
}

export async function clearStore(storeName) {
  const t = await tx([storeName], "readwrite");
  return reqToPromise(t.objectStore(storeName).clear());
}

/**
 * Clears cached data rows when the signed-in account on this device changes.
 * Deliberately leaves `meta` alone — `legacyMigrated` is a per-browser fact
 * (has this profile's pre-auth localStorage blob already been consumed?),
 * not a per-account one, and must survive an account switch so the same
 * stale blob can't be migrated twice into two different accounts. Sync
 * watermarks ARE per-account and are reset explicitly by the caller.
 */
export async function clearAll() {
  await Promise.all([
    clearStore("subjects"),
    clearStore("sessions"),
    clearStore("settings"),
  ]);
}

/* ===== meta helpers ===== */

export async function getMeta(key) {
  const row = await get("meta", key);
  return row ? row.value : null;
}
export async function setMeta(key, value) {
  return put("meta", { key, value });
}

/* ===== dirty-row helpers used by sync.js ===== */

export async function getDirty(storeName) {
  const all = await getAll(storeName);
  return all.filter(r => r.dirty);
}

export async function clearDirty(storeName, ids) {
  if (!ids.length) return;
  const t = await tx([storeName], "readwrite");
  const store = t.objectStore(storeName);
  for (const id of ids) {
    const row = await reqToPromise(store.get(id));
    if (row && row.dirty) {
      row.dirty = false;
      store.put(row);
    }
  }
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
