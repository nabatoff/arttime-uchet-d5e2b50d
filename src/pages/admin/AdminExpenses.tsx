import { useEffect, useState } from "react";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Filter, X, Plus, CalendarIcon } from "lucide-react";
import { ALL_CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_FLAGS, type Currency, type Expense, type User } from "@/types";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const AdminExpenses = () => {
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"expense" | "topup">("expense");
  const [addDriver, setAddDriver] = useState("");
  const [addCategory, setAddCategory] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addCurrency, setAddCurrency] = useState<Currency>("KZT");
  const [addComment, setAddComment] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Filters
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      const [expResult, driversResult, appResult] = await Promise.all([
        api.getExpenses("", "Admin"),
        api.getDrivers(),
        api.getAppData(),
      ]);
      if (expResult.success && expResult.data) {
        setAllExpenses(expResult.data);
      }
      if (driversResult.success && driversResult.data) {
        setDrivers(driversResult.data.filter((d) => d.role.toLowerCase() !== "admin"));
      }
      if (appResult.success && appResult.data) {
        setCategories(appResult.data.categories);
      }
      setLoading(false);
    };
    load();
  }, []);

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
        receiptUrl: "",
      });
      toast({ title: "Расход добавлен" });
    }

    setAddOpen(false);
    setAddAmount("");
    setAddComment("");
    setAddCategory("");
    setSaving(false);

    // Reload
    const expResult = await api.getExpenses("", "Admin");
    if (expResult.success && expResult.data) setAllExpenses(expResult.data);
    const driversResult = await api.getDrivers();
    if (driversResult.success && driversResult.data) {
      setDrivers(driversResult.data.filter((d) => d.role.toLowerCase() !== "admin"));
    }
  };

  return (
    <PageLayout title="Расходы">
      {/* Top actions */}
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant={showFilters ? "default" : "secondary"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-1.5"
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
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs text-muted-foreground">
            <X className="h-3 w-3" /> Сбросить
          </Button>
        )}
        <div className="flex-1" />
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Добавить
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

              <Button className="w-full" onClick={handleAddExpense} disabled={saving}>
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
            return (
              <Card key={expense.id} className="border-border bg-card">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {Number(expense.amount).toLocaleString("ru-RU")} {CURRENCY_SYMBOLS[expense.currency as Currency] || expense.currency}
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
                    </div>
                    <div className="ml-2 text-right">
                      <p className="text-[10px] text-muted-foreground">
                        {format(expDate, "dd MMM", { locale: ru })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(expDate, "HH:mm")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
};

export default AdminExpenses;
