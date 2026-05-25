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
  /** Кто выполнил операцию (пополнение и т.д.) — заполняет бэкенд из performedByName */
  performedBy?: string;
  /** Тягач (из листа Trucks), подставляется из пробега за день или вручную */
  truck?: string;
}

export interface Truck {
  id: string;
  name: string;
}

export interface MileageReport {
  id: string;
  driverId: string;
  driverName: string;
  driverPhoto?: string;
  date: string;
  km: number;
  photoUrl: string;
  /** Выбранный тягач при вводе пробега */
  truck?: string;
}

export interface TransferRecord {
  id: string;
  fromDriverId: string;
  toDriverId: string;
  /** Обычные валюты или конвертация вида "KZT→RUB" (как в БД) */
  currency: string;
  amount: number;
  date: string;
  performedBy: string;
  comment?: string;
}

export type WalletType = "balance" | "pre_balance";

export interface DriverLedgerOpening {
  walletType: WalletType;
  currency: Currency;
  amount: number;
}

export interface DriverLedgerRow {
  rowKey: string;
  eventId: string;
  eventTime: string;
  sourceType: "expense" | "transfer" | "conversion" | "adjustment";
  operationType: string;
  walletType: WalletType;
  currency: Currency;
  delta: number;
  title: string;
  description: string;
  performedBy: string;
  relatedCurrency?: Currency;
  relatedAmount?: number;
  balanceAfter: number;
}

export interface DriverLedgerSummaryItem {
  walletType: WalletType;
  currency: Currency;
  opening: number;
  inflow: number;
  outflow: number;
  closing: number;
}

export interface DriverLedgerData {
  openings: DriverLedgerOpening[];
  rows: DriverLedgerRow[];
  summary: DriverLedgerSummaryItem[];
}

export type CategoryVisibleTo = "driver" | "balance" | "both";

export interface CategoryInfo {
  name: string;
  noReceipt: boolean;
  /** Кому видна категория: водитель, balance или оба. По умолчанию "both". */
  visibleTo?: CategoryVisibleTo;
}

export interface AppData {
  categories: CategoryInfo[];
}

export type ApiErrorType = "network" | "server" | "timeout";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorType?: ApiErrorType;
}
