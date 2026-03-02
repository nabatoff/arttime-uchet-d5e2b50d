import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { Loader2 } from "lucide-react";
import { ALL_CURRENCIES, type Currency } from "@/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const CURRENCY_LABELS: Record<Currency, string> = {
  KZT: "БАЛАНС В ТЕНГЕ:",
  RUB: "БАЛАНС В РУБЛЯХ:",
  UZS: "БАЛАНС В СУМАХ:",
  CNY: "БАЛАНС В ЮАНЯХ:",
  EUR: "БАЛАНС В ЕВРО:",
};

const Dashboard = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<Record<Currency, number> | null>(null);
  const [loading, setLoading] = useState(true);

  const activeCurrencies = user?.availableCurrencies
    ?.split(",")
    .map((c) => c.trim())
    .filter((c) => ALL_CURRENCIES.includes(c as Currency)) as Currency[] || [];

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const result = await api.getBalance(user.id);
      if (result.success && result.data) {
        setBalances(result.data);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const today = new Date();
  const dateStr = format(today, "EEEE, d MMMM yyyy 'г.'", { locale: ru });

  return (
    <PageLayout title="Мой баланс">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="animate-fade-in">
          {/* Greeting */}
          <div className="mb-6 rounded-xl bg-primary px-5 py-4">
            <h2 className="text-xl font-bold text-primary-foreground">
              Здравствуйте, {user?.name || "Водитель"}!
            </h2>
            <p className="mt-1 text-sm capitalize text-primary-foreground/80">
              Сегодня {dateStr}
            </p>
          </div>

          {/* Balance Cards */}
          <div className="space-y-3">
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
                    "w-full rounded-xl px-5 py-4 text-center",
                    isNegative
                      ? "bg-gradient-to-r from-red-600 to-red-500"
                      : "bg-gradient-to-r from-green-600 to-green-500"
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                    {CURRENCY_LABELS[currency]}
                  </p>
                  <p className="mt-1 text-3xl font-bold text-white">
                    {balance.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
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
