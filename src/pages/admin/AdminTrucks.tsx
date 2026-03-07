import { useState } from "react";
import { api } from "@/services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Truck } from "@/types";

const AdminTrucks = ({ backTo }: { backTo?: string } = {}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Truck | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: trucks = [], isLoading } = useQuery({
    queryKey: ["trucks"],
    queryFn: async () => {
      const result = await api.getTrucks();
      return result.success && result.data ? result.data : [] as Truck[];
    },
  });

  const openAdd = () => {
    setEditing(null);
    setName("");
    setDialogOpen(true);
  };

  const openEdit = (truck: Truck) => {
    setEditing(truck);
    setName(truck.name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    if (editing) {
      const res = await api.updateTruck(editing.name, name.trim());
      if (res.success) {
        toast({ title: "Тягач переименован" });
        setDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ["trucks"] });
      } else {
        toast({ title: res.error ?? "Ошибка", variant: "destructive" });
      }
    } else {
      const res = await api.saveTruck(name.trim());
      if (res.success) {
        toast({ title: "Тягач добавлен" });
        setDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ["trucks"] });
      } else {
        toast({ title: res.error ?? "Ошибка", variant: "destructive" });
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    const res = await api.deleteTruck(deleteTarget);
    if (res.success) {
      toast({ title: "Тягач удалён" });
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["trucks"] });
    } else {
      toast({ title: res.error ?? "Ошибка", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <PageLayout title="Тягачи" backTo={backTo}>
      <div className="mb-4">
        <Button onClick={openAdd} className="w-full gap-2">
          <Plus className="h-4 w-4" /> Добавить тягач
        </Button>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-muted-foreground">Загрузка...</p>
      ) : trucks.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Нет тягачей. Добавьте первый.</p>
      ) : (
        <div className="space-y-2">
          {trucks.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4",
                "shadow-[var(--card-shadow)]"
              )}
            >
              <span className="text-sm font-medium truncate">{t.name}</span>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  onClick={() => openEdit(t)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTarget(t.name)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editing ? "Переименовать тягач" : "Новый тягач"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Название тягача"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 bg-secondary"
            />
            <Button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="h-12 w-full text-base font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Удалить тягач?</AlertDialogTitle>
            <AlertDialogDescription>
              Тягач «{deleteTarget}» будет удалён. В записях пробега и расходов название сохранится как есть.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default AdminTrucks;
