import BottomNav from "./BottomNav";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const PageLayout = ({ children, title }: PageLayoutProps) => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {title && (
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
        </header>
      )}
      <main className="flex-1 px-4 pb-20 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
};

export default PageLayout;
