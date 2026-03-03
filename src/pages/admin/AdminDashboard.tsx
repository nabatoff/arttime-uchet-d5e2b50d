import { useState, useRef } from "react";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_CURRENCIES, type Currency, type User } from "@/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { useStaggerIn, useFadeIn } from "@/hooks/useGsap";
import gsap from "gsap";

const CURRENCY_LABELS: Record<Currency, string> = {
  KZT: "Тенге",
  RUB: "Рубли",
  UZS: "Сумы",
  CNY: "Юани",
  EUR: "Евро",
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  KZT: "₸",
  RUB: "₽",
  UZS: "сўм",
  CNY: "¥",
  EUR: "€",
};

const AdminDashboard = () => {
  const { user: currentUser } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const greetingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const result = await api.getDrivers();
      if (result.success && result.data) {
        return result.data.filter((d) => d.role.toLowerCase() !== "admin");
      }
      return [] as User[];
    },
  });

  useFadeIn(greetingRef, 0, [drivers.length]);
  useStaggerIn(cardsRef, ":scope > div", [currentIndex, drivers.length]);

  const selectedDriver = drivers[currentIndex] || null;

  const getActiveCurrencies = (driver: User): Currency[] => {
    const available = driver.availableCurrencies
      .split(",")
      .map((c) => c.trim())
      .filter((c) => ALL_CURRENCIES.includes(c as Currency)) as Currency[];
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
      },
    });
  };

  const handleSwipe = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) < 50) return;
    if (diff > 0 && currentIndex < drivers.length - 1) {
      switchDriver(currentIndex + 1);
    } else if (diff < 0 && currentIndex > 0) {
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
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { touchEndX.current = e.changedTouches[0].clientX; handleSwipe(); }}
      >
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
            onValueChange={(val) => switchDriver(Number(val))}
          >
            <SelectTrigger className="w-auto min-w-[140px] border-none bg-transparent shadow-none text-center font-bold text-foreground text-lg gap-1 justify-center">
              <SelectValue>{selectedDriver?.name}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {drivers.map((d, i) => (
                <SelectItem key={d.id || i} value={String(i)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" disabled={currentIndex === drivers.length - 1} onClick={() => switchDriver(currentIndex + 1)} className="text-muted-foreground shrink-0">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div ref={cardsRef} className="space-y-3">
          {activeCurrencies.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Нет доступных валют. Настройте в разделе «Настройки».
            </p>
          ) : (
            activeCurrencies.map((c) => {
              const balance = selectedDriver?.balances?.[c] ?? 0;
              const isNegative = balance < 0;
              return (
                <div key={c} className={cn("card-elevated rounded-2xl px-5 py-5", isNegative && "border-destructive/30")}>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{CURRENCY_LABELS[c]}</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className={cn(
                      "text-3xl font-bold font-display",
                      balance === 0 ? "text-muted-foreground" : isNegative ? "text-destructive" : "text-success"
                    )}>
                      {balance.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className="text-sm text-muted-foreground">{CURRENCY_SYMBOLS[c]}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {drivers.length > 1 && (
          <div className="mt-6 flex justify-center gap-1.5">
            {drivers.map((_, i) => (
              <button
                key={i}
                onClick={() => switchDriver(i)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === currentIndex ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default AdminDashboard;
