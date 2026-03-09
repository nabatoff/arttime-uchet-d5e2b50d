import { useState, useEffect, useCallback } from "react";
import { getPendingCount, onQueueChange, syncQueue } from "@/services/offlineQueue";

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    refreshCount();
    const unsub = onQueueChange(refreshCount);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      unsub();
    };
  }, [refreshCount]);

  const trySyncNow = useCallback(async () => {
    const result = await syncQueue();
    await refreshCount();
    return result;
  }, [refreshCount]);

  return { online, pendingCount, refreshCount, trySyncNow };
}
