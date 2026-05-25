import { useEffect, useMemo, useState } from "react";
import { format, endOfDay, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, CalendarRange, ListFilter, Wallet } from "lucide-react";

import PageLayout from "@/components/PageLayout";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";
import { ALL_CURRENCIES, CURRENCY_SYMBOLS, type Currency, type DriverLedgerData, type DriverLedgerRow, type User, type WalletType } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type DateMode = "day" | "range";
type WalletFilter = "all" | WalletType;
type CurrencyFilter = "all" | Currency;

const walletLabels: Record<WalletType, string> = {
  balance: "Баланс",
  pre_balance: "Предбаланс",
};

const sourceLabels: Record<DriverLedgerRow["sourceType"], string> = {
  expense: "Расход",
  transfer: "Перевод",
  conversion: "Конвертация",
  adjustment: "Корректировка",
};

function isoDayStart(day: string): string {
  return startOfDay(new Date(`${day}T00:00:00`)).toISOString();
}

function isoDayEnd(day: string): string {
  return endOfDay(new Date(`${day}T00:00:00`)).toISOString();
}

const AdminLedger = () => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;

  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [dateMode, setDateMode] = useState<DateMode>("day");
  const [day, setDay] = useState(today);
  const [rangeFrom, setRangeFrom] = useState(monthStart);
  const [rangeTo, setRangeTo] = useState(today);
  const [walletFilter, setWalletFilter] = useState<WalletFilter>("all");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>("all");

  const { data: allUsers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["allUsers"],
    queryFn: async () => {
      const result = await api.getDrivers();
      return result.success && result.data ? result.data : ([] as User[]);
    },
  });

  const drivers = useMemo(
    () => allUsers.filter((d) => (d.role ?? "").toLowerCase() !== "admin"),
    [allUsers],
  );

  useEffect(() => {
    if (!selectedDriverId && drivers.length > 0) {
      setSelectedDriverId(String(drivers[0].id));
    }
  }, [drivers, selectedDriverId]);

  const since = dateMode === "day" ? isoDayStart(day) : isoDayStart(rangeFrom);
  const until = dateMode === "day" ? isoDayEnd(day) : isoDayEnd(rangeTo);

  const { data, isLoading } = useQuery({
    queryKey: ["adminLedger", selectedDriverId, since, until],
    enabled: !!selectedDriverId,
    queryFn: async () => {
      const result = await api.getDriverLedger(selectedDriverId, since, until);
      return result.success && result.data ? result.data : ({ openings: [], rows: [], summary: [] } as DriverLedgerData);
    },
  });

  const filteredOpenings = useMemo(
    () =>
      (data?.openings ?? []).filter((item) => {
        if (walletFilter !== "all" && item.walletType !== walletFilter) return false;
        if (currencyFilter !== "all" && item.currency !== currencyFilter) return false;
        return true;
      }),
    [data?.openings, walletFilter, currencyFilter],
  );

  const filteredRows = useMemo(
    () =>
      (data?.rows ?? []).filter((row) => {
        if (walletFilter !== "all" && row.walletType !== walletFilter) return false;
        if (currencyFilter !== "all" && row.currency !== currencyFilter) return false;
        return true;
      }),
    [data?.rows, walletFilter, currencyFilter],
  );

  const filteredSummary = useMemo(
    () =>
      (data?.summary ?? []).filter((item) => {
        if (walletFilter !== "all" && item.walletType !== walletFilter) return false;
        if (currencyFilter !== "all" && item.currency !== currencyFilter) return false;
        return true;
      }),
    [data?.summary, walletFilter, currencyFilter],
  );

  const hasRows = filteredOpenings.length > 0 || filteredRows.length > 0;

  return (
    <PageLayout title="Детализация" backTo="/admin/settings">
      <div className="space-y-4 animate-fade-in">
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--card-shadow)]">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <ListFilter className="h-4 w-4 text-primary" />
            Фильтры
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Водитель</p>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger className="h-11 bg-background">
                  <SelectValue placeholder={driversLoading ? "Загрузка..." : "Выберите водителя"} />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={String(driver.id)}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">Режим даты</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant={dateMode === "day" ? "default" : "outline"} onClick={() => setDateMode("day")}>
                  День
                </Button>
                <Button variant={dateMode === "range" ? "default" : "outline"} onClick={() => setDateMode("range")}>
                  Период
                </Button>
              </div>
            </div>

            {dateMode === "day" ? (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Дата</p>
                <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="h-11 bg-background" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">С</p>
                  <Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="h-11 bg-background" />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">По</p>
                  <Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="h-11 bg-background" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Кошелёк</p>
                <Select value={walletFilter} onValueChange={(value: WalletFilter) => setWalletFilter(value)}>
                  <SelectTrigger className="h-11 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="balance">Баланс</SelectItem>
                    <SelectItem value="pre_balance">Предбаланс</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Валюта</p>
                <Select value={currencyFilter} onValueChange={(value: CurrencyFilter) => setCurrencyFilter(value)}>
                  <SelectTrigger className="h-11 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    {ALL_CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--card-shadow)]">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <Wallet className="h-4 w-4 text-primary" />
            Итоги за период
          </div>
          {filteredSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных по выбранным фильтрам.</p>
          ) : (
            <div className="space-y-3">
              {filteredSummary.map((item) => (
                <div key={`${item.walletType}:${item.currency}`} className="rounded-xl bg-background p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-medium text-foreground">
                      {walletLabels[item.walletType]} · {item.currency}
                    </div>
                    <div className="text-sm text-muted-foreground">{CURRENCY_SYMBOLS[item.currency]}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div className="text-muted-foreground">Открытие</div>
                    <div className="text-right text-foreground">{item.opening.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-muted-foreground">Приход</div>
                    <div className="text-right text-emerald-600">+{item.inflow.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-muted-foreground">Расход</div>
                    <div className="text-right text-destructive">-{item.outflow.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-muted-foreground">Закрытие</div>
                    <div className="text-right font-medium text-foreground">{item.closing.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--card-shadow)]">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <CalendarRange className="h-4 w-4 text-primary" />
            Лента операций
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : !hasRows ? (
            <p className="text-sm text-muted-foreground">Нет движений за выбранный период.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-dashed border-border bg-background p-3">
                <div className="mb-2 text-sm font-medium text-foreground">Остаток на начало периода</div>
                {filteredOpenings.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Нет данных.</div>
                ) : (
                  <div className="space-y-1">
                    {filteredOpenings.map((item) => (
                      <div key={`${item.walletType}:${item.currency}`} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {walletLabels[item.walletType]} · {item.currency}
                        </span>
                        <span className="text-foreground">
                          {item.amount.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {CURRENCY_SYMBOLS[item.currency]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {filteredRows.map((row) => (
                <div key={row.rowKey} className="rounded-xl bg-background p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{row.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(row.eventTime), "dd.MM.yyyy HH:mm", { locale: ru })} · {sourceLabels[row.sourceType]}
                      </div>
                    </div>
                    <div className="rounded-full border border-border px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {walletLabels[row.walletType]}
                    </div>
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-sm text-muted-foreground">{row.currency}</div>
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        row.delta >= 0 ? "text-emerald-600" : "text-destructive",
                      )}
                    >
                      {row.delta >= 0 ? "+" : ""}
                      {row.delta.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {CURRENCY_SYMBOLS[row.currency]}
                    </div>
                  </div>

                  {(row.description || row.relatedCurrency || row.performedBy) && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {row.description && <div>{row.description}</div>}
                      {row.relatedCurrency && row.relatedAmount != null && (
                        <div className="flex items-center gap-1">
                          <ArrowLeftRight className="h-3 w-3" />
                          {row.relatedCurrency} {row.relatedAmount.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                      {row.performedBy && <div>Оператор: {row.performedBy}</div>}
                    </div>
                  )}

                  <div className="mt-3 border-t border-border pt-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Итого после операции</span>
                      <span className="font-medium text-foreground">
                        {row.balanceAfter.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {CURRENCY_SYMBOLS[row.currency]}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default AdminLedger;
