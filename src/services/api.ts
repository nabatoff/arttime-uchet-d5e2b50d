import { API_BASE_URL } from "@/config";
import type { ApiResponse, ApiErrorType, AppData, CategoryInfo, Expense, MileageReport, User, Currency, UserRole, TransferRecord } from "@/types";

const FETCH_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 2;

function isRetryableErrorType(t: ApiErrorType): boolean {
  return t === "network" || t === "timeout";
}

async function apiPost<T = unknown>(action: string, params: Record<string, unknown> | object = {}, attempt = 0): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...params }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const raw = await response.json();

    if (!response.ok) {
      const errType: ApiErrorType = "server";
      const msg = (raw && raw.error) || response.statusText || `Ошибка ${response.status}`;
      return { success: false, error: msg, errorType: errType };
    }

    if (raw.success && !raw.data) {
      const dataKey = Object.keys(raw).find((k) => k !== "success");
      if (dataKey) {
        return { success: true, data: raw[dataKey] as T };
      }
      return { success: true } as ApiResponse<T>;
    }

    return raw as ApiResponse<T>;
  } catch (error) {
    clearTimeout(timeoutId);
    const isAbort = (error as Error)?.name === "AbortError";
    const isNetwork = (error as TypeError)?.message === "Failed to fetch" || (error as Error)?.message?.includes("fetch");
    const errorType: ApiErrorType = isAbort ? "timeout" : isNetwork ? "network" : "network";
    const errorMessage = isAbort ? "Превышено время ожидания" : isNetwork ? "Нет подключения к интернету" : String(error);

    if (isRetryableErrorType(errorType) && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return apiPost<T>(action, params, attempt + 1);
    }

    return { success: false, error: errorMessage, errorType };
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
    const result = await apiPost<CategoryInfo[]>("getAppData");
    if (result.success && result.data) {
      // Backward compat: if backend returns string[], convert
      const cats: CategoryInfo[] = (result.data as unknown[]).map((c) =>
        typeof c === "string" ? { name: c, noReceipt: false } : c as CategoryInfo
      );
      return { success: true, data: { categories: cats } };
    }
    return { success: false, error: "Ошибка загрузки данных" };
  },

  // Category CRUD
  saveCategory: (name: string, noReceipt: boolean) =>
    apiPost("saveCategory", { name, noReceipt }),

  updateCategory: (oldName: string, newName: string, noReceipt: boolean) =>
    apiPost("updateCategory", { oldName, newName, noReceipt }),

  deleteCategory: (name: string) =>
    apiPost("deleteCategory", { name }),

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

  // Get transfers history (optional: limit, offset, since, until — ISO date strings)
  getTransfers: (params?: { limit?: number; offset?: number; since?: string; until?: string }) =>
    apiPost<TransferRecord[]>("getTransfers", params ?? {}),

  // Expenses (optional: limit, offset, since, until — ISO date strings)
  getExpenses: (driverId: string, role?: string, params?: { limit?: number; offset?: number; since?: string; until?: string }) =>
    apiPost<Expense[]>("getExpenses", { userId: driverId, role: role || "Driver", ...params }),

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

  // Get mileage reports (optional: limit, offset, since, until)
  getMileage: (driverId?: string, params?: { limit?: number; offset?: number; since?: string; until?: string }) =>
    apiPost<MileageReport[]>("getMileage", { userId: driverId, ...params }),

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
