import { useState, useRef, useMemo } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import PageLayout from "@/components/PageLayout";
import { FullScreenImageOverlay } from "@/components/FullScreenImageOverlay";
import { Button } from "@/components/ui/button";
import { Loader2, Filter, X, CalendarIcon, Plus, ChevronDown } from "lucide-react";
import { ALL_CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_FLAGS, type Currency, type Expense, type User } from "@/types";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { buildAdminExpenseListFilters, type FilterExpenseKind } from "@/lib/expenseQueryFilters";
import { cn, filterCategoriesByRole } from "@/lib/utils";
import { ExpenseListSkeleton } from "@/components/ExpenseCardSkeleton";
import PhotoUpload from "@/components/PhotoUpload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useScrollReveal } from "@/hooks/useGsap";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { vibrateSuccess } from "@/lib/utils";

const BalanceExpenses = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const listRef = useRef<HTMLDivElement>(null);
  useScrollReveal(listRef);
  const [showFilters, setShowFilters] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Self-expense dialog state (for role balance)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("KZT");
  const [category, setCategory] = useState("");
  const [comment, setComment] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const defaultDateTo = endOfDay(new Date());
  const defaultDateFrom = startOfDay(new Date());

  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterExpenseKind, setFilterExpenseKind] = useState<FilterExpenseKind>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => defaultDateFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(() => defaultDateTo);

  const since = dateFrom ? startOfDay(dateFrom).toISOString() : undefined;
  const until = dateTo ? endOfDay(dateTo).toISOString() : undefined;

  const {
    data,
    isLoading: loadingExpenses,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["balanceExpenses", since ?? "", until ?? "", filterDriver, filterCategory, filterExpenseKind],
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

  const drivers = useMemo(() => allUsers.filter((d) => (d.role ?? "").toLowerCase() !== "admin"), [allUsers]);

  const { data: categories = [] } = useQuery({
    queryKey: ["appData"],
    queryFn: async () => {
      const result = await api.getAppData();
      return result.success && result.data ? result.data.categories : [] as import("@/types").CategoryInfo[];
    },
  });

  const categoriesForRole = useMemo(
    () => filterCategoriesByRole(categories, user?.role ?? "balance"),
    [categories, user?.role]
  );

  const getDriverName = (driverId: string) => {
    const driver = drivers.find((d) => String(d.id) === String(driverId));
    return driver?.name || "Неизвестный";
  };

  const filtered = allExpenses;

  const sortedExpenses = useMemo(
    () =>
      [...filtered].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [filtered],
  );

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

  const activeCurrenciesForUser: Currency[] = useMemo(() => {
    const raw =
      user?.availableCurrencies
        ?.split(",")
        .map((c) => c.trim())
        .filter((c) => ALL_CURRENCIES.includes(c as Currency)) as
        | Currency[]
        | undefined;
    return raw && raw.length > 0 ? raw : ALL_CURRENCIES;
  }, [user?.availableCurrencies]);

  const selectedCategoryNoReceipt =
    categories.find((c) => c.name === category)?.noReceipt ?? false;

  const resetForm = () => {
    setAmount("");
    setCurrency(activeCurrenciesForUser[0] || "KZT");
    setCategory("");
    setComment("");
    setReceiptUrl("");
  };

  const handleSave = async () => {
    if (!user || !amount || !category || (!receiptUrl && !selectedCategoryNoReceipt)) return;
    setSaving(true);
    await api.addExpense({
      driverId: user.id,
      date: new Date().toISOString(),
      amount: Number(amount),
      currency,
      category,
      comment,
      receiptUrl,
    });
    toast({ title: "Расход добавлен" });
    vibrateSuccess();
    await queryClient.invalidateQueries({ queryKey: ["balanceExpenses"] });
    setSaving(false);
    setDialogOpen(false);
    resetForm();
  };

  const canSave = amount && category && (receiptUrl || selectedCategoryNoReceipt) && !saving;

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
        {user?.role === "balance" && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 shrink-0">
                <Plus className="h-4 w-4" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Новый расход (мой)</DialogTitle>
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
                    <SelectValue placeholder="Валюта" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCurrenciesForUser.map((c) => (
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
                    <PhotoUpload label="Фото чека" onUpload={setReceiptUrl} />
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
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-4 space-y-3 rounded-xl border border-border bg-card p-4 animate-fade-in">
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
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Категория</p>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-10 bg-secondary">
                <SelectValue placeholder="Все категории" />
              </SelectTrigger>
              <SelectContent>
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
              <SelectContent>
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
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Период</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                { label: "Сегодня", from: startOfDay(new Date()), to: endOfDay(new Date()) },
                { label: "7 дней", from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) },
                { label: "30 дней", from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) },
                { label: "Месяц", from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
              ].map(({ label, from, to }) => (
                <Button key={label} variant="outline" size="sm" className="text-xs" onClick={() => { setDateFrom(from); setDateTo(to); }}>
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Дата от</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-10 w-full justify-start text-left text-sm", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd.MM.yy") : "Выбрать"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Дата до</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-10 w-full justify-start text-left text-sm", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd.MM.yy") : "Выбрать"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      )}

      {/* Summary — сворачиваемый, по умолчанию свернут */}
      {!loadingExpenses && filtered.length > 0 && (
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

      {/* Results — read-only cards */}
      {loadingExpenses ? (
        <ExpenseListSkeleton count={6} />
      ) : sortedExpenses.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          {hasActiveFilters ? "Нет расходов по выбранным фильтрам" : "Нет расходов"}
        </p>
      ) : (
        <div ref={listRef} className="space-y-3">
          <p className="mb-2 text-xs text-muted-foreground">Найдено: {sortedExpenses.length}</p>
          {sortedExpenses.map((expense) => {
            const expDate = new Date(expense.date);
            const isTopup = expense.category === "Пополнение";
            return (
              <div
                key={expense.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200",
                  "shadow-[var(--card-shadow)]"
                )}
              >
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl",
                  isTopup ? "bg-success" : "bg-destructive"
                )} />
                <div className="flex items-start gap-3 pl-2">
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
                  <div className="min-w-0 flex-1">
                    <span className={cn(
                      "text-base font-bold font-display tracking-tight",
                      isTopup ? "text-success" : "text-destructive"
                    )}>
                      {isTopup ? "+" : "−"}{Number(expense.amount).toLocaleString("ru-RU")} {CURRENCY_SYMBOLS[expense.currency as Currency] || expense.currency}
                    </span>
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loadingExpenses && hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="gap-2">
            {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Подгрузить ещё
          </Button>
        </div>
      )}

      <FullScreenImageOverlay url={zoomImage} onClose={() => setZoomImage(null)} alt="Чек" />
    </PageLayout>
  );
};

export default BalanceExpenses;
