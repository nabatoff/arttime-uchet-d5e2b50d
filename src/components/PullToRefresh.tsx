import { useRef, useState, useCallback, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

const THRESHOLD = 80;

const PullToRefresh = ({ onRefresh, children }: PullToRefreshProps) => {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, THRESHOLD * 1.5));
    }
  }, [pulling, refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (refreshing) return;
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD * 0.6);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
    setPulling(false);
  }, [pullDistance, refreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 flex justify-center transition-opacity duration-200 z-10",
          (pullDistance > 0 || refreshing) ? "opacity-100" : "opacity-0"
        )}
        style={{ top: -8, height: pullDistance > 0 ? pullDistance : refreshing ? THRESHOLD * 0.6 : 0 }}
      >
        <div className="flex items-end pb-2">
          <Loader2
            className={cn(
              "h-5 w-5 text-primary transition-transform",
              refreshing && "animate-spin",
              !refreshing && pullDistance >= THRESHOLD && "text-success"
            )}
            style={{
              transform: refreshing ? undefined : `rotate(${pullDistance * 3}deg)`,
            }}
          />
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: pullDistance > 0 || refreshing
            ? `translateY(${refreshing ? THRESHOLD * 0.6 : pullDistance}px)`
            : undefined,
          transitionDuration: pulling ? "0ms" : "200ms",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
