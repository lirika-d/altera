/**
 * Test setup: install fake-indexeddb globals BEFORE any Dexie code runs.
 * `fake-indexeddb/auto` patches globalThis.indexedDB, IDBKeyRange, etc.
 */
import 'fake-indexeddb/auto'
