import { useEffect, useState } from "react";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, UserCircle, Plus, ChevronRight, ArrowLeft, Trash2 } from "lucide-react";
import { ALL_CURRENCIES, CURRENCY_FLAGS, type Currency, type User } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const AdminDrivers = () => {
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<User | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newCurrencies, setNewCurrencies] = useState<Currency[]>([]);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const loadDrivers = async () => {
    const result = await api.getDrivers();
    if (result.success && result.data) {
      const onlyDrivers = result.data.filter(d => d.role.toLowerCase() !== "admin");
      setDrivers(onlyDrivers);
      // Update selected driver if it exists
      if (selectedDriver) {
        const updated = onlyDrivers.find(d => d.id === selectedDriver.id);
        if (updated) setSelectedDriver(updated);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDrivers();
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
    setSelectedDriver((prev) =>
      prev?.id === driver.id ? { ...prev, availableCurrencies: newStr } : prev
    );
  };

  const handleCreateDriver = async () => {
    if (!newLogin.trim() || !newPassword.trim() || !newName.trim()) {
      toast({ title: "Заполните все поля", variant: "destructive" });
      return;
    }
    setCreating(true);
    const result = await api.createDriver({
      login: newLogin.trim(),
      password: newPassword.trim(),
      name: newName.trim(),
      currencies: newCurrencies.join(","),
    });
    if (result.success) {
      toast({ title: "Водитель создан" });
      setCreateOpen(false);
      setNewLogin("");
      setNewPassword("");
      setNewName("");
      setNewCurrencies([]);
      await loadDrivers();
    } else {
      toast({ title: result.error || "Ошибка создания", variant: "destructive" });
    }
    setCreating(false);
  };

  const handleDeleteDriver = async (driver: User) => {
    const result = await api.deleteDriver(driver.id);
    if (result.success) {
      toast({ title: `${driver.name} удалён` });
      setDrivers((prev) => prev.filter((d) => d.id !== driver.id));
      if (selectedDriver?.id === driver.id) setSelectedDriver(null);
    } else {
      toast({ title: result.error || "Ошибка удаления", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <PageLayout title="Водители">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  // Detail view for selected driver
  if (selectedDriver) {
    const activeCurrencies = selectedDriver.availableCurrencies
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    return (
      <PageLayout title="Водители">
        <div className="animate-fade-in">
          <button
            onClick={() => setSelectedDriver(null)}
            className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </button>

          <div className="mb-6 flex items-center gap-3">
            {selectedDriver.photo ? (
              <img src={selectedDriver.photo} alt={selectedDriver.name} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                <UserCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="text-lg font-bold text-foreground">{selectedDriver.name}</p>
              <p className="text-xs text-muted-foreground">
                Логин: {selectedDriver.login}
              </p>
            </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon" className="h-8 w-8 shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">Удалить водителя?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {selectedDriver.name} будет удалён. Его отчёты и расходы сохранятся.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDeleteDriver(selectedDriver)}>
                    Удалить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
            Доступные валюты
          </h3>
          <Card className="border-border bg-card">
            <CardContent className="divide-y divide-border p-0">
              {ALL_CURRENCIES.map((c) => {
                const enabled = activeCurrencies.includes(c);
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
      </PageLayout>
    );
  }

  // Driver list view
  return (
    <PageLayout title="Водители">
      <div className="space-y-2 animate-fade-in">
        {drivers.map((d) => (
          <Card
            key={d.id}
            className="border-border bg-card cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setSelectedDriver(d)}
          >
            <CardContent className="flex items-center gap-3 p-3">
              {d.photo ? (
                <img src={d.photo} alt={d.name} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  <UserCircle className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  Валюты: {d.availableCurrencies || "—"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}

        {drivers.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">Нет водителей</p>
        )}
      </div>

      {/* Create driver button */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button className="mt-4 w-full gap-2">
            <Plus className="h-4 w-4" />
            Добавить водителя
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Новый водитель</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Логин"
              value={newLogin}
              onChange={(e) => setNewLogin(e.target.value)}
              className="bg-secondary border-border"
            />
            <Input
              placeholder="Пароль"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-secondary border-border"
            />
            <Input
              placeholder="Имя"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-secondary border-border"
            />
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Валюты</p>
              <div className="flex flex-wrap gap-2">
                {ALL_CURRENCIES.map((c) => {
                  const selected = newCurrencies.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() =>
                        setNewCurrencies((prev) =>
                          selected ? prev.filter((x) => x !== c) : [...prev, c]
                        )
                      }
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {CURRENCY_FLAGS[c]} {c}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleCreateDriver}
              disabled={creating}
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default AdminDrivers;
