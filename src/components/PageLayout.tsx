import { useNavigate } from "react-router-dom";
import { UserCircle } from "lucide-react";
import BottomNav from "./BottomNav";
import logo from "@/assets/logo.png";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const PageLayout = ({ children, title }: PageLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {title && (
        <header className="sticky top-0 z-40 glass-header border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="ArtTime" className="h-7 object-contain" />
              <div className="h-5 w-px bg-border/60" />
              <h1 className="text-sm font-semibold text-foreground">{title}</h1>
            </div>
            <button
              onClick={() => navigate("/profile")}
              className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
            >
              <UserCircle className="h-5 w-5" />
            </button>
          </div>
        </header>
      )}
      <main className="flex-1 px-4 pb-20 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
};

export default PageLayout;
