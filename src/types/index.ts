export type UserRole = "admin" | "driver" | "balance";

export type Currency = "KZT" | "RUB" | "UZS" | "CNY" | "EUR";

export const ALL_CURRENCIES: Currency[] = ["KZT", "RUB", "UZS", "CNY", "EUR"];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  KZT: "₸",
  RUB: "₽",
  UZS: "сўм",
  CNY: "¥",
  EUR: "€",
};

export const CURRENCY_FLAGS: Record<Currency, string> = {
  KZT: "🇰🇿",
  RUB: "🇷🇺",
  UZS: "🇺🇿",
  CNY: "🇨🇳",
  EUR: "🇪🇺",
};

export interface User {
  id: string;
  login: string;
  name: string;
  role: UserRole;
  photo?: string;
  availableCurrencies: string; // comma-separated: "KZT,RUB"
  balances: Record<Currency, number>;
  preBalances: Record<Currency, number>;
}

export interface Expense {
  id: string;
  driverId: string;
  date: string;
  category: string;
  amount: number;
  currency: Currency;
  comment: string;
  receiptUrl: string;
}

export interface MileageReport {
  id: string;
  driverId: string;
  driverName: string;
  driverPhoto?: string;
  date: string;
  km: number;
  photoUrl: string;
}

export interface TransferRecord {
  id: string;
  fromDriverId: string;
  toDriverId: string;
  currency: Currency;
  amount: number;
  date: string;
  performedBy: string;
}

export interface AppData {
  categories: string[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
