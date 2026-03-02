import { useEffect, useState } from "react";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, X } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { MileageReport } from "@/types";

const AdminMileage = () => {
  const [reports, setReports] = useState<MileageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const result = await api.getMileage();
      if (result.success && result.data) {
        setReports(result.data);
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <PageLayout title="Пробег — все водители">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : reports.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Нет отчетов</p>
      ) : (
        <div className="space-y-2 animate-fade-in">
          {reports.map((r) => (
            <Card key={r.id} className="border-border bg-card overflow-hidden">
              <CardContent className="p-3">
                {/* Top row: driver + km */}
                <div className="flex items-center gap-3">
                  {r.driverPhoto ? (
                    <img
                      src={r.driverPhoto}
                      alt={r.driverName}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-foreground">
                      {r.driverName.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{r.driverName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(r.date), "dd MMM yyyy, HH:mm", { locale: ru })}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-primary shrink-0">
                    {r.km.toLocaleString("ru-RU")} км
                  </span>
                </div>

                {/* Odometer photo */}
                {r.photoUrl && (
                  <img
                    src={r.photoUrl}
                    alt="Фото спидометра"
                    onClick={() => setZoomImage(r.photoUrl)}
                    className="mt-2 h-32 w-full cursor-pointer rounded-lg border border-border object-cover"
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Zoom overlay */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage}
            alt="Фото"
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-lg"
          />
          <button
            onClick={() => setZoomImage(null)}
            className="absolute right-4 top-4 rounded-full bg-secondary p-2"
          >
            <X className="h-5 w-5 text-foreground" />
          </button>
        </div>
      )}
    </PageLayout>
  );
};

export default AdminMileage;
