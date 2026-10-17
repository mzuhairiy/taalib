// Polyfills so save.js/db.js/migrate-legacy.js (written for the browser) run
// under Node for tests. fake-indexeddb gives a faithful (not hand-mocked)
// IndexedDB implementation, which matters here since db.js's transaction and
// index behavior is exactly what's under test.
import "fake-indexeddb/auto";
import { beforeEach } from "vitest";
import { _resetForTests } from "../src/db.js";
import { _resetStateForTests } from "../src/save.js";

class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(String(k), String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
globalThis.localStorage = new MemoryStorage();

// Fresh IndexedDB + localStorage before every test, across every test file,
// so tests never leak state into one another via the shared fake-indexeddb
// process-global.
beforeEach(async () => {
  globalThis.localStorage.clear();
  await _resetForTests(); // closes any open connection first, so delete below can't block
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase("taalib");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // shouldn't happen now that the connection is closed first
  });
  _resetStateForTests();
});
