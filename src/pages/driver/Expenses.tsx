import { useState, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { FullScreenImageOverlay } from "@/components/FullScreenImageOverlay";
import PhotoUpload from "@/components/PhotoUpload";
import OfflineBanner from "@/components/OfflineBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CategoryPicker from "@/components/CategoryPicker";
import ExpenseFormShell from "@/components/ExpenseFormShell";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getExpenseFormErrors, shouldConfirmLargeExpense } from "@/lib/expenseFormValidation";
import { Loader2, Plus, Pencil, X } from "lucide-react";
import { ALL_CURRENCIES, CURRENCY_SYMBOLS, type Currency, type Expense, type TransferRecord } from "@/types";
import { describeDriverTransfer, formatTransferCurrency } from "@/lib/driverTransferDisplay";
import { format, isToday, subDays, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { cn, filterCategoriesByRole, vibrateSuccess } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useScrollReveal } from "@/hooks/useGsap";
import { useToast } from "@/hooks/use-toast";
import { ExpenseListSkeleton } from "@/components/ExpenseCardSkeleton";
import { addToQueue, type PendingExpense } from "@/services/offlineQueue";

const Expenses = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useScrollReveal(listRef);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showExpensesHint, setShowExpensesHint] = useState(() => !localStorage.getItem("driver-expenses-tooltip-seen"));

  // Form state
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("KZT");
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [confirmLargeOpen, setConfirmLargeOpen] = useState(false);

  const activeCurrencies: Currency[] =
    (() => {
      const raw =
        user?.availableCurrencies
          ?.split(",")
          .map((c) => c.trim())
          .filter((c) => ALL_CURRENCIES.includes(c as Currency)) as
        | Currency[]
        | undefined;
      return raw && raw.length > 0 ? raw : ALL_CURRENCIES;
    })();

  const EXPENSES_LOOKBACK_DAYS = 7;
  const expensesSince = startOfDay(subDays(new Date(), EXPENSES_LOOKBACK_DAYS - 1)).toISOString();

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses", user?.id, expensesSince],
    queryFn: async () => {
      const result = await api.getExpenses(user!.id, user!.role, { since: expensesSince });
      if (result.success && result.data) return result.data;
      return [] as Expense[];
    },
    enabled: !!user,
  });

  const { data: transfers = [], isLoading: loadingTransfers } = useQuery({
    queryKey: ["driverTransfers", user?.id, expensesSince],
    queryFn: async () => {
      const result = await api.getDriverTransfers(user!.id, { since: expensesSince });
      if (result.success && result.data) return result.data;
      return [] as TransferRecord[];
    },
    enabled: !!user,
  });

  const feedItems = useMemo(() => {
    const items: Array<
      | { kind: "expense"; date: string; expense: Expense }
      | { kind: "transfer"; date: string; transfer: TransferRecord }
    > = [
      ...expenses.map((expense) => ({ kind: "expense" as const, date: expense.date, expense })),
      ...transfers.map((transfer) => ({ kind: "transfer" as const, date: transfer.date, transfer })),
    ];
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, transfers]);

  const { data: balances } = useQuery({
    queryKey: ["balance", user?.id],
    queryFn: async () => {
      const result = await api.getBalance(user!.id);
      if (result.success && result.data) return result.data;
      return {} as Record<Currency, number>;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["appData"],
    queryFn: async () => {
      const result = await api.getAppData();
      if (result.success && result.data) return result.data.categories;
      return [] as import("@/types").CategoryInfo[];
    },
  });

  const categoriesForRole = filterCategoriesByRole(categories, user?.role ?? "driver");
  const selectedCategoryNoReceipt = categories.find((c) => c.name === category)?.noReceipt ?? false;
  const formErrors = getExpenseFormErrors({
    amount,
    category,
    receiptUrl,
    noReceipt: selectedCategoryNoReceipt,
  });
  const hasFormErrors = Object.keys(formErrors).length > 0;

  const loading = loadingExpenses || loadingTransfers;

  const resetForm = () => {
    setAmount("");
    setCurrency(activeCurrencies[0] || "KZT");
    setCategory("");
    setComment("");
    setReceiptUrl("");
    setReceiptFile(null);
    setEditingExpense(null);
  };

  const openAdd = () => {
    resetForm();
    setShowValidation(false);
    setDialogOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setAmount(String(expense.amount));
    setCurrency(expense.currency);
    setCategory(expense.category);
    setComment(expense.comment);
    setReceiptUrl(expense.receiptUrl);
    setShowValidation(false);
    setDialogOpen(true);
  };

  const performSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      if (editingExpense) {
        await api.updateExpense({
          ...editingExpense,
          amount: Number(amount),
          currency,
          category,
          comment,
          receiptUrl: receiptUrl === "__offline__" ? "" : receiptUrl,
        });
      } else if (!navigator.onLine || receiptUrl === "__offline__") {
        // Save to offline queue
        const pending: PendingExpense = {
          type: "expense",
          id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          driverId: user.id,
          amount: Number(amount),
          currency,
          category,
          comment,
          date: new Date().toISOString(),
          truck: "",
          createdAt: Date.now(),
          status: "pending",
        };
        if (receiptFile) {
          pending.photoBlob = receiptFile;
          pending.photoName = receiptFile.name;
        }
        await addToQueue(pending);
        toast({ title: "Расход сохранён локально", description: "Отправится при появлении сети" });
      } else {
        await api.addExpense({
          driverId: user.id,
          date: new Date().toISOString(),
          amount: Number(amount),
          currency,
          category,
          comment,
          receiptUrl,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["expenses", user.id] });
      toast({ title: editingExpense ? "Расход обновлён" : "Расход добавлен" });
      vibrateSuccess();
    } catch {
      // Network error — save offline
      if (!editingExpense) {
        const pending: PendingExpense = {
          type: "expense",
          id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          driverId: user.id,
          amount: Number(amount),
          currency,
          category,
          comment,
          date: new Date().toISOString(),
          truck: "",
          createdAt: Date.now(),
          status: "pending",
        };
        if (receiptFile) {
          pending.photoBlob = receiptFile;
          pending.photoName = receiptFile.name;
        }
        await addToQueue(pending);
        toast({ title: "Нет сети — сохранено локально" });
      }
    }

    setSaving(false);
    setDialogOpen(false);
    setConfirmLargeOpen(false);
    resetForm();
  };

  const handleSave = () => {
    if (!user) return;
    setShowValidation(true);
    if (hasFormErrors) return;

    const currentBalance = balances?.[currency];
    if (shouldConfirmLargeExpense(amount, currency, currentBalance)) {
      setConfirmLargeOpen(true);
      return;
    }

    void performSave();
  };

  const expenseFormFields = (
    <div className="space-y-4">
      <div className="space-y-1">
        <Input
          type="text"
          inputMode="decimal"
          placeholder="Сумма"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={cn("h-12 bg-secondary", showValidation && formErrors.amount && "border-destructive")}
        />
        {showValidation && formErrors.amount && (
          <p className="text-xs text-destructive">{formErrors.amount}</p>
        )}
      </div>
      <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
        <SelectTrigger className="h-12 bg-secondary">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={4}>
          {activeCurrencies.map((c) => (
            <SelectItem key={c} value={c}>
              {c} ({CURRENCY_SYMBOLS[c]})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {user && (
        <p className="text-xs text-muted-foreground">
          Текущий баланс:{" "}
          {(balances?.[currency] ?? 0).toLocaleString("ru-RU", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          {CURRENCY_SYMBOLS[currency]}
        </p>
      )}
      <CategoryPicker
        value={category}
        onChange={setCategory}
        categories={categoriesForRole}
        open={categoryPickerOpen}
        onOpenChange={setCategoryPickerOpen}
        error={showValidation ? formErrors.category : undefined}
      />
      <Input
        placeholder="Комментарий"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="h-12 bg-secondary"
      />
      {!selectedCategoryNoReceipt && (
        <div className="space-y-1">
          {receiptUrl ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Фото чека:</p>
              <div className="relative">
                <img src={receiptUrl} alt="Чек" className="h-32 w-full rounded-lg border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => setReceiptUrl("")}
                  className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <PhotoUpload label="Фото чека" onUpload={setReceiptUrl} onFileReady={(f) => setReceiptFile(f)} />
          )}
          {showValidation && formErrors.receipt && (
            <p className="text-xs text-destructive">{formErrors.receipt}</p>
          )}
        </div>
      )}
    </div>
  );

  const expenseFormFooter = (
    <Button
      onClick={handleSave}
      disabled={saving}
      className="h-12 w-full text-base font-semibold"
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
    </Button>
  );

  return (
    <PageLayout title="Расходы">
      <OfflineBanner />
      <div className="mb-4 mt-2">
        {showExpensesHint && (
          <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground flex items-center justify-between gap-2 mb-3">
            <span>Нажмите «Добавить расход», чтобы зафиксировать трату</span>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-8"
              onClick={() => {
                localStorage.setItem("driver-expenses-tooltip-seen", "1");
                setShowExpensesHint(false);
              }}
            >
              Понятно
            </Button>
          </div>
        )}
        <ExpenseFormShell
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={editingExpense ? "Редактировать расход" : "Новый расход"}
          trigger={
            <Button onClick={openAdd} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Добавить расход
            </Button>
          }
          footer={expenseFormFooter}
        >
          {expenseFormFields}
        </ExpenseFormShell>
      </div>

      {loading ? (
        <ExpenseListSkeleton count={4} />
      ) : feedItems.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-muted-foreground">Нет расходов и переводов за последние {EXPENSES_LOOKBACK_DAYS} дней</p>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Добавить первый расход
          </Button>
        </div>
      ) : (
        <div ref={listRef} className="space-y-3">
          {feedItems.map((item) => {
            if (item.kind === "transfer") {
              const transfer = item.transfer;
              const transferDate = new Date(transfer.date);
              const meta = describeDriverTransfer(transfer, user!.id);
              return (
                <div
                  key={`transfer-${transfer.id}`}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border",
                    "shadow-[var(--card-shadow)]",
                  )}
                >
                  <div
                    className={cn(
                      "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl",
                      meta.isPositive ? "bg-success" : "bg-primary",
                    )}
                  />
                  <div className="flex items-start gap-3 pl-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                      <span className="text-lg">{meta.isPositive ? "↗" : "↘"}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "text-base font-bold font-display tracking-tight",
                          meta.isPositive ? "text-success" : "text-primary",
                        )}
                      >
                        {meta.isPositive ? "+" : "−"}
                        {formatTransferCurrency(meta.currencyLabel, meta.amount)}
                      </span>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {meta.label}
                        </span>
                        {meta.detail && (
                          <>
                            <span className="text-[11px] text-muted-foreground/60">·</span>
                            <span className="text-[11px] text-muted-foreground/80">{meta.detail}</span>
                          </>
                        )}
                        <span className="text-[11px] text-muted-foreground/60">·</span>
                        <span className="text-[11px] text-muted-foreground/60">
                          {format(transferDate, "dd MMM, HH:mm", { locale: ru })}
                        </span>
                      </div>
                      {transfer.comment && (
                        <p className="mt-1 text-xs text-foreground/90">{transfer.comment}</p>
                      )}
                      {transfer.performedBy && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                          Оператор: {transfer.performedBy}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            const expense = item.expense;
            const expenseDate = new Date(expense.date);
            const editable = isToday(expenseDate) && expense.category !== "Пополнение";
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
                        {isTopup ? "+" : "−"}{expense.amount.toLocaleString("ru-RU")} {CURRENCY_SYMBOLS[expense.currency]}
                      </span>
                      {editable && (
                        <button
                          onClick={() => openEdit(expense)}
                          className="h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
                          isTopup
                            ? "bg-success/15 text-success"
                            : "bg-secondary/80 text-muted-foreground",
                        )}
                      >
                        {isTopup ? "Пополнение предбаланса" : expense.category}
                      </span>
                      {!isTopup && expense.truck && (
                        <>
                          <span className="text-[11px] text-muted-foreground/60">·</span>
                          <span className="text-[11px] text-muted-foreground/80">{expense.truck}</span>
                        </>
                      )}
                      <span className="text-[11px] text-muted-foreground/60">·</span>
                      <span className="text-[11px] text-muted-foreground/60">
                        {format(expenseDate, "dd MMM, HH:mm", { locale: ru })}
                      </span>
                    </div>
                    {isTopup && expense.comment && (
                      <p className="mt-1 text-xs text-foreground/90">{expense.comment}</p>
                    )}
                    {!isTopup && expense.comment && (
                      <p className="mt-1 truncate text-xs text-muted-foreground/80">{expense.comment}</p>
                    )}
                    {isTopup && expense.performedBy && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                        Оператор: {expense.performedBy}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FullScreenImageOverlay url={zoomImage} onClose={() => setZoomImage(null)} alt="Чек" />

      <AlertDialog open={confirmLargeOpen} onOpenChange={setConfirmLargeOpen}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердить сумму?</AlertDialogTitle>
            <AlertDialogDescription>
              {Number(amount.replace(",", ".")).toLocaleString("ru-RU")} {CURRENCY_SYMBOLS[currency]}
              {(balances?.[currency] ?? 0) < Number(amount.replace(",", "."))
                ? " — сумма больше текущего баланса."
                : " — крупная сумма."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => void performSave()}>
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default Expenses;
