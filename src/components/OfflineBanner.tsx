import { WifiOff, CloudUpload, Loader2 } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

const OfflineBanner = () => {
  const { online, pendingCount, trySyncNow } = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await trySyncNow();
    setSyncing(false);
  };

  if (online && pendingCount === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
        !online
          ? "bg-warning/15 text-warning border border-warning/30"
          : "bg-primary/10 text-primary border border-primary/30"
      )}
    >
      {!online ? (
        <>
          <WifiOff className="h-4 w-4 shrink-0" />
          <span className="flex-1">Нет сети — данные сохраняются локально</span>
          {pendingCount > 0 && (
            <span className="shrink-0 rounded-full bg-warning/20 px-2 py-0.5 text-xs">{pendingCount}</span>
          )}
        </>
      ) : (
        <>
          <CloudUpload className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            {pendingCount} {pendingCount === 1 ? "запись ожидает" : "записей ожидают"} отправки
          </span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="shrink-0 rounded-md bg-primary/20 px-2 py-0.5 text-xs hover:bg-primary/30 transition-colors"
          >
            {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Отправить"}
          </button>
        </>
      )}
    </div>
  );
};

import { useState } from "react";

export default OfflineBanner;
