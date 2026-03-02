import { useState, useMemo, useRef } from "react";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, X, CalendarIcon } from "lucide-react";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { MileageReport, User } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { useScrollReveal } from "@/hooks/useGsap";

const AdminMileage = () => {
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useScrollReveal(listRef);
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ["mileage"],
    queryFn: async () => {
      const result = await api.getMileage();
      return result.success && result.data ? result.data : [] as MileageReport[];
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const result = await api.getDrivers();
      return result.success && result.data ? result.data.filter((d) => d.role === "driver") : [] as User[];
    },
  });

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (selectedDriver !== "all" && r.driverId !== selectedDriver) return false;
      const d = new Date(r.date);
      if (dateFrom && isBefore(d, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(d, endOfDay(dateTo))) return false;
      return true;
    });
  }, [reports, selectedDriver, dateFrom, dateTo]);

  const hasFilters = selectedDriver !== "all" || dateFrom || dateTo;

  return (
    <PageLayout title="Пробег — все водители">
      {/* Filters */}
      <div className="mb-3 space-y-2">
        <Select value={selectedDriver} onValueChange={setSelectedDriver}>
          <SelectTrigger className="h-10 bg-secondary">
            <SelectValue placeholder="Все водители" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все водители</SelectItem>
            {drivers.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-10 flex-1 justify-start text-left text-sm bg-secondary", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd.MM.yy") : "От"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-10 flex-1 justify-start text-left text-sm bg-secondary", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd.MM.yy") : "До"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setSelectedDriver("all"); setDateFrom(undefined); setDateTo(undefined); }}>
            Сбросить фильтры
          </Button>
        )}
      </div>

      {loadingReports ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Нет отчетов</p>
      ) : (
        <div ref={listRef} className="space-y-2">
          {filtered.map((r) => (
            <Card key={r.id} className="border-border bg-card overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {r.photoUrl ? (
                    <img src={r.photoUrl} alt="Спидометр" onClick={() => setZoomImage(r.photoUrl)} className="h-10 w-10 shrink-0 cursor-pointer rounded border border-border object-cover transition-opacity hover:opacity-80" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-secondary text-xs text-muted-foreground">—</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{r.driverName}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(r.date), "dd MMM yyyy, HH:mm", { locale: ru })}</p>
                  </div>
                  <span className="text-lg font-bold text-primary shrink-0">{r.km.toLocaleString("ru-RU")} км</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {zoomImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setZoomImage(null)}>
          <img src={zoomImage} alt="Фото" className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-lg" />
          <button onClick={() => setZoomImage(null)} className="absolute right-4 top-4 rounded-full bg-secondary p-2">
            <X className="h-5 w-5 text-foreground" />
          </button>
        </div>
      )}
    </PageLayout>
  );
};

export default AdminMileage;
