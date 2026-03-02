import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import PhotoUpload from "@/components/PhotoUpload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { MileageReport } from "@/types";

const Mileage = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<MileageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [km, setKm] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const result = await api.getMileage(user.id);
      if (result.success && result.data) {
        setReports(result.data);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user || !km || !photoUrl) return;
    setSaving(true);
    const result = await api.addMileage({
      driverId: user.id,
      driverName: user.name,
      driverPhoto: user.photo,
      date: new Date().toISOString(),
      km: Number(km),
      photoUrl,
    });
    if (result.success && result.data) {
      setReports((prev) => [result.data!, ...prev]);
    }
    setSaving(false);
    setDialogOpen(false);
    setKm("");
    setPhotoUrl("");
  };

  const canSave = km && photoUrl && !saving;

  return (
    <PageLayout title="Отчет по пробегу">
      <div className="mb-4">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2">
              <Plus className="h-4 w-4" /> Добавить отчет
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Новый отчет о пробеге</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                type="number"
                placeholder="Километраж"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                className="h-12 bg-secondary"
              />
              <PhotoUpload
                label="Фото спидометра"
                onUpload={setPhotoUrl}
              />
              <Button
                onClick={handleSave}
                disabled={!canSave}
                className="h-12 w-full text-base font-semibold"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : reports.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Нет отчетов</p>
      ) : (
        <div className="space-y-2 animate-fade-in">
          {reports.map((r) => (
            <Card key={r.id} className="border-border bg-card">
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <p className="text-lg font-bold text-foreground">{r.km.toLocaleString("ru-RU")} км</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(r.date), "dd MMM yyyy, HH:mm", { locale: ru })}
                  </p>
                </div>
                {r.photoUrl && (
                  <img
                    src={r.photoUrl}
                    alt="Спидометр"
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default Mileage;
