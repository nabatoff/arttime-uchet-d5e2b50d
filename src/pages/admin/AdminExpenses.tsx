import { useState, useRef, useMemo, useEffect } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import PageLayout from "@/components/PageLayout";
import { FullScreenImageOverlay } from "@/components/FullScreenImageOverlay";
import PhotoUpload from "@/components/PhotoUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Filter, X, Plus, CalendarIcon, Pencil, Trash2, Download, ArrowRight, ChevronDown } from "lucide-react";
import { ALL_CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_FLAGS, type Currency, type Expense, type User, type TransferRecord } from "@/types";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { buildAdminExpenseListFilters, type FilterExpenseKind } from "@/lib/expenseQueryFilters";
import { cn, vibrateSuccess } from "@/lib/utils";
import { ExpenseListSkeleton } from "@/components/ExpenseCardSkeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CategoryPicker from "@/components/CategoryPicker";
import TruckPicker from "@/components/TruckPicker";
import ExpenseFormShell from "@/components/ExpenseFormShell";
import { getExpenseFormErrors, shouldConfirmLargeExpense } from "@/lib/expenseFormValidation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useScrollReveal } from "@/hooks/useGsap";

const AdminExpenses = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);
  useScrollReveal(listRef);
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
  const [editTruck, setEditTruck] = useState("");
  const [addTruck, setAddTruck] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Transfer edit/delete
  const [editTransfer, setEditTransfer] = useState<TransferRecord | null>(null);
  const [editTransferOpen, setEditTransferOpen] = useState(false);
  const [editTransferAmount, setEditTransferAmount] = useState("");
  const [editTransferComment, setEditTransferComment] = useState("");
  const [deleteTransferTarget, setDeleteTransferTarget] = useState<TransferRecord | null>(null);
  const [addCategoryPickerOpen, setAddCategoryPickerOpen] = useState(false);
  const [editCategoryPickerOpen, setEditCategoryPickerOpen] = useState(false);
  const [addTruckPickerOpen, setAddTruckPickerOpen] = useState(false);
  const [editTruckPickerOpen, setEditTruckPickerOpen] = useState(false);
  const [showAddValidation, setShowAddValidation] = useState(false);
  const [showEditValidation, setShowEditValidation] = useState(false);
  const [confirmLargeOpen, setConfirmLargeOpen] = useState(false);
  const [confirmLargeAction, setConfirmLargeAction] = useState<"add" | "edit">("add");
  const { toast } = useToast();

  const defaultDateTo = endOfDay(new Date());
  const defaultDateFrom = startOfDay(new Date());

  const ADMIN_EXPENSES_FILTERS_KEY = "admin-expenses-filters";

  const loadSavedFilters = (): {
    filterDriver: string;
    filterCategory: string;
    filterExpenseKind: FilterExpenseKind;
    dateFrom: Date | undefined;
    dateTo: Date | undefined;
  } => {
    try {
      const raw = localStorage.getItem(ADMIN_EXPENSES_FILTERS_KEY);
      if (!raw) {
        return {
          filterDriver: "all",
          filterCategory: "all",
          filterExpenseKind: "all",
          dateFrom: defaultDateFrom,
          dateTo: defaultDateTo,
        };
      }
      const parsed = JSON.parse(raw) as {
        filterDriver?: string;
        filterCategory?: string;
        filterExpenseKind?: string;
        dateFrom?: string;
        dateTo?: string;
      };
      const kind = parsed.filterExpenseKind;
      const filterExpenseKind: FilterExpenseKind =
        kind === "expenses" || kind === "topups" || kind === "all" ? kind : "all";
      return {
        filterDriver: parsed.filterDriver ?? "all",
        filterCategory: parsed.filterCategory ?? "all",
        filterExpenseKind,
        dateFrom: parsed.dateFrom ? new Date(parsed.dateFrom) : defaultDateFrom,
        dateTo: parsed.dateTo ? new Date(parsed.dateTo) : defaultDateTo,
      };
    } catch {
      return {
        filterDriver: "all",
        filterCategory: "all",
        filterExpenseKind: "all",
        dateFrom: defaultDateFrom,
        dateTo: defaultDateTo,
      };
    }
  };

  const [filterDriver, setFilterDriver] = useState<string>(() => loadSavedFilters().filterDriver);
  const [filterCategory, setFilterCategory] = useState<string>(() => loadSavedFilters().filterCategory);
  const [filterExpenseKind, setFilterExpenseKind] = useState<FilterExpenseKind>(() => loadSavedFilters().filterExpenseKind);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => loadSavedFilters().dateFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(() => loadSavedFilters().dateTo);

  useEffect(() => {
    localStorage.setItem(
      ADMIN_EXPENSES_FILTERS_KEY,
      JSON.stringify({
        filterDriver,
        filterCategory,
        filterExpenseKind,
        dateFrom: dateFrom?.toISOString(),
        dateTo: dateTo?.toISOString(),
      })
    );
  }, [filterDriver, filterCategory, filterExpenseKind, dateFrom, dateTo]);

  const since = dateFrom ? startOfDay(dateFrom).toISOString() : undefined;
  const until = dateTo ? endOfDay(dateTo).toISOString() : undefined;

  const {
    data,
    isLoading: loadingExpenses,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["adminExpenses", since ?? "", until ?? "", filterDriver, filterCategory, filterExpenseKind],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await api.getExpenses("", "Admin", {
        since,
        until,
        limit: 50,
        offset: pageParam as number,
        ...buildAdminExpenseListFilters(filterDriver, filterCategory, filterExpenseKind),
      });
      return result.success && result.data ? result.data : ([] as Expense[]);
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= 50 ? allPages.length * 50 : undefined,
    initialPageParam: 0,
  });

  const allExpenses = useMemo(() => data?.pages.flat() ?? [], [data]);

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: async () => {
      const result = await api.getDrivers();
      return result.success && result.data ? result.data : [] as User[];
    },
  });

  const drivers = useMemo(() => allUsers.filter((d) => (d.role ?? "").toString().toLowerCase() !== "admin"), [allUsers]);

  const { data: categories = [] } = useQuery({
    queryKey: ["appData"],
    queryFn: async () => {
      const result = await api.getAppData();
      const cats = result.success && result.data && Array.isArray(result.data.categories) ? result.data.categories : [];
      return cats as import("@/types").CategoryInfo[];
    },
  });

  const { data: trucks = [] } = useQuery({
    queryKey: ["trucks"],
    queryFn: async () => {
      const result = await api.getTrucks();
      return result.success && result.data ? result.data : [];
    },
  });

  const addCategoryNoReceipt = categories.find((c) => c.name === addCategory)?.noReceipt ?? false;

  const addFormErrors = useMemo(() => {
    if (addType === "topup") {
      const errors = getExpenseFormErrors({
        amount: addAmount,
        category: "x",
        receiptUrl: "",
        noReceipt: true,
      });
      return errors;
    }
    return getExpenseFormErrors({
      amount: addAmount,
      category: addCategory,
      receiptUrl: addReceiptUrl,
      noReceipt: addCategoryNoReceipt,
    });
  }, [addType, addAmount, addCategory, addReceiptUrl, addCategoryNoReceipt]);

  const editFormErrors = useMemo(() => {
    const errors = getExpenseFormErrors({
      amount: editAmount,
      category: editCategory,
      receiptUrl: "x",
      noReceipt: true,
    });
    return errors;
  }, [editAmount, editCategory]);

  const editCategories = useMemo(() => {
    if (categories.some((c) => c.name === "Пополнение")) return categories;
    return [{ name: "Пополнение", noReceipt: true }, ...categories];
  }, [categories]);

  const loading = loadingExpenses;

  const getDriverName = (driverId: string) => {
    const driver = drivers.find((d) => String(d.id) === String(driverId));
    return driver?.name || "Неизвестный";
  };

  const getDriverLogin = (driverId: string) => {
    const driver = drivers.find((d) => String(d.id) === String(driverId));
    return driver?.login || "";
  };

  // Водитель и категория уже отфильтрованы на сервере (см. queryKey + getExpenses)
  const filtered = allExpenses;

  const sortedExpenses = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [filtered],
  );

  const { data: transfers = [], isLoading: loadingTransfers } = useQuery({
    queryKey: ["transfers-admin"],
    queryFn: async () => {
      const result = await api.getTransfers();
      if (result.success && result.data) {
        return [...result.data].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ) as TransferRecord[];
      }
      return [] as TransferRecord[];
    },
  });

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const d = new Date(t.date);
      if (dateFrom && d < startOfDay(dateFrom)) return false;
      if (dateTo && d > endOfDay(dateTo)) return false;
      if (filterDriver !== "all") {
        if (String(t.fromDriverId) !== filterDriver && String(t.toDriverId) !== filterDriver) return false;
      }
      return true;
    });
  }, [transfers, dateFrom, dateTo, filterDriver]);

  const summaryByCurrency = useMemo(() => {
    const expenses: Record<string, number> = {};
    const topups: Record<string, number> = {};
    for (const e of filtered) {
      const c = e.currency;
      if (e.category === "Пополнение") {
        topups[c] = (topups[c] ?? 0) + e.amount;
      } else {
        expenses[c] = (expenses[c] ?? 0) + e.amount;
      }
    }
    return { expenses, topups };
  }, [filtered]);

  const clearFilters = () => {
    setFilterDriver("all");
    setFilterCategory("all");
    setFilterExpenseKind("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters =
    filterDriver !== "all" ||
    filterCategory !== "all" ||
    filterExpenseKind !== "all" ||
    dateFrom ||
    dateTo;

  const reloadData = () => {
    queryClient.invalidateQueries({ queryKey: ["adminExpenses"] });
    queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    queryClient.invalidateQueries({ queryKey: ["transfers-admin"] });
  };

  const openEditExpense = (expense: Expense) => {
    setEditExpense(expense);
    setEditCategory(expense.category);
    setEditAmount(String(expense.amount));
    setEditCurrency(expense.currency);
    setEditComment(expense.comment);
    setEditTruck(expense.truck ?? "");
    setShowEditValidation(false);
    setEditOpen(true);
  };

  const performEditSave = async () => {
    if (!editExpense) return;
    setSaving(true);
    const result = await api.updateExpense({
      ...editExpense,
      category: editCategory,
      amount: Number(editAmount.replace(",", ".")),
      currency: editCurrency,
      comment: editComment,
      truck: editTruck || undefined,
    });
    if (result.success) {
      toast({ title: "Запись обновлена" });
      vibrateSuccess();
      setEditOpen(false);
      setConfirmLargeOpen(false);
      await reloadData();
    } else {
      toast({ title: result.error || "Ошибка обновления", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleEditSave = () => {
    if (!editExpense) return;
    setShowEditValidation(true);
    if (Object.keys(editFormErrors).length > 0) return;

    const driverBalance = drivers.find((d) => String(d.id) === String(editExpense.driverId))?.balances?.[editCurrency];
    const balanceForConfirm = editCategory === "Пополнение" ? undefined : driverBalance;
    if (shouldConfirmLargeExpense(editAmount, editCurrency, balanceForConfirm)) {
      setConfirmLargeAction("edit");
      setConfirmLargeOpen(true);
      return;
    }
    void performEditSave();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    const result = await api.deleteExpense(deleteTarget.id);
    if (result.success) {
      toast({ title: "Запись удалена" });
      vibrateSuccess();
      setDeleteTarget(null);
      await reloadData();
    } else {
      toast({ title: result.error || "Ошибка удаления", variant: "destructive" });
    }
    setSaving(false);
  };

  const openEditTransfer = (t: TransferRecord) => {
    setEditTransfer(t);
    setEditTransferAmount(String(t.amount));
    setEditTransferComment(t.comment || "");
    setEditTransferOpen(true);
  };

  const handleEditTransferSave = async () => {
    if (!editTransfer) return;
    setSaving(true);
    const result = await api.updateTransfer({
      id: editTransfer.id,
      fromDriverId: editTransfer.fromDriverId,
      toDriverId: editTransfer.toDriverId,
      currency: editTransfer.currency,
      amount: Number(editTransferAmount),
      comment: editTransferComment,
    });
    if (result.success) {
      toast({ title: "Перевод обновлён" });
      vibrateSuccess();
    } else {
      toast({ title: result.error || "Ошибка", variant: "destructive" });
    }
    setSaving(false);
    setEditTransferOpen(false);
    await reloadData();
  };

  const handleDeleteTransfer = async () => {
    if (!deleteTransferTarget) return;
    setSaving(true);
    const result = await api.deleteTransfer(deleteTransferTarget.id);
    if (result.success) {
      toast({ title: "Перевод удалён, балансы пересчитаны" });
      vibrateSuccess();
    } else {
      toast({ title: result.error || "Ошибка", variant: "destructive" });
    }
    setSaving(false);
    setDeleteTransferTarget(null);
    await reloadData();
  };

  const resetAddForm = () => {
    setAddAmount("");
    setAddComment("");
    setAddCategory("");
    setAddReceiptUrl("");
    setAddTruck("");
    setShowAddValidation(false);
  };

  const performAddExpense = async () => {
    if (!addDriver || !addAmount) return;
    setSaving(true);

    const operatorName = currentUser?.name ?? "";
    let success = false;

    if (addType === "topup") {
      const result = await api.addExpense(
        {
          driverId: addDriver,
          date: new Date().toISOString(),
          category: "Пополнение",
          amount: Number(addAmount.replace(",", ".")),
          currency: addCurrency,
          comment: addComment || "Пополнение предварительного баланса",
          receiptUrl: "",
        },
        operatorName
      );
      if (result.success) {
        toast({ title: "Баланс пополнен" });
        vibrateSuccess();
        success = true;
      } else {
        toast({ title: result.error || "Ошибка пополнения", variant: "destructive" });
      }
    } else {
      const result = await api.addExpense(
        {
          driverId: addDriver,
          date: new Date().toISOString(),
          category: addCategory || "Другое",
          amount: Number(addAmount.replace(",", ".")),
          currency: addCurrency,
          comment: addComment,
          receiptUrl: addReceiptUrl,
          truck: addTruck || undefined,
        },
        operatorName
      );
      if (result.success) {
        toast({ title: "Расход добавлен" });
        vibrateSuccess();
        success = true;
      } else {
        toast({ title: result.error || "Ошибка добавления расхода", variant: "destructive" });
      }
    }

    setSaving(false);
    if (!success) return;

    setAddOpen(false);
    setConfirmLargeOpen(false);
    resetAddForm();
    await reloadData();
  };

  const handleAddExpense = () => {
    setShowAddValidation(true);
    if (!addDriver) {
      toast({ title: "Выберите водителя", variant: "destructive" });
      return;
    }
    if (Object.keys(addFormErrors).length > 0) return;

    const driverBalance = drivers.find((d) => String(d.id) === addDriver)?.balances?.[addCurrency];
    const balanceForConfirm = addType === "expense" ? driverBalance : undefined;
    if (shouldConfirmLargeExpense(addAmount, addCurrency, balanceForConfirm)) {
      setConfirmLargeAction("add");
      setConfirmLargeOpen(true);
      return;
    }
    void performAddExpense();
  };

  const exportToExcel = () => {
    import("xlsx").then((XLSX) => {
      const wb = XLSX.utils.book_new();
      const expenseRows = filtered.map((e) => ({
        "Дата": format(new Date(e.date), "dd.MM.yyyy HH:mm", { locale: ru }),
        "Водитель": getDriverName(e.driverId),
        "Логин": getDriverLogin(e.driverId),
        "Категория": e.category,
        "Тягач": e.truck ?? "",
        "Сумма": e.amount,
        "Валюта": e.currency,
        "Комментарий": e.comment,
        "Оператор": e.performedBy ?? "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), "Расходы");
      const transferRows = filteredTransfers.map((t) => ({
        "Дата": format(new Date(t.date), "dd.MM.yyyy HH:mm", { locale: ru }),
        "От кого": getDriverName(t.fromDriverId),
        "Кому": getDriverName(t.toDriverId),
        "Валюта": t.currency,
        "Сумма": t.amount,
        "Кто выполнил": t.performedBy ?? "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transferRows), "Переводы");
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
          className="gap-1.5 shrink-0"
        >
          <Filter className="h-4 w-4" />
          Фильтры
          {hasActiveFilters && (
            <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground text-[10px] font-bold text-primary">
              !
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs text-muted-foreground shrink-0">
            <X className="h-3 w-3" /> Сбросить
          </Button>
        )}
        <div className="flex-1 min-w-0" />
        <Button variant="secondary" size="sm" onClick={exportToExcel} className={hasActiveFilters ? "px-2 shrink-0" : "gap-1.5 shrink-0"} disabled={filtered.length === 0 && filteredTransfers.length === 0}>
          <Download className="h-4 w-4" />
          {!hasActiveFilters && " Excel"}
        </Button>
        <ExpenseFormShell
          open={addOpen}
          onOpenChange={setAddOpen}
          title={addType === "topup" ? "Пополнение баланса" : "Новый расход"}
          trigger={
            <Button
              size={hasActiveFilters ? "icon" : "sm"}
              className={hasActiveFilters ? "h-8 w-8 shrink-0" : "gap-1.5 shrink-0"}
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {!hasActiveFilters && " Добавить"}
            </Button>
          }
          footer={
            <Button
              onClick={handleAddExpense}
              disabled={saving}
              className="h-12 w-full text-base font-semibold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : addType === "topup" ? "Пополнить" : "Сохранить расход"}
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAddType("expense")}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
                  addType === "expense" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}
              >
                Расход
              </button>
              <button
                type="button"
                onClick={() => setAddType("topup")}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
                  addType === "topup" ? "bg-green-600 text-white" : "bg-secondary text-muted-foreground"
                )}
              >
                Пополнение
              </button>
            </div>

            <div className="space-y-1">
              <Select value={addDriver} onValueChange={setAddDriver}>
                <SelectTrigger className={cn("h-12 bg-secondary border-border", showAddValidation && !addDriver && "border-destructive")}>
                  <SelectValue placeholder="Выберите водителя" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showAddValidation && !addDriver && (
                <p className="text-xs text-destructive">Выберите водителя</p>
              )}
            </div>

            {addType === "expense" && (
              <CategoryPicker
                value={addCategory}
                onChange={setAddCategory}
                categories={categories}
                open={addCategoryPickerOpen}
                onOpenChange={setAddCategoryPickerOpen}
                error={showAddValidation ? addFormErrors.category : undefined}
              />
            )}

            {addType === "expense" && (
              <TruckPicker
                value={addTruck}
                onChange={setAddTruck}
                trucks={trucks}
                open={addTruckPickerOpen}
                onOpenChange={setAddTruckPickerOpen}
                placeholder="Тягач (необязательно)"
                allowEmpty
                emptyLabel="—"
              />
            )}

            <div className="space-y-1">
              <Input
                placeholder="Сумма"
                type="text"
                inputMode="decimal"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                className={cn("h-12 bg-secondary border-border", showAddValidation && addFormErrors.amount && "border-destructive")}
              />
              {showAddValidation && addFormErrors.amount && (
                <p className="text-xs text-destructive">{addFormErrors.amount}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {ALL_CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
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

            {addDriver && (
              <p className="text-xs text-muted-foreground">
                Текущий баланс:{" "}
                {(() => {
                  const driver = drivers.find((d) => String(d.id) === addDriver);
                  const value = driver?.balances?.[addCurrency] ?? 0;
                  return value.toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });
                })()}{" "}
                {CURRENCY_SYMBOLS[addCurrency]}
              </p>
            )}

            <Input
              placeholder="Комментарий"
              value={addComment}
              onChange={(e) => setAddComment(e.target.value)}
              className="h-12 bg-secondary border-border"
            />

            {addType === "expense" && !addCategoryNoReceipt && (
              <div className="space-y-1">
                <PhotoUpload label="Фото чека" onUpload={setAddReceiptUrl} />
                {showAddValidation && addFormErrors.receipt && (
                  <p className="text-xs text-destructive">{addFormErrors.receipt}</p>
                )}
              </div>
            )}
          </div>
        </ExpenseFormShell>
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
              <SelectContent position="popper" sideOffset={4}>
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
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">Все категории</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Тип операций</p>
            <Select
              value={filterExpenseKind}
              onValueChange={(v) => setFilterExpenseKind(v as FilterExpenseKind)}
              disabled={filterCategory !== "all"}
            >
              <SelectTrigger className="h-10 bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="expenses">Только расходы</SelectItem>
                <SelectItem value="topups">Только пополнения</SelectItem>
              </SelectContent>
            </Select>
            {filterCategory !== "all" && (
              <p className="mt-1 text-[10px] text-muted-foreground leading-snug">
                Выбрана категория — тип учитывается только при «Все категории»
              </p>
            )}
          </div>

          {/* Quick period */}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Период</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Сегодня", from: startOfDay(new Date()), to: endOfDay(new Date()) },
                { label: "7 дней", from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) },
                { label: "30 дней", from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) },
                { label: "Месяц", from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
              ].map(({ label, from, to }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setDateFrom(from);
                    setDateTo(to);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
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

      {/* Summary — сворачиваемый, по умолчанию свернут */}
      {!loading && filtered.length > 0 && (
        <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen} className="mb-4">
          <div className="rounded-2xl border border-border/60 bg-card shadow-[var(--card-shadow)]">
            <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors rounded-2xl">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                За выбранный период
              </p>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", summaryOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-wrap gap-3 text-sm px-4 pb-4 pt-0">
                {ALL_CURRENCIES.map((c) => {
                  const exp = summaryByCurrency.expenses[c] ?? 0;
                  const top = summaryByCurrency.topups[c] ?? 0;
                  if (exp === 0 && top === 0) return null;
                  return (
                    <span key={c} className="rounded-lg bg-secondary/80 px-2 py-1 font-medium">
                      {c}: расход −{exp.toLocaleString("ru-RU")} {top > 0 ? ` / пополн. +${top.toLocaleString("ru-RU")}` : ""} {CURRENCY_SYMBOLS[c]}
                    </span>
                  );
                })}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Results */}
      {loading ? (
        <ExpenseListSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-muted-foreground">
            {hasActiveFilters ? "Нет расходов по выбранным фильтрам" : "Нет расходов"}
          </p>
          {!hasActiveFilters && (
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Добавить расход
            </Button>
          )}
        </div>
      ) : (
        <div ref={listRef} className="space-y-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Найдено: {sortedExpenses.length}
          </p>
          {sortedExpenses.map((expense) => {
            const expDate = new Date(expense.date);
            const isTopup = expense.category === "Пополнение";
            return (
              <div
                key={expense.id}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border",
                  "shadow-[var(--card-shadow)]"
                )}
              >
                {/* Accent strip */}
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl",
                  isTopup ? "bg-success" : "bg-destructive"
                )} />

                <div className="flex items-start gap-3 pl-2">
                  {/* Receipt thumbnail */}
                  {expense.receiptUrl ? (
                    <img
                      src={expense.receiptUrl}
                      alt="Чек"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onClick={() => setZoomImage(expense.receiptUrl)}
                      className="h-12 w-12 shrink-0 cursor-pointer rounded-xl border border-border/60 object-cover transition-transform hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                      <span className="text-lg">{isTopup ? "↑" : "↓"}</span>
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "text-base font-bold font-display tracking-tight",
                        isTopup ? "text-success" : "text-destructive"
                      )}>
                        {isTopup ? "+" : "−"}{Number(expense.amount).toLocaleString("ru-RU")} {CURRENCY_SYMBOLS[expense.currency as Currency] || expense.currency}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          onClick={() => openEditExpense(expense)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeleteTarget(expense)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-primary">
                      {getDriverName(String(expense.driverId))}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center rounded-md bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {expense.category}
                      </span>
                      {expense.truck && (
                        <>
                          <span className="text-[11px] text-muted-foreground/60">·</span>
                          <span className="text-[11px] text-muted-foreground/80">{expense.truck}</span>
                        </>
                      )}
                      <span className="text-[11px] text-muted-foreground/60">·</span>
                      <span className="text-[11px] text-muted-foreground/60">
                        {format(expDate, "dd MMM, HH:mm", { locale: ru })}
                      </span>
                    </div>
                    {expense.comment && (
                      <p className="mt-1 truncate text-xs text-muted-foreground/80">{expense.comment}</p>
                    )}
                    {expense.performedBy && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70">Оператор: {expense.performedBy}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="gap-2">
            {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Подгрузить ещё
          </Button>
        </div>
      )}

      {/* Transfers history */}
      <div className="mt-8 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          История переводов
        </h3>
        {loadingTransfers ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filteredTransfers.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Переводов нет{hasActiveFilters ? " по выбранным фильтрам" : ""}</p>
        ) : (
          <div className="space-y-2">
            {filteredTransfers.map((t) => (
              <div key={t.id} className="rounded-xl border border-border/60 bg-card p-3 shadow-[var(--card-shadow)]">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-foreground">{getDriverName(t.fromDriverId)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium text-foreground">{getDriverName(t.toDriverId)}</span>
                  <div className="flex-1" />
                  <button
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    onClick={() => openEditTransfer(t)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteTransferTarget(t)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-primary">
                    {Number(t.amount).toLocaleString("ru-RU")} {CURRENCY_SYMBOLS[t.currency]}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {format(new Date(t.date), "dd MMM, HH:mm", { locale: ru })}
                  </span>
                </div>
                {t.comment && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80 truncate">{t.comment}</p>
                )}
                {t.performedBy && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">Оператор: {t.performedBy}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Редактировать запись</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <CategoryPicker
              value={editCategory}
              onChange={setEditCategory}
              categories={editCategories}
              open={editCategoryPickerOpen}
              onOpenChange={setEditCategoryPickerOpen}
              error={showEditValidation ? editFormErrors.category : undefined}
            />
            <div className="space-y-1">
              <Input
                placeholder="Сумма"
                type="text"
                inputMode="decimal"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className={cn("h-12 bg-secondary border-border", showEditValidation && editFormErrors.amount && "border-destructive")}
              />
              {showEditValidation && editFormErrors.amount && (
                <p className="text-xs text-destructive">{editFormErrors.amount}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_CURRENCIES.map((c) => (
                <button key={c} type="button" onClick={() => setEditCurrency(c)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", editCurrency === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                  {CURRENCY_FLAGS[c]} {c}
                </button>
              ))}
            </div>
            <Input placeholder="Комментарий" value={editComment} onChange={(e) => setEditComment(e.target.value)} className="h-12 bg-secondary border-border" />
            <TruckPicker
              value={editTruck}
              onChange={setEditTruck}
              trucks={trucks}
              open={editTruckPickerOpen}
              onOpenChange={setEditTruckPickerOpen}
              placeholder="Тягач"
              allowEmpty
              emptyLabel="—"
            />
            <Button className="h-12 w-full" onClick={handleEditSave} disabled={saving}>
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

      <FullScreenImageOverlay url={zoomImage} onClose={() => setZoomImage(null)} alt="Чек" />

      {/* Edit transfer dialog */}
      <Dialog open={editTransferOpen} onOpenChange={setEditTransferOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Редактировать перевод</DialogTitle>
          </DialogHeader>
          {editTransfer && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {getDriverName(editTransfer.fromDriverId)} → {getDriverName(editTransfer.toDriverId)} ({editTransfer.currency})
              </div>
              <Input
                placeholder="Сумма"
                type="number"
                value={editTransferAmount}
                onChange={(e) => setEditTransferAmount(e.target.value)}
                className="bg-secondary border-border"
              />
              <Input
                placeholder="Комментарий"
                value={editTransferComment}
                onChange={(e) => setEditTransferComment(e.target.value)}
                className="bg-secondary border-border"
              />
              <p className="text-xs text-muted-foreground">
                При сохранении балансы будут пересчитаны автоматически.
              </p>
              <Button className="w-full" onClick={handleEditTransferSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Сохранить
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete transfer confirmation */}
      <AlertDialog open={!!deleteTransferTarget} onOpenChange={(open) => !open && setDeleteTransferTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Удалить перевод?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTransferTarget && `${getDriverName(deleteTransferTarget.fromDriverId)} → ${getDriverName(deleteTransferTarget.toDriverId)}: ${Number(deleteTransferTarget.amount).toLocaleString("ru-RU")} ${CURRENCY_SYMBOLS[deleteTransferTarget.currency]}`}
              <br />
              Балансы будут пересчитаны автоматически.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTransfer} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLargeOpen} onOpenChange={setConfirmLargeOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Подтвердить сумму?</AlertDialogTitle>
            <AlertDialogDescription>
              {Number((confirmLargeAction === "add" ? addAmount : editAmount).replace(",", ".")).toLocaleString("ru-RU")}{" "}
              {CURRENCY_SYMBOLS[confirmLargeAction === "add" ? addCurrency : editCurrency]} — крупная сумма.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => void (confirmLargeAction === "add" ? performAddExpense() : performEditSave())}>
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </PageLayout>
  );
};

export default AdminExpenses;
