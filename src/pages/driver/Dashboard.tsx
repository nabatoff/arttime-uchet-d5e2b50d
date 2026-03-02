import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { ALL_CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_FLAGS, type Currency } from "@/types";

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

  return (
    <PageLayout title="Мой баланс">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in">
          {activeCurrencies.length === 0 && (
            <p className="py-10 text-center text-muted-foreground">
              Нет активных валют
            </p>
          )}
          {activeCurrencies.map((currency) => (
            <Card key={currency} className="border-border bg-card">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CURRENCY_FLAGS[currency]}</span>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{currency}</p>
                    <p className="text-2xl font-bold text-foreground">
                      {balances?.[currency]?.toLocaleString("ru-RU") ?? "0"}
                      <span className="ml-1 text-base text-muted-foreground">
                        {CURRENCY_SYMBOLS[currency]}
                      </span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default Dashboard;
