import { useState } from "react";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, UserCircle, Plus, Trash2, Pencil, Check, X, Eye, EyeOff } from "lucide-react";
import { ALL_CURRENCIES, CURRENCY_FLAGS, type Currency, type User } from "@/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const AdminDrivers = ({ backTo }: { backTo?: string } = {}) => {
  const queryClient = useQueryClient();
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newCurrencies, setNewCurrencies] = useState<Currency[]>([]);
  const [creating, setCreating] = useState(false);

  // Inline editing states
  const [editingField, setEditingField] = useState<"name" | "login" | "password" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingField, setSavingField] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { toast } = useToast();

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const result = await api.getDrivers();
      if (result.success && result.data) {
        return result.data.filter((d) => d.role.toLowerCase() !== "admin" && d.role.toLowerCase() !== "balance");
      }
      return [] as User[];
    },
  });

  const selectedDriver = drivers.find((d) => String(d.id) === selectedDriverId) || null;

  const handleCurrencyToggle = async (driver: User, currency: Currency, enabled: boolean) => {
    const current = driver.availableCurrencies
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const updated = enabled
      ? [...current, currency]
      : current.filter((c) => c !== currency);
    const newStr = updated.join(",");

    // Оптимистично обновляем кэш, чтобы свитч срабатывал мгновенно
    const prevDrivers = queryClient.getQueryData<User[]>(["drivers"]);
    queryClient.setQueryData<User[]>(["drivers"], (old) =>
      old
        ? old.map((d) =>
            String(d.id) === String(driver.id)
              ? { ...d, availableCurrencies: newStr }
              : d,
          )
        : old,
    );

    const result = await api.updateDriverCurrencies(driver.id, newStr);
    if (!result.success) {
      // Откат к старому состоянию при ошибке
      queryClient.setQueryData<User[]>(["drivers"], prevDrivers);
    }
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
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    } else {
      toast({ title: result.error || "Ошибка создания", variant: "destructive" });
    }
    setCreating(false);
  };

  const handleDeleteDriver = async (driver: User) => {
    const result = await api.deleteDriver(driver.id);
    if (result.success) {
      toast({ title: `${driver.name} удалён` });
      setSelectedDriverId("");
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    } else {
      toast({ title: result.error || "Ошибка удаления", variant: "destructive" });
    }
  };

  const startEdit = (field: "name" | "login" | "password", currentValue: string) => {
    setEditingField(field);
    setEditValue(field === "password" ? "" : currentValue);
    setShowPassword(false);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!selectedDriver || !editingField || !editValue.trim()) return;
    setSavingField(true);
    const result = await api.updateDriver(selectedDriver.id, { [editingField]: editValue.trim() });
    if (result.success) {
      toast({ title: "Сохранено" });
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    } else {
      toast({ title: result.error || "Ошибка сохранения", variant: "destructive" });
    }
    setSavingField(false);
    setEditingField(null);
    setEditValue("");
  };

  const activeCurrencies = selectedDriver
    ? selectedDriver.availableCurrencies.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  return (
    <PageLayout title="Водители" backTo={backTo}>
      <div className="animate-fade-in space-y-6">
        {/* Driver selector */}
        <div className="flex items-center gap-2">
          <Select
            value={selectedDriverId}
            onValueChange={setSelectedDriverId}
          >
            <SelectTrigger className="flex-1 h-12 bg-card border-border text-base">
              <SelectValue placeholder="Выберите водителя" />
            </SelectTrigger>
            <SelectContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : drivers.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">Нет водителей</div>
              ) : (
                drivers.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    <div className="flex items-center gap-2">
                      {d.photo ? (
                        <img src={d.photo} alt="" className="h-5 w-5 rounded-full object-cover" />
                      ) : (
                        <UserCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                      {d.name}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="h-12 w-12 shrink-0">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Новый водитель</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Логин" value={newLogin} onChange={(e) => setNewLogin(e.target.value)} className="bg-secondary border-border" />
                <Input placeholder="Пароль" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-secondary border-border" />
                <Input placeholder="Имя" value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-secondary border-border" />
                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Валюты</p>
                  <div className="flex flex-wrap gap-2">
                    {ALL_CURRENCIES.map((c) => {
                      const selected = newCurrencies.includes(c);
                      return (
                        <button
                          key={c}
                          onClick={() => setNewCurrencies((prev) => selected ? prev.filter((x) => x !== c) : [...prev, c])}
                          className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", selected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}
                        >
                          {CURRENCY_FLAGS[c]} {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreateDriver} disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Создать
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Selected driver settings */}
        {selectedDriver && (
          <div className="space-y-4 animate-fade-in">
            {/* Avatar & name header */}
            <div className="flex items-center gap-4">
              {selectedDriver.photo ? (
                <img src={selectedDriver.photo} alt={selectedDriver.name} className="h-16 w-16 rounded-2xl object-cover border border-border/60" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary border border-border/60">
                  <UserCircle className="h-9 w-9 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold font-display text-foreground truncate">{selectedDriver.name}</p>
                <p className="text-xs text-muted-foreground">ID: {selectedDriver.id}</p>
              </div>
            </div>

            {/* Editable fields */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-[var(--card-shadow)] divide-y divide-border/60 overflow-hidden">
              {/* Name */}
              <EditableRow
                label="Имя"
                value={selectedDriver.name}
                isEditing={editingField === "name"}
                editValue={editValue}
                saving={savingField}
                onEdit={() => startEdit("name", selectedDriver.name)}
                onCancel={cancelEdit}
                onSave={saveEdit}
                onChange={setEditValue}
              />
              {/* Login */}
              <EditableRow
                label="Логин"
                value={selectedDriver.login}
                isEditing={editingField === "login"}
                editValue={editValue}
                saving={savingField}
                onEdit={() => startEdit("login", selectedDriver.login)}
                onCancel={cancelEdit}
                onSave={saveEdit}
                onChange={setEditValue}
              />
              {/* Password */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Пароль</p>
                  {editingField === "password" ? (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="Новый пароль"
                          className="h-8 bg-secondary border-border pr-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={saveEdit} disabled={savingField || !editValue.trim()}>
                        {savingField ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground">••••••••</p>
                  )}
                </div>
                {editingField !== "password" && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary" onClick={() => startEdit("password", "")}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Currencies */}
            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Доступные валюты
              </h3>
              <div className="rounded-2xl border border-border/60 bg-card shadow-[var(--card-shadow)] divide-y divide-border/60 overflow-hidden">
                {ALL_CURRENCIES.map((c) => {
                  const enabled = activeCurrencies.includes(c);
                  return (
                    <div key={c} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-foreground">{CURRENCY_FLAGS[c]} {c}</span>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) => handleCurrencyToggle(selectedDriver, c, v)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Delete */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Удалить водителя
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
                  <AlertDialogAction onClick={() => handleDeleteDriver(selectedDriver)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Удалить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {!selectedDriver && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <UserCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Выберите водителя из списка</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

/* Reusable inline-edit row */
function EditableRow({
  label,
  value,
  isEditing,
  editValue,
  saving,
  onEdit,
  onCancel,
  onSave,
  onChange,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  editValue: string;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        {isEditing ? (
          <div className="mt-1 flex items-center gap-2">
            <Input
              value={editValue}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 flex-1 bg-secondary border-border text-sm"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && onSave()}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-success" onClick={onSave} disabled={saving || !editValue.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={onCancel}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-foreground truncate">{value}</p>
        )}
      </div>
      {!isEditing && (
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export default AdminDrivers;
