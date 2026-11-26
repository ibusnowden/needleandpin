// Tiny IndexedDB key-value store for saves (no account needed, §12). Falls back to memory when
// IndexedDB is unavailable (private windows, previews), so the game always runs.
import type { GameState } from "../sim/types.ts";

export interface SaveData { state: GameState; snapshots?: { turn: number; state: GameState }[] }

const DB = "needle-and-pin";
const STORE = "saves";
const memory = new Map<string, SaveData>();

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function put(key: string, value: SaveData): Promise<void> {
  const db = await open();
  if (!db) { memory.set(key, value); return; }
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => { memory.set(key, value); resolve(); };
    } catch {
      memory.set(key, value);
      resolve();
    }
  });
}

export async function get(key: string): Promise<SaveData | undefined> {
  const db = await open();
  if (!db) return memory.get(key);
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? memory.get(key));
      req.onerror = () => resolve(memory.get(key));
    } catch {
      resolve(memory.get(key));
    }
  });
}
