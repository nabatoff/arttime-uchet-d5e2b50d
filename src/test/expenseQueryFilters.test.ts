import { describe, it, expect } from "vitest";
import { buildAdminExpenseListFilters } from "@/lib/expenseQueryFilters";

describe("buildAdminExpenseListFilters", () => {
  it("returns undefined filters when all", () => {
    expect(buildAdminExpenseListFilters("all", "all")).toEqual({
      filterUserId: undefined,
      filterCategory: undefined,
      expenseKind: undefined,
    });
  });

  it("passes driver id when set", () => {
    expect(buildAdminExpenseListFilters("user-uuid", "all")).toEqual({
      filterUserId: "user-uuid",
      filterCategory: undefined,
      expenseKind: undefined,
    });
  });

  it("passes category when set", () => {
    expect(buildAdminExpenseListFilters("all", "ГСМ")).toEqual({
      filterUserId: undefined,
      filterCategory: "ГСМ",
      expenseKind: undefined,
    });
  });

  it("passes both when set", () => {
    expect(buildAdminExpenseListFilters("id-1", "Пополнение")).toEqual({
      filterUserId: "id-1",
      filterCategory: "Пополнение",
      expenseKind: undefined,
    });
  });

  it("exclude_topup when only expenses and category all", () => {
    expect(buildAdminExpenseListFilters("all", "all", "expenses")).toEqual({
      filterUserId: undefined,
      filterCategory: undefined,
      expenseKind: "exclude_topup",
    });
  });

  it("only_topup when only topups and category all", () => {
    expect(buildAdminExpenseListFilters("all", "all", "topups")).toEqual({
      filterUserId: undefined,
      filterCategory: undefined,
      expenseKind: "only_topup",
    });
  });

  it("ignores expense kind when specific category", () => {
    expect(buildAdminExpenseListFilters("all", "ГСМ", "topups")).toEqual({
      filterUserId: undefined,
      filterCategory: "ГСМ",
      expenseKind: undefined,
    });
  });
});
