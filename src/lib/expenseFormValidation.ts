import type { Currency } from "@/types";

export const LARGE_EXPENSE_THRESHOLD = 500_000;

export interface ExpenseFormErrors {
  amount?: string;
  category?: string;
  receipt?: string;
}

export function getExpenseFormErrors(params: {
  amount: string;
  category: string;
  receiptUrl: string;
  noReceipt: boolean;
}): ExpenseFormErrors {
  const errors: ExpenseFormErrors = {};
  const amountNum = Number(params.amount.replace(",", "."));

  if (!params.amount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
    errors.amount = "Укажите сумму больше 0";
  }

  if (!params.category.trim()) {
    errors.category = "Выберите категорию";
  }

  if (!params.noReceipt && !params.receiptUrl.trim()) {
    errors.receipt = "Добавьте фото чека";
  }

  return errors;
}

export function shouldConfirmLargeExpense(amount: string, currency: Currency, balance?: number): boolean {
  const amountNum = Number(amount.replace(",", "."));
  if (!amountNum || Number.isNaN(amountNum)) return false;
  if (amountNum >= LARGE_EXPENSE_THRESHOLD) return true;
  if (balance != null && amountNum > balance) return true;
  return false;
}
