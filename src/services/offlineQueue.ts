/**
 * Offline queue for expenses and mileage reports.
 * Stores pending items in IndexedDB with photo blobs.
 * Auto-syncs when connection is restored.
 */

import { api } from "@/services/api";
import { uploadToImgBB } from "@/services/imgbb";
import { compressImage } from "@/services/imageCompression";
import type { Currency } from "@/types";

const DB_NAME = "offlineQueue";
const DB_VERSION = 1;
const STORE_NAME = "pending";

export type PendingItemType = "expense" | "mileage";

export interface PendingExpense {
  type: "expense";
  id: string;
  driverId: string;
  amount: number;
  currency: Currency;
  category: string;
  comment: string;
  photoBlob?: Blob;
  photoName?: string;
  date: string;
  truck?: string;
  createdAt: number;
  status: "pending" | "syncing" | "failed";
  error?: string;
}

export interface PendingMileage {
  type: "mileage";
  id: string;
  driverId: string;
  driverName: string;
  driverPhoto?: string;
  km: number;
  photoBlob: Blob;
  photoName: string;
  truck?: string;
  date: string;
  createdAt: number;
  status: "pending" | "syncing" | "failed";
  error?: string;
}

export type PendingItem = PendingExpense | PendingMileage;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addToQueue(item: PendingItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingItems(): Promise<PendingItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const items = await getPendingItems();
  return items.length;
}

async function syncItem(item: PendingItem): Promise<boolean> {
  try {
    // Upload photo if present
    let photoUrl = "";
    if (item.photoBlob) {
      const file = new File([item.photoBlob], item.photoName || "photo.jpg", { type: item.photoBlob.type });
      const compressed = await compressImage(file);
      photoUrl = await uploadToImgBB(compressed);
    }

    if (item.type === "expense") {
      const result = await api.addExpense({
        driverId: item.driverId,
        date: item.date,
        amount: item.amount,
        currency: item.currency,
        category: item.category,
        comment: item.comment,
        receiptUrl: photoUrl,
        truck: item.truck,
      });
      return !!result.success;
    } else {
      const result = await api.addMileage({
        driverId: item.driverId,
        driverName: item.driverName,
        driverPhoto: item.driverPhoto,
        date: item.date,
        km: item.km,
        photoUrl,
        truck: item.truck,
      });
      return !!result.success;
    }
  } catch {
    return false;
  }
}

let syncing = false;
const syncListeners: Set<() => void> = new Set();

export function onQueueChange(cb: () => void): () => void {
  syncListeners.add(cb);
  return () => syncListeners.delete(cb);
}

function notifyListeners() {
  syncListeners.forEach((cb) => cb());
}

export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing || !navigator.onLine) return { synced: 0, failed: 0 };
  syncing = true;

  const items = await getPendingItems();
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (!navigator.onLine) break;

    const success = await syncItem(item);
    if (success) {
      await removeFromQueue(item.id);
      synced++;
    } else {
      failed++;
    }
  }

  syncing = false;
  notifyListeners();
  return { synced, failed };
}

// Auto-sync on online event
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[offline-queue] Online detected, syncing...");
    syncQueue().then(({ synced, failed }) => {
      if (synced > 0) console.log(`[offline-queue] Synced ${synced} items`);
      if (failed > 0) console.log(`[offline-queue] Failed ${failed} items`);
    });
  });

  // Periodic sync every 30s when online
  setInterval(() => {
    if (navigator.onLine) {
      getPendingItems().then((items) => {
        if (items.length > 0) syncQueue();
      });
    }
  }, 30000);
}
