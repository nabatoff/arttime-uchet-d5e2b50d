import { useState } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_FLAGS, type Currency, type User, type TransferRecord } from "@/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const BalanceTransfers = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [fromDriverId, setFromDriverId] = useState("");
  const [toDriverId, setToDriverId] = useState("");
  const [currency, setCurrency] = useState<Currency>("KZT");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: drivers = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const result = await api.getDrivers();
      if (result.success && result.data) {
        return result.data.filter((d) => d.role.toLowerCase() === "driver");
      }
      return [] as User[];
    },
  });

  const { data: transfers = [], isLoading: loadingTransfers } = useQuery({
    queryKey: ["transfers"],
    queryFn: async () => {
      const result = await api.getTransfers();
      return result.success && result.data ? result.data : [] as TransferRecord[];
    },
  });

  const fromDriver = drivers.find((d) => String(d.id) === fromDriverId);
  const availablePreBalance = fromDriver?.preBalances?.[currency] ?? 0;

  const getDriverName = (id: string) => {
    const d = drivers.find((dr) => String(dr.id) === String(id));
    return d?.name || id;
  };

  const handleTransfer = async () => {
    if (!fromDriverId || !toDriverId || !amount || Number(amount) <= 0) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }
    if (Number(amount) > availablePreBalance) {
      toast({ title: "Недостаточно средств на предбалансе", variant: "destructive" });
      return;
    }

    setSaving(true);
    const result = await api.transfer(fromDriverId, toDriverId, currency, Number(amount), user?.id || "");
    if (result.success) {
      toast({ title: "Перевод выполнен" });
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
    } else {
      toast({ title: result.error || "Ошибка перевода", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <PageLayout title="Переводы">
      <div className="space-y-6 animate-fade-in">
        {/* Transfer form */}
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--card-shadow)] space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Новый перевод</h3>

          {/* From driver (pre-balance source) */}
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

          {/* To driver (main balance target) */}
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

          {/* Currency */}
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

          {/* Available pre-balance */}
          {fromDriverId && (
            <p className="text-xs text-muted-foreground">
              Доступно на предбалансе: <span className="font-bold text-primary">{availablePreBalance.toLocaleString("ru-RU", { minimumFractionDigits: 2 })} {CURRENCY_SYMBOLS[currency]}</span>
            </p>
          )}

          {/* Amount */}
          <Input
            placeholder="Сумма"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-secondary border-border"
          />

          <Button className="w-full gap-2" onClick={handleTransfer} disabled={saving || !fromDriverId || !toDriverId || !amount}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Перевести
          </Button>
        </div>

        {/* Transfer history */}
        <div>
          <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            История переводов
          </h3>
          {loadingTransfers || loadingDrivers ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
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
                      {Number(t.amount).toLocaleString("ru-RU")} {CURRENCY_SYMBOLS[t.currency]}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(t.date), "dd MMM, HH:mm", { locale: ru })}
                    </span>
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

export default BalanceTransfers;
