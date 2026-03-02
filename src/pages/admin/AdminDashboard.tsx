import { useEffect, useState, useRef } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { ALL_CURRENCIES, CURRENCY_SYMBOLS, type Currency, type User } from "@/types";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const CURRENCY_LABELS: Record<Currency, string> = {
  KZT: "БАЛАНС В ТЕНГЕ:",
  RUB: "БАЛАНС В РУБЛЯХ:",
  UZS: "БАЛАНС В СУМАХ:",
  CNY: "БАЛАНС В ЮАНЯХ:",
  EUR: "БАЛАНС В ЕВРО:",
};

const AdminDashboard = () => {
  const { user: currentUser } = useAuth();
  const [drivers, setDrivers] = useState<User[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Balance adjustment
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [adjCurrency, setAdjCurrency] = useState<Currency>("KZT");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const result = await api.getDrivers();
      if (result.success && result.data) {
        // Filter out admins
        const onlyDrivers = result.data.filter(
          (d) => d.role.toLowerCase() !== "admin"
        );
        setDrivers(onlyDrivers);
      }
      setLoading(false);
    };
    load();
  }, []);

  const selectedDriver = drivers[currentIndex] || null;

  const getActiveCurrencies = (driver: User): Currency[] => {
    const available = driver.availableCurrencies
      .split(",")
      .map((c) => c.trim())
      .filter((c) => ALL_CURRENCIES.includes(c as Currency)) as Currency[];
    return available.length > 0 ? available : ALL_CURRENCIES;
  };

  const handleSwipe = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) < 50) return;
    if (diff > 0 && currentIndex < drivers.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else if (diff < 0 && currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleBalanceUpdate = async () => {
    if (!selectedDriver || !adjAmount) return;
    setAdjSaving(true);
    await api.updateBalance(selectedDriver.id, adjCurrency, Number(adjAmount));

    setDrivers((prev) =>
      prev.map((d) =>
        d.id === selectedDriver.id
          ? { ...d, balances: { ...d.balances, [adjCurrency]: Number(adjAmount) } }
          : d
      )
    );

    setAdjSaving(false);
    setBalanceDialogOpen(false);
    setAdjAmount("");
  };

  const today = new Date();
  const dateStr = format(today, "EEEE, d MMMM yyyy 'г.'", { locale: ru });

  if (loading) {
    return (
      <PageLayout title="Мой баланс">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (drivers.length === 0) {
    return (
      <PageLayout title="Мой баланс">
        <p className="py-10 text-center text-muted-foreground">Нет водителей</p>
      </PageLayout>
    );
  }

  const activeCurrencies = selectedDriver ? getActiveCurrencies(selectedDriver) : [];

  return (
    <PageLayout title="Мой баланс">
      <div
        className="animate-fade-in"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { touchEndX.current = e.changedTouches[0].clientX; handleSwipe(); }}
      >
        {/* Greeting */}
        <div className="mb-6 rounded-xl bg-primary px-5 py-4">
          <h2 className="text-xl font-bold text-primary-foreground">
            Здравствуйте, {currentUser?.name || "Админ"}!
          </h2>
          <p className="mt-1 text-sm capitalize text-primary-foreground/80">
            Сегодня {dateStr}
          </p>
        </div>

        {/* Driver selector */}
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => i - 1)}
            className="text-muted-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{selectedDriver?.name}</p>
            <p className="text-xs text-muted-foreground">
              {currentIndex + 1} / {drivers.length}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={currentIndex === drivers.length - 1}
            onClick={() => setCurrentIndex((i) => i + 1)}
            className="text-muted-foreground"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Balance Cards */}
        <div className="space-y-3">
          {activeCurrencies.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Нет доступных валют. Настройте в разделе «Настройки».
            </p>
          ) : (
            activeCurrencies.map((c) => {
              const balance = selectedDriver?.balances?.[c] ?? 0;
              const isNegative = balance < 0;
              return (
                <button
                  key={c}
                  onClick={() => {
                    setAdjCurrency(c);
                    setAdjAmount(String(balance));
                    setBalanceDialogOpen(true);
                  }}
                  className={cn(
                    "w-full rounded-xl px-5 py-4 text-center transition-transform active:scale-[0.98]",
                    isNegative
                      ? "bg-gradient-to-r from-red-600 to-red-500"
                      : "bg-gradient-to-r from-green-600 to-green-500"
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                    {CURRENCY_LABELS[c]}
                  </p>
                  <p className="mt-1 text-3xl font-bold text-white">
                    {balance.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Dots indicator */}
        {drivers.length > 1 && (
          <div className="mt-6 flex justify-center gap-1.5">
            {drivers.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === currentIndex
                    ? "w-6 bg-primary"
                    : "w-2 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Balance Adjustment Dialog */}
      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Изменить баланс — {selectedDriver?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={adjCurrency} onValueChange={(v) => setAdjCurrency(v as Currency)}>
              <SelectTrigger className="h-12 bg-secondary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeCurrencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CURRENCY_LABELS[c]} ({CURRENCY_SYMBOLS[c]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Новый баланс"
              value={adjAmount}
              onChange={(e) => setAdjAmount(e.target.value)}
              className="h-12 bg-secondary"
            />
            <Button
              onClick={handleBalanceUpdate}
              disabled={!adjAmount || adjSaving}
              className="h-12 w-full text-base font-semibold"
            >
              {adjSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default AdminDashboard;
