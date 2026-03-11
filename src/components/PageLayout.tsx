import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UserCircle, Sun, Moon, RefreshCw, ArrowLeft } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useQueryClient } from "@tanstack/react-query";
import BottomNav from "./BottomNav";
import PageTransition from "./PageTransition";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  /** Если задано, в шапке показывается кнопка «Назад» с переходом по этому пути */
  backTo?: string;
}

const PageLayout = ({ children, title, backTo }: PageLayoutProps) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef(0);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries();
    await new Promise((r) => setTimeout(r, 400));
  };

  const handleDesktopRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await handleRefresh();
    setRefreshing(false);
  };

  useEffect(() => {
    const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;
    if (!isTouchDevice) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      if (refreshing) return;
      startYRef.current = e.touches[0].clientY;
      setPulling(true);
      setPullDistance(0);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pulling) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      // ограничиваем до 100px, чтобы не тянуть бесконечно
      const dist = Math.min(100, delta);
      setPullDistance(dist);
    };

    const handleTouchEnd = async () => {
      if (!pulling) return;
      const threshold = 60;
      const shouldRefresh = pullDistance >= threshold;
      setPulling(false);
      setPullDistance(0);
      if (shouldRefresh) {
        await handleDesktopRefresh();
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pulling, pullDistance, refreshing]);

  const content = children;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {title && (
        <header className="sticky top-0 z-40 glass-header border-b border-border/60 px-4 pb-3 pt-safe-top">
          {pulling && (
            <div
              className="flex items-center justify-center text-[11px] text-muted-foreground transition-transform duration-100"
              style={{ transform: `translateY(${Math.min(pullDistance, 40)}px)` }}
            >
              {pullDistance < 60 ? "Потяните, чтобы обновить" : "Отпустите для обновления"}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {backTo ? (
                <button
                  type="button"
                  onClick={() => navigate(backTo)}
                  className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  aria-label="Назад"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : null}
              <img src={logo} alt="ArtTime" className="h-7 shrink-0 object-contain" />
              <div className="h-5 w-px bg-border/60" />
              <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                  onClick={handleDesktopRefresh}
                  disabled={refreshing}
                  className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
                  title="Обновить"
                >
                  <RefreshCw className={cn("h-5 w-5", refreshing && "animate-spin")} />
                </button>
              <button
                onClick={toggleTheme}
                className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button
                onClick={() => navigate("/profile")}
                className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
              >
                <UserCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>
      )}
      <main className="flex-1 px-4 pb-20 pt-4 overflow-hidden">
        <PageTransition>{content}</PageTransition>
      </main>
      <BottomNav />
    </div>
  );
};

export default PageLayout;
