import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CategoryInfo, UserRole } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Сортировка категорий: сначала с sortOrder по возрастанию, затем без номера по имени. */
export function sortCategories(categories: CategoryInfo[]): CategoryInfo[] {
  return [...categories].sort((a, b) => {
    const aOrder = a.sortOrder;
    const bOrder = b.sortOrder;
    if (aOrder != null && bOrder != null) return aOrder - bOrder || a.name.localeCompare(b.name, "ru");
    if (aOrder != null) return -1;
    if (bOrder != null) return 1;
    return a.name.localeCompare(b.name, "ru");
  });
}

/** Категории, видимые для роли: admin — все, driver/balance — только both и своя роль. */
export function filterCategoriesByRole(categories: CategoryInfo[], role: UserRole): CategoryInfo[] {
  const filtered = role === "admin"
    ? categories
    : categories.filter(
      (c) => !c.visibleTo || c.visibleTo === "both" || c.visibleTo === role
    );
  return sortCategories(filtered);
}

/** Короткая вибрация при успешном действии (мобильные). */
export function vibrateSuccess() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(10);
  }
}
