/** Параметры для api.getExpenses(..., "Admin", ...) при серверной фильтрации списков. */
export function buildAdminExpenseListFilters(filterDriver: string, filterCategory: string) {
  return {
    filterUserId: filterDriver !== "all" ? filterDriver : undefined,
    filterCategory: filterCategory !== "all" ? filterCategory : undefined,
  };
}
