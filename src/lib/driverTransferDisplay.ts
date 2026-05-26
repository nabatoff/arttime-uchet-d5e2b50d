import { CURRENCY_SYMBOLS, type Currency, type TransferRecord } from "@/types";

export interface DriverTransferDisplay {
  isPositive: boolean;
  label: string;
  detail?: string;
  amount: number;
  currencyLabel: string;
}

export function describeDriverTransfer(
  transfer: TransferRecord,
  userId: string,
): DriverTransferDisplay {
  const uid = String(userId);
  const fromId = String(transfer.fromDriverId);
  const toId = String(transfer.toDriverId);
  const isConversion = transfer.currency.includes("→");

  if (isConversion) {
    const [fromCur, toCur] = transfer.currency.split("→").map((s) => s.trim());
    return {
      isPositive: true,
      label: "Конвертация",
      detail: `${fromCur} → ${toCur}`,
      amount: transfer.amount,
      currencyLabel: fromCur,
    };
  }

  if (fromId === toId) {
    return {
      isPositive: true,
      label: "На свой баланс",
      amount: transfer.amount,
      currencyLabel: transfer.currency,
    };
  }

  if (toId === uid) {
    return {
      isPositive: true,
      label: "Поступление",
      detail: transfer.fromDriverName ? `От: ${transfer.fromDriverName}` : undefined,
      amount: transfer.amount,
      currencyLabel: transfer.currency,
    };
  }

  return {
    isPositive: false,
    label: "Перевод",
    detail: transfer.toDriverName ? `Кому: ${transfer.toDriverName}` : undefined,
    amount: transfer.amount,
    currencyLabel: transfer.currency,
  };
}

export function formatTransferCurrency(currencyLabel: string, amount: number): string {
  const symbol = CURRENCY_SYMBOLS[currencyLabel as Currency];
  const formatted = amount.toLocaleString("ru-RU");
  return symbol ? `${formatted} ${symbol}` : `${formatted} ${currencyLabel}`;
}
