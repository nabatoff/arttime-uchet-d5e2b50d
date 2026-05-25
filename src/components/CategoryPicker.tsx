import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import type { CategoryInfo } from "@/types";

interface CategoryPickerProps {
  value: string;
  onChange: (value: string) => void;
  categories: CategoryInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error?: string;
  placeholder?: string;
}

const CategoryPicker = ({
  value,
  onChange,
  categories,
  open,
  onOpenChange,
  error,
  placeholder = "Категория",
}: CategoryPickerProps) => {
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
            <DrawerTitle>Выберите категорию</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[min(60dvh,520px)] overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="space-y-1">
              {categories.map((cat) => {
                const selected = cat.name === value;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    className={cn(
                      "flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-base font-medium transition-colors",
                      selected ? "bg-primary/10 text-primary" : "hover:bg-secondary",
                    )}
                    onClick={() => {
                      onChange(cat.name);
                      onOpenChange(false);
                    }}
                  >
                    {cat.sortOrder != null && (
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-primary/10 px-2 text-xs font-semibold text-primary">
                        {cat.sortOrder}
                      </span>
                    )}
                    <span className="flex-1 truncate">{cat.name}</span>
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

export default CategoryPicker;
