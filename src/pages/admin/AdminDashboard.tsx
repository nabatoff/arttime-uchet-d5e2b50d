import { useState, useRef, useMemo } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ALL_CURRENCIES, type Currency, type User } from "@/types";
import { cn, vibrateSuccess } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStaggerIn, useFadeIn } from "@/hooks/useGsap";
import { useToast } from "@/hooks/use-toast";
import gsap from "gsap";

const CURRENCY_LABELS: Record<Currency, string> = {
  KZT: "Тенге",
  RUB: "Рубли",
  UZS: "Сумы",
  CNY: "Юани",
  EUR: "Евро"
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  KZT: "₸",
  RUB: "₽",
  UZS: "сўм",
  CNY: "¥",
  EUR: "€"
};

const AdminDashboard = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const greetingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  // Balance adjustment state
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<"balance" | "preBalance">("balance");
  const [adjustCurrency, setAdjustCurrency] = useState<Currency>("KZT");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustSaving, setAdjustSaving] = useState(false);

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ["allUsers"],
    queryFn: async () => {
      const result = await api.getDrivers();
      return result.success && result.data ? result.data : [] as User[];
    }
  });

  // Для админского дашборда показываем как водителей, так и пользователей с ролью balance.
  const drivers = useMemo(
    () =>
    allUsers.filter((d) => {
      const role = (d.role || "driver").toString().toLowerCase();
      return role === "driver" || role === "balance";
    }),
    [allUsers]
  );

  useFadeIn(greetingRef, 0, [drivers.length]);
  useStaggerIn(cardsRef, ":scope > div", [currentIndex, drivers.length]);

  const selectedDriver = drivers[currentIndex] || null;

  const getActiveCurrencies = (driver: User): Currency[] => {
    const available = driver.availableCurrencies.
    split(",").
    map((c) => c.trim()).
    filter((c) => ALL_CURRENCIES.includes(c as Currency)) as Currency[];
    return available.length > 0 ? available : ALL_CURRENCIES;
  };

  const switchDriver = (newIndex: number) => {
    if (!cardsRef.current) {
      setCurrentIndex(newIndex);
      return;
    }
    const dir = newIndex > currentIndex ? 1 : -1;
    gsap.to(cardsRef.current, {
      opacity: 0,
      x: -30 * dir,
      duration: 0.15,
      ease: "power2.in",
      onComplete: () => {
        setCurrentIndex(newIndex);
        gsap.fromTo(
          cardsRef.current,
          { opacity: 0, x: 30 * dir },
          { opacity: 1, x: 0, duration: 0.25, ease: "power2.out" }
        );
      }
    });
  };

  const handleSwipe = () => {
    const diffX = touchStartX.current - touchEndX.current;
    const diffY = touchStartY.current - touchEndY.current;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);
    if (absX < 50) return;
    if (absY > absX) return;
    if (typeof window !== "undefined" && window.scrollY > 80) return;
    if (diffX > 0 && currentIndex < drivers.length - 1) {
      switchDriver(currentIndex + 1);
    } else if (diffX < 0 && currentIndex > 0) {
      switchDriver(currentIndex - 1);
    }
  };

  const today = new Date();
  const dateStr = format(today, "d MMMM, EEEE", { locale: ru });

  if (isLoading) {
    return (
      <PageLayout title="Мой баланс">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PageLayout>);

  }

  if (drivers.length === 0) {
    return (
      <PageLayout title="Мой баланс">
        <p className="py-10 text-center text-muted-foreground">Нет водителей</p>
      </PageLayout>);

  }

  const activeCurrencies = selectedDriver ? getActiveCurrencies(selectedDriver) : [];

  const parseNum = (v: string) => Number(v.replace(",", "."));

  const openAdjust = (type: "balance" | "preBalance", currency: Currency) => {
    setAdjustType(type);
    setAdjustCurrency(currency);
    const current = type === "balance" ?
    selectedDriver?.balances?.[currency] ?? 0 :
    selectedDriver?.preBalances?.[currency] ?? 0;
    setAdjustAmount(String(current));
    setAdjustOpen(true);
  };

  const handleAdjustSave = async () => {
    if (!selectedDriver) return;
    setAdjustSaving(true);
    const newAmount = parseNum(adjustAmount);
    const result = adjustType === "balance" ?
    await api.updateBalance(selectedDriver.id, adjustCurrency, newAmount) :
    await api.updatePreBalance(selectedDriver.id, adjustCurrency, newAmount);
    if (result.success) {
      toast({ title: "Баланс обновлён" });
      vibrateSuccess();
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
    } else {
      toast({ title: result.error || "Ошибка", variant: "destructive" });
    }
    setAdjustSaving(false);
    setAdjustOpen(false);
  };

  return (
    <PageLayout title="Мой баланс">
      <div
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          touchEndX.current = e.changedTouches[0].clientX;
          touchEndY.current = e.changedTouches[0].clientY;
          handleSwipe();
        }}>
        
        <div ref={greetingRef} className="mb-6">
          <p className="text-xs text-muted-foreground capitalize">{dateStr}</p>
          <h2 className="text-xl font-bold text-foreground font-display">
            Привет, {currentUser?.name?.split(" ")[0] || "Админ"} 👋
          </h2>
        </div>

        <div className="mb-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" disabled={currentIndex === 0} onClick={() => switchDriver(currentIndex - 1)} className="text-muted-foreground shrink-0">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Select
            value={String(currentIndex)}
            onValueChange={(val) => switchDriver(Number(val))}>
            
            <SelectTrigger className="w-auto min-w-[140px] border-none bg-transparent shadow-none text-center font-bold text-foreground text-lg gap-1 justify-center">
              <SelectValue>{selectedDriver?.name}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {drivers.map((d, i) =>
              <SelectItem key={d.id || i} value={String(i)}>
                  {d.name}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" disabled={currentIndex === drivers.length - 1} onClick={() => switchDriver(currentIndex + 1)} className="text-muted-foreground shrink-0">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Main Balance */}
        <div className="mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Основной баланс
          </h3>
        </div>
        <div ref={cardsRef} className="space-y-3">
          {activeCurrencies.length === 0 ?
          <p className="py-4 text-center text-sm text-muted-foreground">
              Нет доступных валют. Настройте в разделе «Настройки».
            </p> :

          activeCurrencies.map((c) => {
            const balance = selectedDriver?.balances?.[c] ?? 0;
            const isNegative = balance < 0;
            return (
              <div key={c} className={cn("card-elevated rounded-2xl px-5 py-5", isNegative && "border-destructive/30")}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{CURRENCY_LABELS[c]}</p>
                    <button onClick={() => openAdjust("balance", c)} className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className={cn(
                    "text-3xl font-bold font-display",
                    balance === 0 ? "text-muted-foreground" : isNegative ? "text-destructive" : "text-success"
                  )}>
                      {balance.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className="text-sm text-muted-foreground">{CURRENCY_SYMBOLS[c]}</span>
                  </div>
                </div>);

          })
          }
        </div>

        {/* Pre-Balance */}
        {activeCurrencies.length > 0 &&
        <>
            <div className="mt-6 mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Предварительный баланс.
              </h3>
            </div>
            <div className="space-y-3">
              {activeCurrencies.map((c) => {
              const preBalance = selectedDriver?.preBalances?.[c] ?? 0;
              return (
                <div key={`pre-${c}`} className="card-elevated rounded-2xl px-5 py-5 border-dashed border-primary/20">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{CURRENCY_LABELS[c]} (пред.)</p>
                      <button onClick={() => openAdjust("preBalance", c)} className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <p className={cn(
                      "text-3xl font-bold font-display",
                      preBalance === 0 ? "text-muted-foreground" : "text-primary"
                    )}>
                        {preBalance.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className="text-sm text-muted-foreground">{CURRENCY_SYMBOLS[c]}</span>
                    </div>
                  </div>);

            })}
            </div>
          </>
        }

        {drivers.length > 1 &&
        <div className="mt-6 flex justify-center gap-1.5">
            {drivers.map((_, i) =>
          <button
            key={i}
            onClick={() => switchDriver(i)}
            className={cn(
              "h-2 rounded-full transition-all",
              i === currentIndex ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
            )} />

          )}
          </div>
        }
      </div>

      {/* Balance adjustment dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Корректировка {adjustType === "balance" ? "баланса" : "предбаланса"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {selectedDriver?.name} · {adjustCurrency}
            </p>
            <Input
              placeholder="Новая сумма"
              type="text"
              inputMode="decimal"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value.replace(",", "."))}
              className="bg-secondary border-border" />
            
            <p className="text-xs text-muted-foreground">
              Укажите итоговое значение баланса. Изменение применится сразу.
            </p>
            <Button className="w-full" onClick={handleAdjustSave} disabled={adjustSaving}>
              {adjustSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>);

};

export default AdminDashboard;