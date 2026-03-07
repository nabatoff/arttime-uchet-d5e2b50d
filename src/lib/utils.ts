import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CategoryInfo, UserRole } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Категории, видимые для роли: admin — все, driver/balance — только both и своя роль. */
export function filterCategoriesByRole(categories: CategoryInfo[], role: UserRole): CategoryInfo[] {
  if (role === "admin") return categories;
  return categories.filter(
    (c) => !c.visibleTo || c.visibleTo === "both" || c.visibleTo === role
  );
}

/** Короткая вибрация при успешном действии (мобильные). */
export function vibrateSuccess() {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(10);
  }
}
