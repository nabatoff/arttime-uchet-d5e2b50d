import { useState, useMemo, useRef } from "react";
import { api } from "@/services/api";
import PageLayout from "@/components/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, X, CalendarIcon, Pencil, Trash2 } from "lucide-react";
import { format, isAfter, isBefore, startOfDay, endOfDay, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import { cn, vibrateSuccess } from "@/lib/utils";
import type { MileageReport, User } from "@/types";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useScrollReveal } from "@/hooks/useGsap";
import { MileageListSkeleton } from "@/components/MileageCardSkeleton";
import { useToast } from "@/hooks/use-toast";

const AdminMileage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useScrollReveal(listRef);
  const defaultDateTo = endOfDay(new Date());
  const defaultDateFrom = startOfDay(subDays(new Date(), 30));
  const [selectedDriver, setSelectedDriver] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => defaultDateFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(() => defaultDateTo);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editReport, setEditReport] = useState<MileageReport | null>(null);
  const [editKm, setEditKm] = useState("");
  const [editTruck, setEditTruck] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MileageReport | null>(null);

  const since = dateFrom ? startOfDay(dateFrom).toISOString() : undefined;
  const until = dateTo ? endOfDay(dateTo).toISOString() : undefined;

  const {
    data: reportsData,
    isLoading: loadingReports,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["mileage", since ?? "", until ?? ""],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await api.getMileage(undefined, {
        since,
        until,
        limit: 50,
        offset: pageParam as number,
      });
      return result.success && result.data ? result.data : ([] as MileageReport[]);
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= 50 ? allPages.length * 50 : undefined,
    initialPageParam: 0,
  });

  const reports = useMemo(() => reportsData?.pages.flat() ?? [], [reportsData]);

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: async () => {
      const result = await api.getDrivers();
      return result.success && result.data ? result.data : [] as User[];
    },
  });

  const { data: trucks = [] } = useQuery({
    queryKey: ["trucks"],
    queryFn: async () => {
      const result = await api.getTrucks();
      return result.success && result.data ? result.data : [];
    },
  });

  const drivers = useMemo(() => allUsers.filter((d) => d.role === "driver"), [allUsers]);

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

  const openEdit = (r: MileageReport) => {
    setEditReport(r);
    setEditKm(String(r.km));
    setEditTruck(r.truck ?? "");
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editReport) return;
    setSaving(true);
    const result = await api.updateMileage({
      id: editReport.id,
      km: Number(editKm),
      truck: editTruck || undefined,
    });
    if (result.success) {
      toast({ title: "Пробег обновлён" });
      vibrateSuccess();
      queryClient.invalidateQueries({ queryKey: ["mileage"] });
    } else {
      toast({ title: result.error || "Ошибка", variant: "destructive" });
    }
    setSaving(false);
    setEditOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    const result = await api.deleteMileage(deleteTarget.id);
    if (result.success) {
      toast({ title: "Запись удалена" });
      vibrateSuccess();
      queryClient.invalidateQueries({ queryKey: ["mileage"] });
    } else {
      toast({ title: result.error || "Ошибка", variant: "destructive" });
    }
    setSaving(false);
    setDeleteTarget(null);
  };

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
        <MileageListSkeleton count={6} />
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
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(r.date), "dd MMM yyyy, HH:mm", { locale: ru })}
                      {r.truck && ` · ${r.truck}`}
                    </p>
                  </div>
                  <span className="text-lg font-bold text-primary shrink-0">{r.km.toLocaleString("ru-RU")} км</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteTarget(r)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loadingReports && hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="gap-2">
            {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Подгрузить ещё
          </Button>
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

      {/* Edit mileage dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Редактировать пробег</DialogTitle>
          </DialogHeader>
          {editReport && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {editReport.driverName} · {format(new Date(editReport.date), "dd MMM yyyy, HH:mm", { locale: ru })}
              </p>
              <Input
                placeholder="Километраж"
                type="number"
                value={editKm}
                onChange={(e) => setEditKm(e.target.value)}
                className="bg-secondary border-border"
              />
              <Select value={editTruck || "__none__"} onValueChange={(v) => setEditTruck(v === "__none__" ? "" : v)}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Тягач" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Без тягача</SelectItem>
                  {trucks.map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={handleEditSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Сохранить
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete mileage confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Удалить запись о пробеге?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `${deleteTarget.driverName} — ${deleteTarget.km.toLocaleString("ru-RU")} км`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default AdminMileage;
