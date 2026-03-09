import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMileageGate } from "@/contexts/MileageGateContext";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import PhotoUpload from "@/components/PhotoUpload";
import OfflineBanner from "@/components/OfflineBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { startOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { vibrateSuccess } from "@/lib/utils";
import { addToQueue, type PendingMileage } from "@/services/offlineQueue";

const Mileage = () => {
  const { user } = useAuth();
  const { markSubmitted } = useMileageGate();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [km, setKm] = useState("");
  const [truck, setTruck] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [showMileageHint, setShowMileageHint] = useState(() => !localStorage.getItem("mileage-tooltip-seen"));

  const todayIso = startOfDay(new Date()).toISOString();

  const { data: trucks = [] } = useQuery({
    queryKey: ["trucks", "available", todayIso],
    queryFn: async () => {
      const result = await api.getTrucks({ excludeBusyForDate: todayIso });
      return result.success && result.data ? result.data : [];
    },
  });

  const handleSave = async () => {
    if (!user || !km || !photoUrl) return;
    setSaving(true);

    try {
      if (!navigator.onLine || photoUrl === "__offline__") {
        // Save to offline queue
        const pending: PendingMileage = {
          type: "mileage",
          id: `mil_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          driverId: user.id,
          driverName: user.name,
          driverPhoto: user.photo,
          km: Number(km),
          photoBlob: photoFile!,
          photoName: photoFile?.name || "odometer.jpg",
          truck: truck || undefined,
          date: new Date().toISOString(),
          createdAt: Date.now(),
          status: "pending",
        };
        await addToQueue(pending);
        toast({ title: "Пробег сохранён локально", description: "Отправится при появлении сети" });
        vibrateSuccess();
        markSubmitted();
        navigate("/dashboard", { replace: true });
      } else {
        const result = await api.addMileage({
          driverId: user.id,
          driverName: user.name,
          driverPhoto: user.photo,
          date: new Date().toISOString(),
          km: Number(km),
          photoUrl,
          truck: truck || undefined,
        });
        if (result.success) {
          toast({ title: "Пробег отправлен" });
          vibrateSuccess();
          markSubmitted();
          navigate("/dashboard", { replace: true });
        }
      }
    } catch {
      // Network error — save offline
      if (photoFile) {
        const pending: PendingMileage = {
          type: "mileage",
          id: `mil_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          driverId: user.id,
          driverName: user.name,
          driverPhoto: user.photo,
          km: Number(km),
          photoBlob: photoFile,
          photoName: photoFile.name,
          truck: truck || undefined,
          date: new Date().toISOString(),
          createdAt: Date.now(),
          status: "pending",
        };
        await addToQueue(pending);
        toast({ title: "Нет сети — сохранено локально" });
        vibrateSuccess();
        markSubmitted();
        navigate("/dashboard", { replace: true });
      }
    }
    setSaving(false);
  };

  const canSave = km && photoUrl && !saving;

  return (
    <PageLayout title="Отчет по пробегу">
      <OfflineBanner />
      <div className="flex flex-col items-center justify-center py-8 animate-fade-in">
        <p className="mb-6 text-center text-muted-foreground">
          Для начала работы укажите текущий пробег, тягач и загрузите фото спидометра
        </p>
        <div className="w-full max-w-sm space-y-4">
          <Select value={truck} onValueChange={setTruck}>
            <SelectTrigger className="h-12 bg-secondary">
              <SelectValue placeholder="Тягач" />
            </SelectTrigger>
            <SelectContent>
              {trucks.map((t) => (
                <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            onFileReady={(f) => setPhotoFile(f)}
          />
          {showMileageHint && (
            <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground flex items-center justify-between gap-2">
              <span>Сначала выберите тягач и укажите км</span>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-8"
                onClick={() => {
                  localStorage.setItem("mileage-tooltip-seen", "1");
                  setShowMileageHint(false);
                }}
              >
                Понятно
              </Button>
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="h-12 w-full text-base font-semibold"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Отправить"}
          </Button>
        </div>
      </div>
    </PageLayout>
  );
};

export default Mileage;
