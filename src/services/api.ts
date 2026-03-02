import { API_BASE_URL } from "@/config";
import type { ApiResponse, AppData, Expense, MileageReport, User, Currency } from "@/types";

async function apiPost<T = unknown>(action: string, params: Record<string, unknown> | object = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...params }),
    });
    return await response.json();
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export const api = {
  login: (login: string, password: string) =>
    apiPost<User>("login", { login, password }),

  verifyPassword: (login: string, password: string) =>
    apiPost<{ valid: boolean }>("verifyPassword", { login, password }),

  getAppData: () =>
    apiPost<AppData>("getAppData"),

  getBalance: (driverId: string) =>
    apiPost<Record<Currency, number>>("getBalance", { driverId }),

  getExpenses: (driverId: string) =>
    apiPost<Expense[]>("getExpenses", { driverId }),

  addExpense: (expense: Omit<Expense, "id">) =>
    apiPost<Expense>("addExpense", expense),

  updateExpense: (expense: Expense) =>
    apiPost<Expense>("updateExpense", expense),

  addMileage: (report: Omit<MileageReport, "id">) =>
    apiPost<MileageReport>("addMileage", report),

  getMileage: (driverId?: string) =>
    apiPost<MileageReport[]>("getMileage", { driverId }),

  getDrivers: () =>
    apiPost<User[]>("getDrivers"),

  updateDriverCurrencies: (driverId: string, currencies: string) =>
    apiPost("updateDriverCurrencies", { driverId, currencies }),

  updateBalance: (driverId: string, currency: Currency, amount: number) =>
    apiPost("updateBalance", { driverId, currency, amount }),
};
