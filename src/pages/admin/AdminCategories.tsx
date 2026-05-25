import { useMemo, useState } from "react";
import { api } from "@/services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, ImageOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn, sortCategories } from "@/lib/utils";
import type { CategoryInfo, CategoryVisibleTo } from "@/types";

const VISIBLE_TO_LABELS: Record<CategoryVisibleTo, string> = {
  driver: "Водитель",
  balance: "Balance",
  both: "Оба",
};

function parseSortOrderInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed.replace(",", "."));
  if (!Number.isInteger(num) || num < 1) return null;
  return num;
}

function getMaxSortOrder(categories: CategoryInfo[]): number {
  return categories.reduce((max, cat) => {
    if (cat.sortOrder == null) return max;
    return cat.sortOrder > max ? cat.sortOrder : max;
  }, 0);
}

const AdminCategories = ({ backTo }: { backTo?: string } = {}) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryInfo | null>(null);
  const [name, setName] = useState("");
  const [sortOrderInput, setSortOrderInput] = useState("");
  const [noReceipt, setNoReceipt] = useState(false);
  const [visibleTo, setVisibleTo] = useState<CategoryVisibleTo>("both");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["appData"],
    queryFn: async () => {
      const result = await api.getAppData();
      return result.success && result.data ? result.data.categories : [] as CategoryInfo[];
    },
  });

  const sortedCategories = useMemo(() => sortCategories(categories), [categories]);
  const maxSortOrder = useMemo(() => getMaxSortOrder(categories), [categories]);
  const parsedSortOrder = parseSortOrderInput(sortOrderInput);
  const sortOrderInvalid = sortOrderInput.trim() !== "" && parsedSortOrder == null;
  const duplicateCategory = useMemo(() => {
    if (parsedSortOrder == null) return null;
    return categories.find((cat) => cat.sortOrder === parsedSortOrder && cat.name !== editing?.name) ?? null;
  }, [categories, parsedSortOrder, editing?.name]);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setSortOrderInput("");
    setNoReceipt(false);
    setVisibleTo("both");
    setDialogOpen(true);
  };

  const openEdit = (cat: CategoryInfo) => {
    setEditing(cat);
    setName(cat.name);
    setSortOrderInput(cat.sortOrder == null ? "" : String(cat.sortOrder));
    setNoReceipt(cat.noReceipt);
    setVisibleTo(cat.visibleTo === "driver" || cat.visibleTo === "balance" ? cat.visibleTo : "both");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || sortOrderInvalid || duplicateCategory) return;
    setSaving(true);
    const sortOrder = parsedSortOrder;
    const result = editing
      ? await api.updateCategory(editing.name, name.trim(), noReceipt, visibleTo, sortOrder)
      : await api.saveCategory(name.trim(), noReceipt, visibleTo, sortOrder);
    setSaving(false);
    if (result.success) {
      toast({ title: editing ? "Категория обновлена" : "Категория создана" });
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["appData"] });
    } else {
      toast({ title: result.error || "Ошибка", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    await api.deleteCategory(deleteTarget);
    toast({ title: "Категория удалена" });
    setSaving(false);
    setDeleteTarget(null);
    queryClient.invalidateQueries({ queryKey: ["appData"] });
  };

  return (
    <PageLayout title="Категории" backTo={backTo}>
      <div className="mb-4">
        <Button onClick={openAdd} className="w-full gap-2">
          <Plus className="h-4 w-4" /> Добавить категорию
        </Button>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-muted-foreground">Загрузка...</p>
      ) : sortedCategories.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Нет категорий</p>
      ) : (
        <div className="space-y-2">
          {sortedCategories.map((cat) => (
            <div
              key={cat.name}
              className={cn(
                "flex items-center justify-between rounded-2xl border border-border/60 bg-card p-4",
                "shadow-[var(--card-shadow)]"
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-wrap">
                {cat.sortOrder != null && (
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-primary/10 px-2 text-xs font-semibold text-primary shrink-0">
                    {cat.sortOrder}
                  </span>
                )}
                <span className="text-sm font-medium truncate">{cat.name}</span>
                {cat.noReceipt && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground shrink-0">
                    <ImageOff className="h-3 w-3" />
                    Без чека
                  </span>
                )}
                <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground shrink-0">
                  {VISIBLE_TO_LABELS[cat.visibleTo === "driver" || cat.visibleTo === "balance" ? cat.visibleTo : "both"]}
                </span>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  onClick={() => openEdit(cat)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeleteTarget(cat.name)}
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
              {editing ? "Редактировать категорию" : "Новая категория"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Название категории"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 bg-secondary"
            />
            <div className="space-y-1">
              <p className="text-sm font-medium">Порядок отображения</p>
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="Например: 1"
                value={sortOrderInput}
                onChange={(e) => setSortOrderInput(e.target.value)}
                className="h-12 bg-secondary"
              />
              <p className="text-xs text-muted-foreground">
                {maxSortOrder > 0
                  ? `Последняя занятая цифра: ${maxSortOrder}. Можно поставить ${maxSortOrder + 1}.`
                  : "Пока ни одна категория не пронумерована."}
              </p>
              {sortOrderInvalid && (
                <p className="text-xs text-destructive">Введите целое число от 1 и выше или оставьте поле пустым.</p>
              )}
              {duplicateCategory && (
                <p className="text-xs text-destructive">
                  Такая цифра уже есть у категории «{duplicateCategory.name}».
                  {maxSortOrder > 0 ? ` Последняя занятая цифра: ${maxSortOrder}.` : ""}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between rounded-xl bg-secondary p-3">
              <div>
                <p className="text-sm font-medium">Без фото чека</p>
                <p className="text-xs text-muted-foreground">Не запрашивать фото при занесении расхода</p>
              </div>
              <Switch checked={noReceipt} onCheckedChange={setNoReceipt} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Видна для роли</p>
              <Select value={visibleTo} onValueChange={(v) => setVisibleTo(v as CategoryVisibleTo)}>
                <SelectTrigger className="h-10 bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">{VISIBLE_TO_LABELS.both}</SelectItem>
                  <SelectItem value="driver">{VISIBLE_TO_LABELS.driver}</SelectItem>
                  <SelectItem value="balance">{VISIBLE_TO_LABELS.balance}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || saving || sortOrderInvalid || !!duplicateCategory}
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
            <AlertDialogTitle className="text-foreground">Удалить категорию?</AlertDialogTitle>
            <AlertDialogDescription>
              Категория «{deleteTarget}» будет удалена. Существующие расходы с этой категорией сохранятся.
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

export default AdminCategories;
