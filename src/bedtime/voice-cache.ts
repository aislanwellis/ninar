import { speakStory } from "./speak";

const DB = "ninar-voz";
const STORE = "clipes";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function cacheKey(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readClip(key: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => {
      const value = request.result;
      resolve(value instanceof Blob ? value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

async function writeClip(key: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(blob, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function blobFromBase64(audio: string): Blob {
  const binary = atob(audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "audio/mpeg" });
}

export async function loadNarration(spoken: string): Promise<Blob> {
  const key = await cacheKey(`eve-contar-v1\n${spoken}`);
  try {
    const cached = await readClip(key);
    if (cached && cached.size > 1000) return cached;
  } catch {
    // segue sem cache
  }

  const result = await speakStory({ data: { text: spoken } });
  if (!result.ok) throw new Error(result.error);
  const blob = blobFromBase64(result.audio);
  try {
    await writeClip(key, blob);
  } catch {
    // o áudio ainda toca nesta vez
  }
  return blob;
}
