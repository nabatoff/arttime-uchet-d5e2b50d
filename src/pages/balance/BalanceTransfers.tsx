import { useState, useMemo } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight, Download, CalendarIcon, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ALL_CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_FLAGS, type Currency, type User, type TransferRecord } from "@/types";
import { cn, vibrateSuccess } from "@/lib/utils";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { TransferListSkeleton } from "@/components/TransferCardSkeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BalanceTransfers = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Transfer form
  const [fromDriverId, setFromDriverId] = useState("");
  const [toDriverId, setToDriverId] = useState("");
  const [currency, setCurrency] = useState<Currency>("KZT");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  // Conversion form
  const [convDriverId, setConvDriverId] = useState("");
  const [convFromCurrency, setConvFromCurrency] = useState<Currency>("KZT");
  const [convToCurrency, setConvToCurrency] = useState<Currency>("RUB");
  const [convAmount, setConvAmount] = useState("");
  const [convRate, setConvRate] = useState("");
  const [convSaving, setConvSaving] = useState(false);

  const defaultDateTo = endOfDay(new Date());
  const defaultDateFrom = startOfDay(subDays(new Date(), 30));
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => defaultDateFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(() => defaultDateTo);
  const since = dateFrom ? startOfDay(dateFrom).toISOString() : undefined;
  const until = dateTo ? endOfDay(dateTo).toISOString() : undefined;

  const { data: allUsers = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ["allUsers"],
    queryFn: async () => {
      const result = await api.getDrivers();
      return result.success && result.data ? result.data : [] as User[];
    },
  });

  const drivers = useMemo(() => allUsers.filter((d) => (d.role ?? "").toLowerCase() !== "admin"), [allUsers]);

  const {
    data: transfersData,
    isLoading: loadingTransfers,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["transfers", since ?? "", until ?? ""],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await api.getTransfers({
        since,
        until,
        limit: 50,
        offset: pageParam as number,
      });
      return result.success && result.data ? result.data : ([] as TransferRecord[]);
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= 50 ? allPages.length * 50 : undefined,
    initialPageParam: 0,
  });

  const transfers = useMemo(() => transfersData?.pages.flat() ?? [], [transfersData]);

  const fromDriver = drivers.find((d) => String(d.id) === fromDriverId);
  const availablePreBalance = fromDriver?.preBalances?.[currency] ?? 0;

  // Conversion computed
  const convDriver = drivers.find((d) => String(d.id) === convDriverId);
  const convAvailable = convDriver?.preBalances?.[convFromCurrency] ?? 0;
  const convertedAmount = convAmount && convRate ? Math.round(Number(convAmount) * Number(convRate) * 100) / 100 : 0;

  const getDriverName = (id: string) => {
    const d = drivers.find((dr) => String(dr.id) === String(id));
    return d?.name || id;
  };

  const exportToExcel = () => {
    import("xlsx").then((XLSX) => {
      const rows = transfers.map((t) => ({
        "Дата": format(new Date(t.date), "dd.MM.yyyy HH:mm", { locale: ru }),
        "От кого": getDriverName(t.fromDriverId),
        "Кому": getDriverName(t.toDriverId),
        "Валюта": t.currency,
        "Сумма": t.amount,
        "Комментарий": t.comment || "",
        "Кто выполнил": t.performedBy || "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Переводы");
      XLSX.writeFile(wb, `Переводы_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
    });
  };

  const handleTransfer = async () => {
    if (!fromDriverId || !toDriverId || !amount || Number(amount) <= 0) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }

    setSaving(true);
    const result = await api.transfer(fromDriverId, toDriverId, currency, Number(amount), user?.id || "", comment, true);
    if (result.success) {
      toast({ title: "Перевод выполнен" });
      vibrateSuccess();
      setAmount("");
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
    } else {
      toast({ title: result.error || "Ошибка перевода", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleConvert = async () => {
    if (!convDriverId || !convAmount || !convRate || Number(convAmount) <= 0 || Number(convRate) <= 0) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }
    if (convFromCurrency === convToCurrency) {
      toast({ title: "Выберите разные валюты", variant: "destructive" });
      return;
    }

    setConvSaving(true);
    const result = await api.convertPreBalance(convDriverId, convFromCurrency, convToCurrency, Number(convAmount), Number(convRate), user?.id || "");
    if (result.success) {
      toast({ title: `Конвертация выполнена: ${convertedAmount} ${CURRENCY_SYMBOLS[convToCurrency]}` });
      vibrateSuccess();
      setConvAmount("");
      setConvRate("");
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
    } else {
      toast({ title: result.error || "Ошибка конвертации", variant: "destructive" });
    }
    setConvSaving(false);
  };

  return (
    <PageLayout title="Переводы">
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="transfer" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transfer">Перевод</TabsTrigger>
            <TabsTrigger value="convert">Конвертация</TabsTrigger>
          </TabsList>

          {/* Transfer tab */}
          <TabsContent value="transfer">
            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--card-shadow)] space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Новый перевод</h3>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">С предбаланса водителя</p>
                <Select value={fromDriverId} onValueChange={setFromDriverId}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Выберите водителя" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">На основной баланс водителя</p>
                <Select value={toDriverId} onValueChange={setToDriverId}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Выберите водителя" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Валюта</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                        currency === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {CURRENCY_FLAGS[c]} {c}
                    </button>
                  ))}
                </div>
              </div>

              {fromDriverId && (
                <p className="text-xs text-muted-foreground">
                  Доступно на предбалансе: <span className={cn("font-bold", availablePreBalance < 0 ? "text-destructive" : "text-primary")}>{availablePreBalance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {CURRENCY_SYMBOLS[currency]}</span>
                </p>
              )}

              <Input
                placeholder="Сумма"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-secondary border-border"
              />

              <Input
                placeholder="Комментарий (необязательно)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="bg-secondary border-border"
              />

              <Button className="w-full gap-2" onClick={handleTransfer} disabled={saving || !fromDriverId || !toDriverId || !amount}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Перевести
              </Button>
            </div>
          </TabsContent>

          {/* Conversion tab */}
          <TabsContent value="convert">
            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--card-shadow)] space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Конвертация на предбалансе</h3>

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Водитель</p>
                <Select value={convDriverId} onValueChange={setConvDriverId}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Выберите водителя" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Из валюты</p>
                  <Select value={convFromCurrency} onValueChange={(v) => setConvFromCurrency(v as Currency)}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{CURRENCY_FLAGS[c]} {c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">В валюту</p>
                  <Select value={convToCurrency} onValueChange={(v) => setConvToCurrency(v as Currency)}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_CURRENCIES.filter((c) => c !== convFromCurrency).map((c) => (
                        <SelectItem key={c} value={c}>{CURRENCY_FLAGS[c]} {c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {convDriverId && (
                <p className="text-xs text-muted-foreground">
                  Доступно {convFromCurrency}: <span className={cn("font-bold", convAvailable < 0 ? "text-destructive" : "text-primary")}>{convAvailable.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {CURRENCY_SYMBOLS[convFromCurrency]}</span>
                </p>
              )}

              <Input
                placeholder="Сумма списания"
                type="number"
                value={convAmount}
                onChange={(e) => setConvAmount(e.target.value)}
                className="bg-secondary border-border"
              />

              <Input
                placeholder="Курс обмена"
                type="number"
                step="any"
                value={convRate}
                onChange={(e) => setConvRate(e.target.value)}
                className="bg-secondary border-border"
              />

              {convertedAmount > 0 && (
                <div className="rounded-lg bg-secondary/80 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Будет зачислено</p>
                  <p className="text-lg font-bold text-primary">
                    {convertedAmount.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {CURRENCY_SYMBOLS[convToCurrency]}
                  </p>
                </div>
              )}

              <Button className="w-full gap-2" onClick={handleConvert} disabled={convSaving || !convDriverId || !convAmount || !convRate}>
                {convSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Конвертировать
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Transfer history */}
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              История переводов
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "Сегодня", from: startOfDay(new Date()), to: endOfDay(new Date()) },
                { label: "7 д.", from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) },
                { label: "30 д.", from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) },
                { label: "Месяц", from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
              ].map(({ label, from, to }) => (
                <Button key={label} variant="outline" size="sm" className="text-xs h-9" onClick={() => { setDateFrom(from); setDateTo(to); }}>
                  {label}
                </Button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 text-xs", (!dateFrom || !dateTo) && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {dateFrom && dateTo ? `${format(dateFrom, "dd.MM.yy")} – ${format(dateTo, "dd.MM.yy")}` : "Период"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="flex gap-1 p-2">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {loadingTransfers || loadingDrivers ? (
            <TransferListSkeleton count={5} />
          ) : transfers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Нет переводов</p>
          ) : (
            <div className="space-y-2">
              {transfers.map((t) => (
                <div key={t.id} className="rounded-xl border border-border/60 bg-card p-3 shadow-[var(--card-shadow)]">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-foreground">{getDriverName(t.fromDriverId)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-foreground">{getDriverName(t.toDriverId)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">
                      {Number(t.amount).toLocaleString("ru-RU")} {CURRENCY_SYMBOLS[t.currency as Currency] || t.currency}
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
          {!loadingTransfers && !loadingDrivers && hasNextPage && (
            <div className="mt-3 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="gap-2">
                {isFetchingNextPage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Подгрузить ещё
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default BalanceTransfers;
