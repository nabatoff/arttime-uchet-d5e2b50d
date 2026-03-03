import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCircle, Sun, Moon, RefreshCw } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useQueryClient } from "@tanstack/react-query";
import BottomNav from "./BottomNav";
import PageTransition from "./PageTransition";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const PageLayout = ({ children, title }: PageLayoutProps) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

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

  const content = children;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {title && (
        <header className="sticky top-0 z-40 glass-header border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="ArtTime" className="h-8 object-contain" />
              <div className="h-5 w-px bg-border/60" />
              <h1 className="text-sm font-semibold text-foreground">{title}</h1>
            </div>
            <div className="flex items-center gap-1">
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
