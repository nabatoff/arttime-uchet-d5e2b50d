import { useEffect, useState } from "react";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, UserCircle } from "lucide-react";
import type { User } from "@/types";

const AdminDrivers = () => {
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const result = await api.getDrivers();
      if (result.success && result.data) {
        setDrivers(result.data);
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <PageLayout title="Водители">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2 animate-fade-in">
          {drivers.map((d) => (
            <Card key={d.id} className="border-border bg-card">
              <CardContent className="flex items-center gap-3 p-3">
                {d.photo ? (
                  <img src={d.photo} alt={d.name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                    <UserCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Валюты: {d.availableCurrencies || "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
};

export default AdminDrivers;
