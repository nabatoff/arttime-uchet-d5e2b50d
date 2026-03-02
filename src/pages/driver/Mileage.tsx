import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMileageGate } from "@/contexts/MileageGateContext";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import PhotoUpload from "@/components/PhotoUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Mileage = () => {
  const { user } = useAuth();
  const { markSubmitted } = useMileageGate();
  const navigate = useNavigate();
  const [km, setKm] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);

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
    if (result.success) {
      markSubmitted();
      navigate("/dashboard", { replace: true });
    }
    setSaving(false);
  };

  const canSave = km && photoUrl && !saving;

  return (
    <PageLayout title="Отчет по пробегу">
      <div className="flex flex-col items-center justify-center py-8 animate-fade-in">
        <p className="mb-6 text-center text-muted-foreground">
          Для начала работы укажите текущий пробег и загрузите фото спидометра
        </p>
        <div className="w-full max-w-sm space-y-4">
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Отправить"}
          </Button>
        </div>
      </div>
    </PageLayout>
  );
};

export default Mileage;
