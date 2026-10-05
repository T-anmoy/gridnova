// Pending-photo store. A photo is written here the moment it is added and
// removed only after the server confirms the upload, so a refresh, a lost
// signal or a closed tab never loses it. IndexedDB when available; otherwise a
// per-page in-memory map (the upload still works, it just can't survive a reload).

export interface PendingPhoto {
  id: string
  /** Groups photos that belong together, e.g. one onboarding draft. */
  scope: string
  slot: string
  blob: Blob
  filename: string
  type: string
  captureMethod: 'camera' | 'gallery'
  latitude?: number
  longitude?: number
  capturedAt?: string
  accuracyM?: number
  exifTakenAtClient?: string
  createdAt: number
}

const DB_NAME = 'gna-pending-photos'
const STORE = 'photos'
const memory = new Map<string, PendingPhoto>()

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('scope', 'scope')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = run(t.objectStore(STORE))
    t.oncomplete = () => resolve(req.result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

export async function putPendingPhoto(photo: PendingPhoto): Promise<void> {
  const db = await openDb()
  if (!db) {
    memory.set(photo.id, photo)
    return
  }
  try {
    await tx(db, 'readwrite', (s) => s.put(photo))
  } catch {
    memory.set(photo.id, photo)
  } finally {
    db.close()
  }
}

export async function listPendingPhotos(scope: string): Promise<PendingPhoto[]> {
  const fromMemory = [...memory.values()].filter((p) => p.scope === scope)
  const db = await openDb()
  if (!db) return fromMemory
  try {
    const rows = await tx<PendingPhoto[]>(db, 'readonly', (s) => s.index('scope').getAll(scope))
    return [...rows, ...fromMemory].sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    return fromMemory
  } finally {
    db.close()
  }
}

export async function removePendingPhoto(id: string): Promise<void> {
  memory.delete(id)
  const db = await openDb()
  if (!db) return
  try {
    await tx(db, 'readwrite', (s) => s.delete(id))
  } catch {
    /* nothing more to do */
  } finally {
    db.close()
  }
}

/** Backoff between automatic upload retries: 2s, 5s, 15s, 30s, then every 60s. */
export function photoRetryDelayMs(attempt: number): number {
  return [2000, 5000, 15000, 30000][attempt] ?? 60000
}
