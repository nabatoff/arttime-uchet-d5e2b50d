import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import type { Truck } from "@/types";

interface TruckPickerProps {
  value: string;
  onChange: (value: string) => void;
  trucks: Truck[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

const TruckPicker = ({
  value,
  onChange,
  trucks,
  open,
  onOpenChange,
  error,
  placeholder = "Тягач",
  allowEmpty = false,
  emptyLabel = "— Без тягача",
}: TruckPickerProps) => {
  const sortedTrucks = [...trucks].sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return (
    <>
      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-12 w-full justify-between bg-secondary px-3 font-normal",
            !value && "text-muted-foreground",
            error && "border-destructive",
          )}
          onClick={() => onOpenChange(true)}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle>Выберите тягач</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[min(60dvh,520px)] overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="space-y-1">
              {allowEmpty && (
                <button
                  type="button"
                  className={cn(
                    "flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-base font-medium transition-colors",
                    !value ? "bg-primary/10 text-primary" : "hover:bg-secondary",
                  )}
                  onClick={() => {
                    onChange("");
                    onOpenChange(false);
                  }}
                >
                  <span className="flex-1 truncate text-muted-foreground">{emptyLabel}</span>
                  {!value && <Check className="h-5 w-5 shrink-0" />}
                </button>
              )}
              {sortedTrucks.map((truck) => {
                const selected = truck.name === value;
                return (
                  <button
                    key={truck.id}
                    type="button"
                    className={cn(
                      "flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-base font-medium transition-colors",
                      selected ? "bg-primary/10 text-primary" : "hover:bg-secondary",
                    )}
                    onClick={() => {
                      onChange(truck.name);
                      onOpenChange(false);
                    }}
                  >
                    <span className="flex-1 truncate">{truck.name}</span>
                    {selected && <Check className="h-5 w-5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default TruckPicker;
