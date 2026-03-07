import { useNavigate } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Users, Tags } from "lucide-react";
import { cn } from "@/lib/utils";

const AdminSettings = () => {
  const navigate = useNavigate();

  return (
    <PageLayout title="Настройки">
      <div className="space-y-3 animate-fade-in">
        <Button
          variant="outline"
          className={cn(
            "h-14 w-full justify-start gap-4 rounded-2xl border border-border/60 bg-card px-4",
            "shadow-[var(--card-shadow)] transition-colors hover:bg-secondary/50"
          )}
          onClick={() => navigate("/admin/drivers")}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <span className="font-medium text-foreground">Водители</span>
        </Button>
        <Button
          variant="outline"
          className={cn(
            "h-14 w-full justify-start gap-4 rounded-2xl border border-border/60 bg-card px-4",
            "shadow-[var(--card-shadow)] transition-colors hover:bg-secondary/50"
          )}
          onClick={() => navigate("/admin/categories")}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Tags className="h-5 w-5 text-primary" />
          </div>
          <span className="font-medium text-foreground">Категории</span>
        </Button>
      </div>
    </PageLayout>
  );
};

export default AdminSettings;
