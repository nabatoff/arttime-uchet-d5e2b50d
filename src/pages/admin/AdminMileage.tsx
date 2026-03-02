import { useEffect, useState } from "react";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { MileageReport } from "@/types";

const AdminMileage = () => {
  const [reports, setReports] = useState<MileageReport[]>([]);
  const [loading, setLoading] = useState(true);

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
              <CardContent className="flex items-center p-0">
                {/* Left: Driver info */}
                <div className="flex flex-1 items-center gap-3 p-3">
                  {r.driverPhoto ? (
                    <img
                      src={r.driverPhoto}
                      alt={r.driverName}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-foreground">
                      {r.driverName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.driverName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(r.date), "dd MMM yyyy", { locale: ru })}
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-12 w-px bg-border" />

                {/* Right: KM */}
                <div className="flex items-center justify-center px-4">
                  <span className="text-xl font-bold text-info">
                    {r.km.toLocaleString("ru-RU")} км
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default AdminMileage;
