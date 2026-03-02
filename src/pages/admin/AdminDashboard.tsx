import { useEffect, useState } from "react";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronRight } from "lucide-react";
import { ALL_CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_FLAGS, type Currency, type User } from "@/types";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AdminDashboard = () => {
  const [drivers, setDrivers] = useState<User[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Balance adjustment
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [adjCurrency, setAdjCurrency] = useState<Currency>("KZT");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const result = await api.getDrivers();
      if (result.success && result.data) {
        setDrivers(result.data);
        if (result.data.length > 0) setSelectedDriver(result.data[0]);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Get active currencies for the selected driver
  const getActiveCurrencies = (driver: User): Currency[] => {
    const available = driver.availableCurrencies
      .split(",")
      .map((c) => c.trim())
      .filter((c) => ALL_CURRENCIES.includes(c as Currency)) as Currency[];
    return available.length > 0 ? available : ALL_CURRENCIES;
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
    setSelectedDriver({
      ...selectedDriver,
      balances: { ...selectedDriver.balances, [adjCurrency]: Number(adjAmount) },
    });

    setAdjSaving(false);
    setBalanceDialogOpen(false);
    setAdjAmount("");
  };

  if (loading) {
    return (
      <PageLayout title="Панель управления">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  const activeCurrencies = selectedDriver ? getActiveCurrencies(selectedDriver) : [];

  return (
    <PageLayout title="Панель управления">
      {/* Driver Carousel */}
      <div className="mb-6 -mx-4 px-4">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {drivers.map((driver) => (
            <button
              key={driver.id}
              onClick={() => setSelectedDriver(driver)}
              className={cn(
                "flex flex-shrink-0 flex-col items-center gap-1 rounded-xl px-4 py-3 transition-colors",
                selectedDriver?.id === driver.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground"
              )}
            >
              {driver.photo ? (
                <img src={driver.photo} alt={driver.name} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold">
                  {driver.name.charAt(0)}
                </div>
              )}
              <span className="max-w-[80px] truncate text-xs font-medium">
                {driver.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedDriver && (
        <div className="space-y-4 animate-fade-in">
          {/* Balances — only active currencies */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">Балансы</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBalanceDialogOpen(true)}
                className="text-xs text-primary"
              >
                Изменить <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
            {activeCurrencies.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Нет доступных валют. Настройте в разделе «Настройки».
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {activeCurrencies.map((c) => (
                  <Card key={c} className="border-border bg-card">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">{CURRENCY_FLAGS[c]} {c}</p>
                      <p className="text-lg font-bold text-foreground">
                        {selectedDriver.balances?.[c]?.toLocaleString("ru-RU") ?? "0"}
                        <span className="ml-1 text-xs text-muted-foreground">{CURRENCY_SYMBOLS[c]}</span>
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
                    {CURRENCY_FLAGS[c]} {c} ({CURRENCY_SYMBOLS[c]})
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
