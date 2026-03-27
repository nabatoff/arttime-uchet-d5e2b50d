import { describe, it, expect } from "vitest";
import { buildAdminExpenseListFilters } from "@/lib/expenseQueryFilters";

describe("buildAdminExpenseListFilters", () => {
  it("returns undefined filters when all", () => {
    expect(buildAdminExpenseListFilters("all", "all")).toEqual({
      filterUserId: undefined,
      filterCategory: undefined,
    });
  });

  it("passes driver id when set", () => {
    expect(buildAdminExpenseListFilters("user-uuid", "all")).toEqual({
      filterUserId: "user-uuid",
      filterCategory: undefined,
    });
  });

  it("passes category when set", () => {
    expect(buildAdminExpenseListFilters("all", "ГСМ")).toEqual({
      filterUserId: undefined,
      filterCategory: "ГСМ",
    });
  });

  it("passes both when set", () => {
    expect(buildAdminExpenseListFilters("id-1", "Пополнение")).toEqual({
      filterUserId: "id-1",
      filterCategory: "Пополнение",
    });
  });
});
