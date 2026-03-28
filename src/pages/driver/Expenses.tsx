import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import PhotoUpload from "@/components/PhotoUpload";
import OfflineBanner from "@/components/OfflineBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, X } from "lucide-react";
import { ALL_CURRENCIES, CURRENCY_SYMBOLS, type Currency, type Expense } from "@/types";
import { format, isToday, subDays, isAfter, startOfDay } from "date-fns";
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
  const [zoomImageLoadError, setZoomImageLoadError] = useState(false);

  useEffect(() => {
    if (zoomImage) setZoomImageLoadError(false);
  }, [zoomImage]);
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

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses", user?.id],
    queryFn: async () => {
      const result = await api.getExpenses(user!.id);
      if (result.success && result.data) {
        const threeDaysAgo = startOfDay(subDays(new Date(), 3));
        return result.data.filter((e) => isAfter(new Date(e.date), threeDaysAgo));
      }
      return [] as Expense[];
    },
    enabled: !!user,
  });

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

  const loading = loadingExpenses;

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
    setDialogOpen(true);
  };

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setAmount(String(expense.amount));
    setCurrency(expense.currency);
    setCategory(expense.category);
    setComment(expense.comment);
    setReceiptUrl(expense.receiptUrl);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !amount || !category || (!receiptUrl && !selectedCategoryNoReceipt)) return;
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
    resetForm();
  };

  const canSave = amount && category && (receiptUrl || selectedCategoryNoReceipt) && !saving;

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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Добавить расход
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? "Редактировать расход" : "Новый расход"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                type="number"
                placeholder="Сумма"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 bg-secondary"
              />
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="h-12 bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12 bg-secondary">
                  <SelectValue placeholder="Категория" />
                </SelectTrigger>
                <SelectContent>
                  {categoriesForRole.map((c) => (
                    <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Комментарий"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="h-12 bg-secondary"
              />
              {!selectedCategoryNoReceipt && (
                receiptUrl ? (
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
                )
              )}
              <Button
                onClick={handleSave}
                disabled={!canSave}
                className="h-12 w-full text-base font-semibold"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <ExpenseListSkeleton count={4} />
      ) : expenses.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Нет расходов за последние 3 дня</p>
      ) : (
        <div ref={listRef} className="space-y-3">
          {[...expenses]
            .sort(
              (a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime(),
            )
            .map((expense) => {
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
                        {format(expenseDate, "dd MMM, HH:mm", { locale: ru })}
                      </span>
                    </div>
                    {expense.comment && (
                      <p className="mt-1 truncate text-xs text-muted-foreground/80">{expense.comment}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {zoomImage && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/92 p-4"
          onClick={() => {
            setZoomImage(null);
            setZoomImageLoadError(false);
          }}
        >
          <div className="relative flex min-h-[200px] min-w-0 max-h-[85vh] max-w-[90vw] shrink-0 items-center justify-center">
            {zoomImageLoadError ? (
              <div className="flex flex-col items-center gap-3 rounded-lg bg-card p-6 text-center" onClick={(e) => e.stopPropagation()}>
                <p className="text-sm text-muted-foreground">Не удалось загрузить изображение</p>
                <a
                  href={zoomImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-primary underline"
                >
                  Открыть в новой вкладке
                </a>
              </div>
            ) : (
              <img
                key={zoomImage}
                src={zoomImage}
                alt="Чек"
                referrerPolicy="no-referrer"
                decoding="async"
                onClick={(e) => e.stopPropagation()}
                onError={() => setZoomImageLoadError(true)}
                className="relative z-[1] max-h-[85vh] max-w-full rounded-lg border border-white/10 bg-neutral-950 object-contain shadow-lg"
              />
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomImage(null);
              setZoomImageLoadError(false);
            }}
            className="absolute right-4 top-4 z-10 rounded-full bg-background/90 p-2 text-foreground hover:bg-background"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </PageLayout>
  );
};

export default Expenses;
