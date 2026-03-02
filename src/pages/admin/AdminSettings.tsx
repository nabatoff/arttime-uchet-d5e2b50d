import { useEffect, useState } from "react";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { ALL_CURRENCIES, CURRENCY_FLAGS, type Currency, type User } from "@/types";
import { cn } from "@/lib/utils";

const AdminSettings = () => {
  const [drivers, setDrivers] = useState<User[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleCurrencyToggle = async (driver: User, currency: Currency, enabled: boolean) => {
    const current = driver.availableCurrencies
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const updated = enabled
      ? [...current, currency]
      : current.filter((c) => c !== currency);
    const newStr = updated.join(",");

    await api.updateDriverCurrencies(driver.id, newStr);

    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driver.id ? { ...d, availableCurrencies: newStr } : d
      )
    );
    if (selectedDriver?.id === driver.id) {
      setSelectedDriver({ ...driver, availableCurrencies: newStr });
    }
  };

  if (loading) {
    return (
      <PageLayout title="Настройки валют">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Настройки валют">
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
        <div className="animate-fade-in">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            Доступные валюты — {selectedDriver.name}
          </h2>
          <Card className="border-border bg-card">
            <CardContent className="divide-y divide-border p-0">
              {ALL_CURRENCIES.map((c) => {
                const enabled = selectedDriver.availableCurrencies
                  .split(",")
                  .map((x) => x.trim())
                  .includes(c);
                return (
                  <div key={c} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-foreground">
                      {CURRENCY_FLAGS[c]} {c}
                    </span>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => handleCurrencyToggle(selectedDriver, c, v)}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
};

export default AdminSettings;
