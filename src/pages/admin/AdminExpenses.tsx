import { useState } from "react";
import { api } from "@/services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageLayout from "@/components/PageLayout";
import PhotoUpload from "@/components/PhotoUpload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Filter, X, Plus, CalendarIcon, Pencil, Trash2, Download } from "lucide-react";
import { ALL_CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_FLAGS, type Currency, type Expense, type User } from "@/types";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const AdminExpenses = () => {
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"expense" | "topup">("expense");
  const [addDriver, setAddDriver] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addCurrency, setAddCurrency] = useState<Currency>("KZT");
  const [addComment, setAddComment] = useState("");
  const [addReceiptUrl, setAddReceiptUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editCategory, setEditCategory] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState<Currency>("KZT");
  const [editComment, setEditComment] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const { toast } = useToast();

  // Filters
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const { data: allExpenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["adminExpenses"],
    queryFn: async () => {
      const result = await api.getExpenses("", "Admin");
      return result.success && result.data ? result.data : [] as Expense[];
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const result = await api.getDrivers();
      return result.success && result.data ? result.data.filter((d) => d.role.toLowerCase() !== "admin") : [] as User[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["appData"],
    queryFn: async () => {
      const result = await api.getAppData();
      return result.success && result.data ? result.data.categories : [] as string[];
    },
  });

  const loading = loadingExpenses;

  const getDriverName = (driverId: string) => {
    const driver = drivers.find((d) => String(d.id) === String(driverId));
    return driver?.name || "Неизвестный";
  };

  // Apply filters
  const filtered = allExpenses.filter((e) => {
    if (filterDriver !== "all" && String(e.driverId) !== filterDriver) return false;
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    if (dateFrom || dateTo) {
      const expDate = new Date(e.date);
      if (dateFrom && dateTo) {
        if (!isWithinInterval(expDate, { start: startOfDay(dateFrom), end: endOfDay(dateTo) })) return false;
      } else if (dateFrom) {
        if (expDate < startOfDay(dateFrom)) return false;
      } else if (dateTo) {
        if (expDate > endOfDay(dateTo)) return false;
      }
    }
    return true;
  });

  const clearFilters = () => {
    setFilterDriver("all");
    setFilterCategory("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = filterDriver !== "all" || filterCategory !== "all" || dateFrom || dateTo;

  const reloadData = () => {
    queryClient.invalidateQueries({ queryKey: ["adminExpenses"] });
    queryClient.invalidateQueries({ queryKey: ["drivers"] });
  };

  const openEditExpense = (expense: Expense) => {
    setEditExpense(expense);
    setEditCategory(expense.category);
    setEditAmount(String(expense.amount));
    setEditCurrency(expense.currency);
    setEditComment(expense.comment);
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editExpense) return;
    setSaving(true);
    await api.updateExpense({
      ...editExpense,
      category: editCategory,
      amount: Number(editAmount),
      currency: editCurrency,
      comment: editComment,
    });
    toast({ title: "Запись обновлена" });
    setSaving(false);
    setEditOpen(false);
    await reloadData();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    await api.deleteExpense(deleteTarget.id);
    toast({ title: "Запись удалена" });
    setSaving(false);
    setDeleteTarget(null);
    await reloadData();
  };

  const handleAddExpense = async () => {
    if (!addDriver || !addAmount) {
      toast({ title: "Выберите водителя и сумму", variant: "destructive" });
      return;
    }
    setSaving(true);

    if (addType === "topup") {
      // Top-up balance
      const driver = drivers.find((d) => String(d.id) === addDriver);
      const currentBalance = driver?.balances?.[addCurrency] ?? 0;
      await api.updateBalance(addDriver, addCurrency, currentBalance + Number(addAmount));
      // Save topup as expense record for history
      await api.addExpense({
        driverId: addDriver,
        date: new Date().toISOString(),
        category: "Пополнение",
        amount: Number(addAmount),
        currency: addCurrency,
        comment: addComment || "Пополнение баланса",
        receiptUrl: "",
      });
      toast({ title: "Баланс пополнен" });
    } else {
      // Add expense
      await api.addExpense({
        driverId: addDriver,
        date: new Date().toISOString(),
        category: addCategory || "Другое",
        amount: Number(addAmount),
        currency: addCurrency,
        comment: addComment,
        receiptUrl: addReceiptUrl,
      });
      toast({ title: "Расход добавлен" });
    }

    setAddOpen(false);
    setAddAmount("");
    setAddComment("");
    setAddCategory("");
    setAddReceiptUrl("");
    setSaving(false);
    await reloadData();
  };

  const exportToExcel = () => {
    import("xlsx").then((XLSX) => {
      const rows = filtered.map((e) => ({
        "Дата": format(new Date(e.date), "dd.MM.yyyy HH:mm", { locale: ru }),
        "Водитель": getDriverName(e.driverId),
        "Категория": e.category,
        "Сумма": e.amount,
        "Валюта": e.currency,
        "Комментарий": e.comment,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Расходы");
      XLSX.writeFile(wb, `Расходы_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
    });
  };

  return (
    <PageLayout title="Расходы">
      {/* Top actions */}
      <div className="mb-4 flex items-center gap-1.5">
        <Button
          variant={showFilters ? "default" : "secondary"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={hasActiveFilters ? "gap-0 px-2 shrink-0" : "gap-1.5 shrink-0"}
        >
          <Filter className="h-4 w-4" />
          {!hasActiveFilters && " Фильтры"}
          {hasActiveFilters && (
            <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground text-[10px] font-bold text-primary">
              !
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters} className="h-8 w-8 shrink-0 text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0" />
        <Button variant="secondary" size="sm" onClick={exportToExcel} className={hasActiveFilters ? "px-2 shrink-0" : "gap-1.5 shrink-0"} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" />
          {!hasActiveFilters && " Excel"}
        </Button>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size={hasActiveFilters ? "icon" : "sm"} className={hasActiveFilters ? "h-8 w-8 shrink-0" : "gap-1.5 shrink-0"}>
              <Plus className="h-4 w-4" />
              {!hasActiveFilters && " Добавить"}
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {addType === "topup" ? "Пополнение баланса" : "Новый расход"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {/* Type toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAddType("expense")}
                  className={cn(
                    "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
                    addType === "expense" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  )}
                >
                  Расход
                </button>
                <button
                  onClick={() => setAddType("topup")}
                  className={cn(
                    "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
                    addType === "topup" ? "bg-green-600 text-white" : "bg-secondary text-muted-foreground"
                  )}
                >
                  Пополнение
                </button>
              </div>

              {/* Driver */}
              <Select value={addDriver} onValueChange={setAddDriver}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Выберите водителя" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Category (only for expense) */}
              {addType === "expense" && (
                <Select value={addCategory} onValueChange={setAddCategory}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Категория" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Amount */}
              <Input
                placeholder="Сумма"
                type="number"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                className="bg-secondary border-border"
              />

              {/* Currency */}
              <div className="flex flex-wrap gap-2">
                {ALL_CURRENCIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAddCurrency(c)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      addCurrency === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {CURRENCY_FLAGS[c]} {c}
                  </button>
                ))}
              </div>

              {/* Comment */}
              <Input
                placeholder="Комментарий"
                value={addComment}
                onChange={(e) => setAddComment(e.target.value)}
                className="bg-secondary border-border"
              />

              {/* Receipt photo (only for expense) */}
              {addType === "expense" && (
                <PhotoUpload label="Фото чека" onUpload={setAddReceiptUrl} />
              )}

              <Button className="w-full" onClick={handleAddExpense} disabled={saving || (addType === "expense" && !addReceiptUrl)}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {addType === "topup" ? "Пополнить" : "Сохранить расход"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-4 space-y-3 rounded-xl border border-border bg-card p-4 animate-fade-in">
          {/* Driver filter */}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Водитель</p>
            <Select value={filterDriver} onValueChange={setFilterDriver}>
              <SelectTrigger className="h-10 bg-secondary">
                <SelectValue placeholder="Все водители" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все водители</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category filter */}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Категория</p>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-10 bg-secondary">
                <SelectValue placeholder="Все категории" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Дата от</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("h-10 w-full justify-start text-left text-sm", !dateFrom && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd.MM.yy") : "Выбрать"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Дата до</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("h-10 w-full justify-start text-left text-sm", !dateTo && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd.MM.yy") : "Выбрать"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          {hasActiveFilters ? "Нет расходов по выбранным фильтрам" : "Нет расходов"}
        </p>
      ) : (
        <div className="space-y-2 animate-fade-in">
          <p className="mb-2 text-xs text-muted-foreground">
            Найдено: {filtered.length}
          </p>
          {filtered.map((expense) => {
            const expDate = new Date(expense.date);
            const isTopup = expense.category === "Пополнение";
            return (
              <Card key={expense.id} className={cn("card-elevated", isTopup ? "border-l-4 border-l-green-500" : "border-l-4 border-l-destructive")}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-semibold", isTopup ? "text-green-500" : "text-destructive")}>
                          {isTopup ? "+" : "−"}{Number(expense.amount).toLocaleString("ru-RU")} {CURRENCY_SYMBOLS[expense.currency as Currency] || expense.currency}
                        </span>
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {expense.category}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-primary">
                        {getDriverName(String(expense.driverId))}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {expense.comment}
                      </p>
                      {expense.receiptUrl && (
                        <img
                          src={expense.receiptUrl}
                          alt="Чек"
                          onClick={() => setZoomImage(expense.receiptUrl)}
                          className="mt-1 h-10 w-10 cursor-pointer rounded border border-border object-cover transition-opacity hover:opacity-80"
                        />
                      )}
                    </div>
                    <div className="ml-2 flex flex-col items-end gap-1">
                      <p className="text-[10px] text-muted-foreground">
                        {format(expDate, "dd MMM", { locale: ru })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(expDate, "HH:mm")}
                      </p>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => openEditExpense(expense)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(expense)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Редактировать запись</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={editCategory} onValueChange={setEditCategory}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Категория" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Пополнение">Пополнение</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Сумма" type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="bg-secondary border-border" />
            <div className="flex flex-wrap gap-2">
              {ALL_CURRENCIES.map((c) => (
                <button key={c} onClick={() => setEditCurrency(c)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", editCurrency === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                  {CURRENCY_FLAGS[c]} {c}
                </button>
              ))}
            </div>
            <Input placeholder="Комментарий" value={editComment} onChange={(e) => setEditComment(e.target.value)} className="bg-secondary border-border" />
            <Button className="w-full" onClick={handleEditSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `${deleteTarget.category} — ${Number(deleteTarget.amount).toLocaleString("ru-RU")} ${CURRENCY_SYMBOLS[deleteTarget.currency as Currency] || deleteTarget.currency}`}
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

      {/* Image zoom overlay */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage}
            alt="Чек"
            className="max-h-[85vh] max-w-[90vw] rounded-lg border border-border object-contain shadow-lg"
          />
          <button
            onClick={() => setZoomImage(null)}
            className="absolute right-4 top-4 rounded-full bg-background/80 p-2 text-foreground hover:bg-background"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </PageLayout>
  );
};

export default AdminExpenses;
