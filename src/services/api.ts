import { API_BASE_URL } from "@/config";
import type { ApiResponse, AppData, Expense, MileageReport, User, Currency, UserRole } from "@/types";

// Raw response from Google Apps Script may use different field names
// We normalize it into our ApiResponse<T> format

async function apiPost<T = unknown>(action: string, params: Record<string, unknown> | object = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...params }),
    });
    const raw = await response.json();

    // Normalize: API may return { success, user } instead of { success, data }
    if (raw.success && !raw.data) {
      // Find the first non-"success" key as the data payload
      const dataKey = Object.keys(raw).find((k) => k !== "success");
      if (dataKey) {
        return { success: true, data: raw[dataKey] as T };
      }
    }

    return raw as ApiResponse<T>;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/** Normalize user object from API (role casing, field names) */
function normalizeUser(raw: Record<string, unknown>): User {
  return {
    id: String(raw.id ?? ""),
    login: String(raw.login ?? ""),
    name: String(raw.name ?? ""),
    role: (String(raw.role ?? "driver").toLowerCase()) as UserRole,
    photo: raw.photo as string | undefined,
    availableCurrencies: String(raw.availableCurrencies ?? raw.currencies ?? ""),
    balances: (raw.balances as Record<Currency, number>) ?? ({} as Record<Currency, number>),
  };
}

export const api = {
  login: async (login: string, password: string): Promise<ApiResponse<User>> => {
    const result = await apiPost<Record<string, unknown>>("login", { login, password });
    if (result.success && result.data) {
      return { success: true, data: normalizeUser(result.data) };
    }
    return { success: false, error: result.error || "Неверный логин или пароль" };
  },

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
