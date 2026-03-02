import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import PhotoUpload from "@/components/PhotoUpload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, X } from "lucide-react";
import { ALL_CURRENCIES, CURRENCY_SYMBOLS, type Currency, type Expense } from "@/types";
import { format, isToday, subDays, isAfter, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

const Expenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("KZT");
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const activeCurrencies = user?.availableCurrencies
    ?.split(",")
    .map((c) => c.trim())
    .filter((c) => ALL_CURRENCIES.includes(c as Currency)) as Currency[] || ALL_CURRENCIES;

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [expResult, appResult] = await Promise.all([
        api.getExpenses(user.id),
        api.getAppData(),
      ]);
      if (expResult.success && expResult.data) {
        // Filter last 3 days
        const threeDaysAgo = startOfDay(subDays(new Date(), 3));
        setExpenses(
          expResult.data.filter((e) => isAfter(new Date(e.date), threeDaysAgo))
        );
      }
      if (appResult.success && appResult.data) {
        setCategories(appResult.data.categories);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const resetForm = () => {
    setAmount("");
    setCurrency(activeCurrencies[0] || "KZT");
    setCategory("");
    setComment("");
    setReceiptUrl("");
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
    if (!user || !amount || !category || !comment || !receiptUrl) return;
    setSaving(true);

    if (editingExpense) {
      const result = await api.updateExpense({
        ...editingExpense,
        amount: Number(amount),
        currency,
        category,
        comment,
        receiptUrl,
      });
      if (result.success && result.data) {
        setExpenses((prev) =>
          prev.map((e) => (e.id === editingExpense.id ? result.data! : e))
        );
      }
    } else {
      const result = await api.addExpense({
        driverId: user.id,
        date: new Date().toISOString(),
        amount: Number(amount),
        currency,
        category,
        comment,
        receiptUrl,
      });
      if (result.success && result.data) {
        setExpenses((prev) => [result.data!, ...prev]);
      }
    }

    setSaving(false);
    setDialogOpen(false);
    resetForm();
  };

  const canSave = amount && category && comment && receiptUrl && !saving;

  return (
    <PageLayout title="Расходы">
      <div className="mb-4">
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
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12 bg-secondary">
                  <SelectValue placeholder="Категория" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Комментарий"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="h-12 bg-secondary"
              />
              {/* Show existing receipt or upload new */}
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
                <PhotoUpload
                  label="Фото чека"
                  onUpload={setReceiptUrl}
                />
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
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : expenses.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Нет расходов за последние 3 дня</p>
      ) : (
        <div className="space-y-2 animate-fade-in">
          {expenses.map((expense) => {
            const expenseDate = new Date(expense.date);
            const editable = isToday(expenseDate) && expense.category !== "Пополнение";
            const isTopup = expense.category === "Пополнение";
            return (
              <Card key={expense.id} className={cn("card-elevated", isTopup ? "border-l-4 border-l-green-500" : "border-l-4 border-l-destructive")}>
                <CardContent className="flex items-center justify-between p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-semibold", isTopup ? "text-green-500" : "text-destructive")}>
                        {isTopup ? "+" : "−"}{expense.amount.toLocaleString("ru-RU")} {CURRENCY_SYMBOLS[expense.currency]}
                      </span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {expense.category}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {expense.comment}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(expenseDate, "dd MMM, HH:mm", { locale: ru })}
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
                  {editable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(expense)}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Image zoom overlay */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setZoomImage(null)}
        >
          <img src={zoomImage} alt="Чек" className="max-h-[85vh] max-w-[90vw] rounded-lg border border-border object-contain shadow-lg" />
          <button onClick={() => setZoomImage(null)} className="absolute right-4 top-4 rounded-full bg-background/80 p-2 text-foreground hover:bg-background">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </PageLayout>
  );
};

export default Expenses;
