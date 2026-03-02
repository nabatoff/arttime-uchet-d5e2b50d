import { useNavigate } from "react-router-dom";
import { UserCircle } from "lucide-react";
import BottomNav from "./BottomNav";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const PageLayout = ({ children, title }: PageLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {title && (
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
          <button
            onClick={() => navigate("/profile")}
            className="rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <UserCircle className="h-6 w-6" />
          </button>
        </header>
      )}
      <main className="flex-1 px-4 pb-20 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
};

export default PageLayout;
