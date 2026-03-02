import { useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { Loader2 } from "lucide-react";
import { ALL_CURRENCIES, type Currency } from "@/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { useStaggerIn, useFadeIn } from "@/hooks/useGsap";

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

const Dashboard = () => {
  const { user } = useAuth();
  const greetingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  const activeCurrencies = user?.availableCurrencies
    ?.split(",")
    .map((c) => c.trim())
    .filter((c) => ALL_CURRENCIES.includes(c as Currency)) as Currency[] || [];

  const { data: balances, isLoading } = useQuery({
    queryKey: ["balance", user?.id],
    queryFn: async () => {
      const result = await api.getBalance(user!.id);
      if (result.success && result.data) return result.data;
      return {} as Record<Currency, number>;
    },
    enabled: !!user,
  });

  useFadeIn(greetingRef, 0, [!!balances]);
  useStaggerIn(cardsRef, ":scope > div", [!!balances]);

  const today = new Date();
  const dateStr = format(today, "d MMMM, EEEE", { locale: ru });

  return (
    <PageLayout title="Мой баланс">
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div>
          <div ref={greetingRef} className="mb-6" style={{ opacity: 0 }}>
            <p className="text-xs text-muted-foreground capitalize">{dateStr}</p>
            <h2 className="text-xl font-bold text-foreground font-display">
              Привет, {user?.name?.split(" ")[0] || "Водитель"} 👋
            </h2>
          </div>

          <div ref={cardsRef} className="space-y-3">
            {activeCurrencies.length === 0 && (
              <p className="py-10 text-center text-muted-foreground">
                Нет активных валют
              </p>
            )}
            {activeCurrencies.map((currency) => {
              const balance = balances?.[currency] ?? 0;
              const isNegative = balance < 0;
              return (
                <div
                  key={currency}
                  className={cn(
                    "card-elevated rounded-2xl px-5 py-5",
                    isNegative && "border-destructive/30"
                  )}
                  style={{ opacity: 0 }}
                >
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {CURRENCY_LABELS[currency]}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className={cn(
                      "text-3xl font-bold font-display",
                      balance === 0 ? "text-muted-foreground" : isNegative ? "text-destructive" : "text-success"
                    )}>
                      {balance.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className="text-sm text-muted-foreground">{CURRENCY_SYMBOLS[currency]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default Dashboard;
