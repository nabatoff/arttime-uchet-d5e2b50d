import { API_BASE_URL } from "@/config";
import type { ApiResponse, AppData, Expense, MileageReport, User, Currency, UserRole, TransferRecord } from "@/types";

async function apiPost<T = unknown>(action: string, params: Record<string, unknown> | object = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...params }),
    });
    const raw = await response.json();

    // Normalize: API may return data under various keys
    if (raw.success && !raw.data) {
      const dataKey = Object.keys(raw).find((k) => k !== "success");
      if (dataKey) {
        return { success: true, data: raw[dataKey] as T };
      }
      return { success: true } as ApiResponse<T>;
    }

    return raw as ApiResponse<T>;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/** Normalize user object from API */
function normalizeUser(raw: Record<string, unknown>): User {
  return {
    id: String(raw.id ?? ""),
    login: String(raw.login ?? ""),
    name: String(raw.name ?? ""),
    role: (String(raw.role ?? "driver").toLowerCase()) as UserRole,
    photo: raw.photo as string | undefined,
    availableCurrencies: String(raw.availableCurrencies ?? raw.currencies ?? ""),
    balances: (raw.balances as Record<Currency, number>) ?? {} as Record<Currency, number>,
    preBalances: (raw.preBalances as Record<Currency, number>) ?? {} as Record<Currency, number>,
  };
}

export const api = {
  // Login — returns { success, user }
  login: async (login: string, password: string): Promise<ApiResponse<User>> => {
    const result = await apiPost<Record<string, unknown>>("login", { login, password });
    if (result.success && result.data) {
      return { success: true, data: normalizeUser(result.data) };
    }
    return { success: false, error: result.error || "Неверный логин или пароль" };
  },

  // Verify password on app launch
  verifyPassword: (login: string, password: string) =>
    apiPost<{ valid: boolean }>("verifyPassword", { login, password }),

  // Categories — returns { success, categories }
  getAppData: async (): Promise<ApiResponse<AppData>> => {
    const result = await apiPost<string[]>("getAppData");
    if (result.success && result.data) {
      return { success: true, data: { categories: result.data as string[] } };
    }
    return { success: false, error: "Ошибка загрузки данных" };
  },

  // Balance — returns { success, balances }
  getBalance: (driverId: string) =>
    apiPost<Record<Currency, number>>("getBalance", { userId: driverId }),

  // Pre-balance
  getPreBalance: (driverId: string) =>
    apiPost<Record<Currency, number>>("getPreBalance", { userId: driverId }),

  // Update pre-balance
  updatePreBalance: (driverId: string, currency: Currency, amount: number, adminRole: string = "Admin") =>
    apiPost("updatePreBalance", { targetUserId: driverId, currency, newAmount: amount, adminRole }),

  // Transfer from pre-balance to main balance
  transfer: (fromDriverId: string, toDriverId: string, currency: Currency, amount: number, performedBy: string) =>
    apiPost("transfer", { fromDriverId, toDriverId, currency, amount, performedBy }),

  // Get transfers history
  getTransfers: () =>
    apiPost<TransferRecord[]>("getTransfers"),

  // Expenses — uses userId and role
  getExpenses: (driverId: string, role?: string) =>
    apiPost<Expense[]>("getExpenses", { userId: driverId, role: role || "Driver" }),

  // Save expense — action is "saveExpense". performedByName — имя того, кто вносит запись (админ/баланс).
  addExpense: (expense: Omit<Expense, "id">, performedByName?: string) =>
    apiPost<Expense>("saveExpense", {
      userId: expense.driverId,
      category: expense.category,
      amount: expense.amount,
      currency: expense.currency,
      comment: expense.comment,
      receiptUrl: expense.receiptUrl,
      performedByName: performedByName ?? "",
    }),

  // Update expense
  updateExpense: (expense: Expense) =>
    apiPost<Expense>("updateExpense", expense),

  // Delete expense
  deleteExpense: (expenseId: string) =>
    apiPost("deleteExpense", { expenseId }),

  // Save mileage — action is "saveMileage"
  addMileage: (report: Omit<MileageReport, "id">) =>
    apiPost<MileageReport>("saveMileage", {
      userId: report.driverId,
      km: report.km,
      photoUrl: report.photoUrl,
    }),

  // Get mileage reports
  getMileage: (driverId?: string) =>
    apiPost<MileageReport[]>("getMileage", { userId: driverId }),

  // Get all drivers/users
  getDrivers: async (): Promise<ApiResponse<User[]>> => {
    const result = await apiPost<Record<string, unknown>[]>("getDrivers");
    if (result.success && result.data) {
      return { success: true, data: result.data.map(normalizeUser) };
    }
    return { success: false, error: "Ошибка загрузки" };
  },

  // Update currencies — action is "updateCurrencies"
  updateDriverCurrencies: (driverId: string, currencies: string, adminRole: string = "Admin") =>
    apiPost("updateCurrencies", { targetUserId: driverId, currenciesString: currencies, adminRole }),

  // Update balance — action is "updateBalance"
  updateBalance: (driverId: string, currency: Currency, amount: number, adminRole: string = "Admin") =>
    apiPost("updateBalance", { targetUserId: driverId, currency, newAmount: amount, adminRole }),

  // Create driver
  createDriver: (data: { login: string; password: string; name: string; currencies: string }) =>
    apiPost("createDriver", data),

  // Delete driver (keeps reports)
  deleteDriver: (driverId: string) =>
    apiPost("deleteDriver", { userId: driverId }),

  // Update driver profile (name, login, password)
  updateDriver: (driverId: string, data: { name?: string; login?: string; password?: string }) =>
    apiPost("updateDriver", { userId: driverId, ...data }),
};
