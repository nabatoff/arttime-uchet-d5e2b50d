/** Режим «все записи / без пополнений / только пополнения» при категории «все». */
export type FilterExpenseKind = "all" | "expenses" | "topups";

/** Параметры для api.getExpenses(..., "Admin", ...) при серверной фильтрации списков. */
export function buildAdminExpenseListFilters(
  filterDriver: string,
  filterCategory: string,
  filterExpenseKind: FilterExpenseKind = "all",
) {
  const filterUserId = filterDriver !== "all" ? filterDriver : undefined;
  const filterCategoryParam = filterCategory !== "all" ? filterCategory : undefined;

  let expenseKind: "exclude_topup" | "only_topup" | undefined;
  if (!filterCategoryParam) {
    if (filterExpenseKind === "expenses") expenseKind = "exclude_topup";
    else if (filterExpenseKind === "topups") expenseKind = "only_topup";
  }

  return {
    filterUserId,
    filterCategory: filterCategoryParam,
    expenseKind,
  };
}
