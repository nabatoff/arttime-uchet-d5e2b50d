import { supabase } from "@/integrations/supabase/client";
import type { ApiResponse, AppData, CategoryInfo, Expense, MileageReport, User, Currency, UserRole, TransferRecord, Truck } from "@/types";

const CURRENCY_COLS = ["kzt", "rub", "uzs", "cny", "eur"] as const;
type CurrencyCol = (typeof CURRENCY_COLS)[number];
const colToCurrency = (col: CurrencyCol): Currency => col.toUpperCase() as Currency;
const currencyToCol = (c: Currency): CurrencyCol => c.toLowerCase() as CurrencyCol;

/** Календарный день Asia/Almaty (UTC+5, без DST) для границ «сегодня» */
function almatyDayStartEndUtc(isoDate: string): { start: string; end: string } {
  const d = isoDate.slice(0, 10);
  const start = new Date(`${d}T00:00:00+05:00`);
  const end = new Date(`${d}T23:59:59.999+05:00`);
  return { start: start.toISOString(), end: end.toISOString() };
}

function isConversionTransferRow(fromId: string | null, toId: string | null, currency: string): boolean {
  return !!(fromId && toId && fromId === toId && String(currency).includes("→"));
}

/** Курс = тенге за 1 единицу валюты в паре с KZT. *→KZT: ×, KZT→*: ÷. Без KZT — деление на курс. */
function computeConvertedAmount(fromCurrency: Currency, toCurrency: Currency, amount: number, rate: number): number {
  if (toCurrency === "KZT" && fromCurrency !== "KZT") {
    return Math.round(amount * rate * 100) / 100;
  }
  if (fromCurrency === "KZT" && toCurrency !== "KZT") {
    return Math.round((amount / rate) * 100) / 100;
  }
  return Math.round((amount / rate) * 100) / 100;
}

function parseRateFromComment(comment: string): number | null {
  const m = String(comment).match(/курс\s*([\d.,]+)/);
  return m ? Number(String(m[1]).replace(",", ".")) : null;
}

function parseConvertedFromComment(comment: string): number | null {
  const m = String(comment).match(/→\s*([\d.,]+)/);
  return m ? Number(String(m[1]).replace(",", ".")) : null;
}

/** Откат эффектов строки перевода на балансах */
async function reverseTransferRowEffects(old: {
  from_driver_id: string | null;
  to_driver_id: string | null;
  currency: string;
  amount: number;
  comment: string | null;
}): Promise<void> {
  const currency = old.currency;
  const amount = Number(old.amount);
  const fromId = old.from_driver_id;
  const toId = old.to_driver_id;
  if (!fromId || !toId) return;

  if (isConversionTransferRow(fromId, toId, currency)) {
    const parts = currency.split("→").map((s) => s.trim());
    const fromCur = parts[0] as Currency;
    const toCur = parts[1] as Currency;
    const col1 = currencyToCol(fromCur);
    const col2 = currencyToCol(toCur);
    const { data: preBal } = await supabase.from("pre_balances").select("*").eq("user_id", fromId).maybeSingle();
    const curFrom = preBal ? Number(preBal[col1]) || 0 : 0;
    const curTo = preBal ? Number(preBal[col2]) || 0 : 0;
    const convertedAmount = parseConvertedFromComment(old.comment || "");
    await supabase.from("pre_balances").upsert({ user_id: fromId, [col1]: curFrom + amount }, { onConflict: "user_id" });
    if (convertedAmount !== null && convertedAmount > 0) {
      await supabase.from("pre_balances").upsert({ user_id: fromId, [col2]: curTo - convertedAmount }, { onConflict: "user_id" });
    }
  } else {
    const col = currencyToCol(currency as Currency);
    const { data: preBal } = await supabase.from("pre_balances").select("*").eq("user_id", fromId).maybeSingle();
    const preVal = preBal ? Number(preBal[col]) || 0 : 0;
    await supabase.from("pre_balances").upsert({ user_id: fromId, [col]: preVal + amount }, { onConflict: "user_id" });

    const { data: balRow } = await supabase.from("balances").select("*").eq("user_id", toId).maybeSingle();
    const balVal = balRow ? Number(balRow[col]) || 0 : 0;
    await supabase.from("balances").upsert({ user_id: toId, [col]: balVal - amount }, { onConflict: "user_id" });
  }
}

function balanceRowToRecord(row: Record<string, unknown>): Record<Currency, number> {
  const result = {} as Record<Currency, number>;
  for (const col of CURRENCY_COLS) {
    result[colToCurrency(col)] = Number(row[col]) || 0;
  }
  return result;
}

function normalizeUser(row: Record<string, unknown>, balRow?: Record<string, unknown> | null, preBalRow?: Record<string, unknown> | null): User {
  return {
    id: String(row.id ?? ""),
    login: String(row.login ?? ""),
    name: String(row.name ?? ""),
    role: (String(row.role ?? "driver").toLowerCase()) as UserRole,
    photo: row.photo as string | undefined,
    availableCurrencies: String(row.available_currencies ?? ""),
    balances: balRow ? balanceRowToRecord(balRow) : { KZT: 0, RUB: 0, UZS: 0, CNY: 0, EUR: 0 },
    preBalances: preBalRow ? balanceRowToRecord(preBalRow) : { KZT: 0, RUB: 0, UZS: 0, CNY: 0, EUR: 0 },
  };
}

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}
function fail(error: string): ApiResponse<never> {
  return { success: false, error };
}

export const api = {
  // ==================== AUTH ====================
  login: async (login: string, password: string): Promise<ApiResponse<User>> => {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("login", login)
      .eq("password", password)
      .maybeSingle();

    if (error) return fail(error.message);
    if (!user) return fail("Неверный логин или пароль");

    const [{ data: bal }, { data: pre }] = await Promise.all([
      supabase.from("balances").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("pre_balances").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    return ok(normalizeUser(user, bal, pre));
  },

  verifyPassword: async (login: string, password: string): Promise<ApiResponse<{ valid: boolean }>> => {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("login", login)
      .eq("password", password)
      .maybeSingle();

    if (error) return ok({ valid: false });
    return ok({ valid: !!data });
  },

  // ==================== APP DATA ====================
  getAppData: async (): Promise<ApiResponse<AppData>> => {
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) return fail(error.message);

    const categories: CategoryInfo[] = (data || []).map((c) => ({
      name: c.name,
      noReceipt: !!c.no_receipt,
      visibleTo: (c.visible_to === "driver" || c.visible_to === "balance" ? c.visible_to : "both") as CategoryInfo["visibleTo"],
    }));
    return ok({ categories });
  },

  // ==================== CATEGORIES ====================
  saveCategory: async (name: string, noReceipt: boolean, visibleTo?: "driver" | "balance" | "both") => {
    const { error } = await supabase.from("categories").insert({
      name: name.trim(),
      no_receipt: noReceipt,
      visible_to: visibleTo || "both",
    });
    if (error) {
      if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
        return fail("Категория уже существует");
      }
      return fail(error.message);
    }
    return ok(null);
  },

  updateCategory: async (oldName: string, newName: string, noReceipt: boolean, visibleTo?: "driver" | "balance" | "both") => {
    const { error } = await supabase
      .from("categories")
      .update({ name: newName.trim(), no_receipt: noReceipt, visible_to: visibleTo || "both" })
      .eq("name", oldName.trim());
    if (error) return fail(error.message);
    return ok(null);
  },

  deleteCategory: async (name: string) => {
    const { error } = await supabase.from("categories").delete().eq("name", name.trim());
    if (error) return fail(error.message);
    return ok(null);
  },

  // ==================== BALANCE ====================
  getBalance: async (driverId: string): Promise<ApiResponse<Record<Currency, number>>> => {
    const { data, error } = await supabase.from("balances").select("*").eq("user_id", driverId).maybeSingle();
    if (error) return fail(error.message);
    return ok(data ? balanceRowToRecord(data) : { KZT: 0, RUB: 0, UZS: 0, CNY: 0, EUR: 0 });
  },

  getPreBalance: async (driverId: string): Promise<ApiResponse<Record<Currency, number>>> => {
    const { data, error } = await supabase.from("pre_balances").select("*").eq("user_id", driverId).maybeSingle();
    if (error) return fail(error.message);
    return ok(data ? balanceRowToRecord(data) : { KZT: 0, RUB: 0, UZS: 0, CNY: 0, EUR: 0 });
  },

  updatePreBalance: async (driverId: string, currency: Currency, amount: number) => {
    const col = currencyToCol(currency);
    const { error } = await supabase
      .from("pre_balances")
      .upsert({ user_id: driverId, [col]: amount }, { onConflict: "user_id" });
    if (error) return fail(error.message);
    return ok(null);
  },

  updateBalance: async (driverId: string, currency: Currency, amount: number) => {
    const col = currencyToCol(currency);
    const { error } = await supabase
      .from("balances")
      .upsert({ user_id: driverId, [col]: amount }, { onConflict: "user_id" });
    if (error) return fail(error.message);
    return ok(null);
  },

  // ==================== TRANSFERS ====================
  transfer: async (fromDriverId: string, toDriverId: string, currency: Currency, amount: number, performedBy: string, comment?: string, allowNegative?: boolean) => {
    // Get pre-balance of sender
    const { data: preBal } = await supabase.from("pre_balances").select("*").eq("user_id", fromDriverId).maybeSingle();
    const col = currencyToCol(currency);
    const currentPre = preBal ? Number(preBal[col]) || 0 : 0;

    if (!allowNegative && currentPre < amount) {
      return fail("Недостаточно средств на предбалансе");
    }

    // Get performer name
    let performerName = performedBy;
    if (performedBy) {
      const { data: pUser } = await supabase.from("users").select("name").eq("id", performedBy).maybeSingle();
      if (pUser) performerName = pUser.name;
    }

    // Update pre-balance (sender)
    await supabase.from("pre_balances").upsert({ user_id: fromDriverId, [col]: currentPre - amount }, { onConflict: "user_id" });

    // Update balance (receiver)
    const { data: balRow } = await supabase.from("balances").select("*").eq("user_id", toDriverId).maybeSingle();
    const currentBal = balRow ? Number(balRow[col]) || 0 : 0;
    await supabase.from("balances").upsert({ user_id: toDriverId, [col]: currentBal + amount }, { onConflict: "user_id" });

    // Record transfer
    await supabase.from("transfers").insert({
      from_driver_id: fromDriverId,
      to_driver_id: toDriverId,
      currency,
      amount,
      performed_by: performerName,
      comment: comment ?? "",
    });

    return ok(null);
  },

  getTransfers: async (params?: { limit?: number; offset?: number; since?: string; until?: string }): Promise<ApiResponse<TransferRecord[]>> => {
    let query = supabase.from("transfers").select("*").order("date", { ascending: false });

    if (params?.since) query = query.gte("date", params.since);
    // until уже приходит как полный ISO (endOfDay), не дописывать суффикс — иначе строка вида "...999Z" + "T23:59:59.999Z" ломает фильтр
    if (params?.until) query = query.lte("date", params.until);
    if (params?.offset) query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
    else if (params?.limit) query = query.limit(params.limit);

    const { data, error } = await query;
    if (error) return fail(error.message);

    return ok((data || []).map((r) => ({
      id: r.id,
      fromDriverId: r.from_driver_id || "",
      toDriverId: r.to_driver_id || "",
      currency: String(r.currency ?? ""),
      amount: Number(r.amount),
      date: r.date,
      performedBy: r.performed_by || "",
      comment: r.comment || "",
    })));
  },

  updateTransfer: async (transfer: { id: string; fromDriverId: string; toDriverId: string; currency: string; amount: number; comment?: string }) => {
    const { data: old } = await supabase.from("transfers").select("*").eq("id", transfer.id).maybeSingle();
    if (!old) return fail("Перевод не найден");

    await reverseTransferRowEffects(old);

    if (isConversionTransferRow(transfer.fromDriverId, transfer.toDriverId, transfer.currency)) {
      const parts = transfer.currency.split("→").map((s) => s.trim());
      const fromCur = parts[0] as Currency;
      const toCur = parts[1] as Currency;
      if (!fromCur || !toCur) return fail("Неверный формат валюты конвертации");
      const rate = parseRateFromComment(transfer.comment || "");
      if (!(transfer.amount > 0) || !rate) {
        return fail("Для конвертации укажите сумму > 0 и курс в комментарии (курс X)");
      }
      const convertedAmount = computeConvertedAmount(fromCur, toCur, transfer.amount, rate);
      const { data: preBal } = await supabase.from("pre_balances").select("*").eq("user_id", transfer.fromDriverId).maybeSingle();
      const fromCol = currencyToCol(fromCur);
      const toCol = currencyToCol(toCur);
      const currentFrom = preBal ? Number(preBal[fromCol]) || 0 : 0;
      const currentTo = preBal ? Number(preBal[toCol]) || 0 : 0;
      await supabase.from("pre_balances").upsert(
        {
          user_id: transfer.fromDriverId,
          [fromCol]: currentFrom - transfer.amount,
          [toCol]: currentTo + convertedAmount,
        },
        { onConflict: "user_id" }
      );

      let commentFinal = String(transfer.comment ?? "").trim();
      if (!commentFinal) {
        commentFinal = `Конвертация: ${transfer.amount} ${fromCur} → ${convertedAmount} ${toCur} (курс ${rate})`;
      }
      await supabase
        .from("transfers")
        .update({
          from_driver_id: transfer.fromDriverId,
          to_driver_id: transfer.toDriverId,
          currency: transfer.currency,
          amount: transfer.amount,
          comment: commentFinal,
        })
        .eq("id", transfer.id);

      return ok(null);
    }

    const newCol = currencyToCol(transfer.currency as Currency);

    const { data: newPreFrom } = await supabase.from("pre_balances").select("*").eq("user_id", transfer.fromDriverId).maybeSingle();
    const newPreVal = newPreFrom ? Number(newPreFrom[newCol]) || 0 : 0;
    await supabase.from("pre_balances").upsert({ user_id: transfer.fromDriverId, [newCol]: newPreVal - transfer.amount }, { onConflict: "user_id" });

    const { data: newBalTo } = await supabase.from("balances").select("*").eq("user_id", transfer.toDriverId).maybeSingle();
    const newBalVal = newBalTo ? Number(newBalTo[newCol]) || 0 : 0;
    await supabase.from("balances").upsert({ user_id: transfer.toDriverId, [newCol]: newBalVal + transfer.amount }, { onConflict: "user_id" });

    await supabase
      .from("transfers")
      .update({
        from_driver_id: transfer.fromDriverId,
        to_driver_id: transfer.toDriverId,
        currency: transfer.currency,
        amount: transfer.amount,
        comment: transfer.comment ?? "",
      })
      .eq("id", transfer.id);

    return ok(null);
  },

  deleteTransfer: async (transferId: string) => {
    const { data: old } = await supabase.from("transfers").select("*").eq("id", transferId).maybeSingle();
    if (!old) return fail("Перевод не найден");

    await reverseTransferRowEffects(old);
    await supabase.from("transfers").delete().eq("id", transferId);
    return ok(null);
  },

  convertPreBalance: async (driverId: string, fromCurrency: Currency, toCurrency: Currency, amount: number, rate: number, performedBy: string) => {
    if (fromCurrency === toCurrency) return fail("Валюты должны отличаться");
    if (!(amount > 0) || !(rate > 0)) return fail("Сумма и курс должны быть > 0");

    const { data: preBal } = await supabase.from("pre_balances").select("*").eq("user_id", driverId).maybeSingle();
    const fromCol = currencyToCol(fromCurrency);
    const toCol = currencyToCol(toCurrency);
    const currentFrom = preBal ? Number(preBal[fromCol]) || 0 : 0;
    const currentTo = preBal ? Number(preBal[toCol]) || 0 : 0;

    const convertedAmount = computeConvertedAmount(fromCurrency, toCurrency, amount, rate);

    await supabase.from("pre_balances").upsert({
      user_id: driverId,
      [fromCol]: currentFrom - amount,
      [toCol]: currentTo + convertedAmount,
    }, { onConflict: "user_id" });

    // Get performer name
    let performerName = performedBy;
    if (performedBy) {
      const { data: pUser } = await supabase.from("users").select("name").eq("id", performedBy).maybeSingle();
      if (pUser) performerName = pUser.name;
    }

    await supabase.from("transfers").insert({
      from_driver_id: driverId,
      to_driver_id: driverId,
      currency: `${fromCurrency}→${toCurrency}`,
      amount,
      performed_by: performerName,
      comment: `Конвертация: ${amount} ${fromCurrency} → ${convertedAmount} ${toCurrency} (курс ${rate})`,
    });

    return ok({ convertedAmount });
  },

  // ==================== EXPENSES ====================
  getExpenses: async (
    driverId: string,
    role?: string,
    params?: {
      limit?: number;
      offset?: number;
      since?: string;
      until?: string;
      /** Админ: сузить выборку по водителю (не путать с driverId для не-админа) */
      filterUserId?: string;
      /** Админ: сузить по категории */
      filterCategory?: string;
      /** Админ: если категория «все» — исключить пополнения или только пополнения */
      expenseKind?: "exclude_topup" | "only_topup";
    },
  ): Promise<ApiResponse<Expense[]>> => {
    let query = supabase.from("expenses").select("*, users!expenses_user_id_fkey(name)").order("date", { ascending: false });

    const isAdmin = role === "Admin" || role === "admin";
    if (!isAdmin) {
      query = query.eq("user_id", driverId).neq("category", "Пополнение");
    } else {
      if (params?.filterUserId) query = query.eq("user_id", params.filterUserId);
      if (params?.filterCategory) {
        query = query.eq("category", params.filterCategory);
      } else {
        if (params?.expenseKind === "exclude_topup") query = query.neq("category", "Пополнение");
        if (params?.expenseKind === "only_topup") query = query.eq("category", "Пополнение");
      }
    }
    if (params?.since) query = query.gte("date", params.since);
    if (params?.until) query = query.lte("date", params.until);
    if (params?.offset) query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
    else if (params?.limit) query = query.limit(params.limit);

    const { data, error } = await query;
    if (error) return fail(error.message);

    return ok((data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      driverId: String(r.user_id || ""),
      driverName: (r.users as Record<string, unknown>)?.name ? String((r.users as Record<string, unknown>).name) : "",
      date: String(r.date),
      category: String(r.category || ""),
      amount: Number(r.amount) || 0,
      currency: String(r.currency || "KZT") as Currency,
      comment: String(r.comment || ""),
      receiptUrl: String(r.receipt_url || ""),
      performedBy: String(r.performed_by || ""),
      truck: String(r.truck || ""),
    })));
  },

  addExpense: async (expense: Omit<Expense, "id">, performedByName?: string) => {
    // Auto-detect truck from today's mileage if not provided
    let truckName = expense.truck || "";
    if (!truckName) {
      const today = new Date().toISOString().split("T")[0];
      const { data: mileageToday } = await supabase
        .from("mileage")
        .select("truck")
        .eq("user_id", expense.driverId)
        .gte("date", today)
        .lte("date", today + "T23:59:59.999Z")
        .order("date", { ascending: false })
        .limit(1);
      if (mileageToday?.[0]?.truck) truckName = mileageToday[0].truck;
    }

    const { data, error } = await supabase.from("expenses").insert({
      user_id: expense.driverId,
      category: expense.category,
      amount: expense.amount,
      currency: expense.currency,
      comment: expense.comment,
      receipt_url: expense.receiptUrl,
      performed_by: performedByName ?? "",
      truck: truckName,
    }).select("*, users!expenses_user_id_fkey(name)").single();

    if (error) return fail(error.message);

    // Deduct from balance (except for "Пополнение")
    if (expense.category !== "Пополнение") {
      const col = currencyToCol(expense.currency);
      const { data: balRow } = await supabase.from("balances").select("*").eq("user_id", expense.driverId).maybeSingle();
      const current = balRow ? Number(balRow[col]) || 0 : 0;
      await supabase.from("balances").upsert({ user_id: expense.driverId, [col]: current - expense.amount }, { onConflict: "user_id" });
    }

    return ok({
      id: data.id,
      driverId: String(data.user_id),
      date: data.date,
      category: data.category,
      amount: Number(data.amount),
      currency: data.currency as Currency,
      comment: data.comment || "",
      receiptUrl: data.receipt_url || "",
      performedBy: data.performed_by || "",
      truck: data.truck || "",
    } as Expense);
  },

  updateExpense: async (expense: Expense) => {
    // Get old expense to reverse balance
    const { data: old } = await supabase.from("expenses").select("*").eq("id", expense.id).maybeSingle();
    if (!old) return fail("Расход не найден");

    const oldCol = currencyToCol(old.currency as Currency);
    const newCol = currencyToCol(expense.currency);

    // Reverse old balance change
    if (old.category !== "Пополнение" && old.user_id) {
      const { data: balRow } = await supabase.from("balances").select("*").eq("user_id", old.user_id).maybeSingle();
      const current = balRow ? Number(balRow[oldCol]) || 0 : 0;
      await supabase.from("balances").upsert({ user_id: old.user_id, [oldCol]: current + Number(old.amount) }, { onConflict: "user_id" });
    }
    // Apply new balance change
    if (expense.category !== "Пополнение" && old.user_id) {
      const { data: balRow } = await supabase.from("balances").select("*").eq("user_id", old.user_id).maybeSingle();
      const current = balRow ? Number(balRow[newCol]) || 0 : 0;
      await supabase.from("balances").upsert({ user_id: old.user_id, [newCol]: current - expense.amount }, { onConflict: "user_id" });
    }

    const { error } = await supabase.from("expenses").update({
      category: expense.category,
      amount: expense.amount,
      currency: expense.currency,
      comment: expense.comment,
      receipt_url: expense.receiptUrl,
      performed_by: expense.performedBy || "",
      truck: expense.truck || "",
    }).eq("id", expense.id);

    if (error) return fail(error.message);
    return ok(null);
  },

  deleteExpense: async (expenseId: string) => {
    const { data: old } = await supabase.from("expenses").select("*").eq("id", expenseId).maybeSingle();
    if (!old) return fail("Запись не найдена");

    // Restore balance
    if (old.category !== "Пополнение" && old.user_id) {
      const col = currencyToCol(old.currency as Currency);
      const { data: balRow } = await supabase.from("balances").select("*").eq("user_id", old.user_id).maybeSingle();
      const current = balRow ? Number(balRow[col]) || 0 : 0;
      await supabase.from("balances").upsert({ user_id: old.user_id, [col]: current + Number(old.amount) }, { onConflict: "user_id" });
    }

    const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
    if (error) return fail(error.message);
    return ok(null);
  },

  // ==================== TRUCKS ====================
  getTrucks: async (params?: { excludeBusyForDate?: string; date?: string }): Promise<ApiResponse<Truck[]>> => {
    const { data, error } = await supabase.from("trucks").select("*").order("name");
    if (error) return fail(error.message);
    let list: Truck[] = (data || []).map((t) => ({ id: t.id, name: t.name }));

    const excludeDate = params?.excludeBusyForDate ?? params?.date;
    if (excludeDate) {
      const day = excludeDate.slice(0, 10);
      const { start, end } = almatyDayStartEndUtc(day);
      const { data: busyRows } = await supabase.from("mileage").select("truck").gte("date", start).lte("date", end);
      const busy = new Set(
        (busyRows || [])
          .map((r) => r.truck)
          .filter(Boolean)
          .map((s) => String(s).trim())
      );
      list = list.filter((t) => !busy.has(t.name));
    }

    return ok(list);
  },

  saveTruck: async (name: string) => {
    const { error } = await supabase.from("trucks").insert({ name: name.trim() });
    if (error) return fail(error.message.includes("duplicate") ? "Тягач с таким названием уже есть" : error.message);
    return ok(null);
  },

  updateTruck: async (oldName: string, newName: string) => {
    const { error } = await supabase.from("trucks").update({ name: newName.trim() }).eq("name", oldName.trim());
    if (error) return fail(error.message);
    return ok(null);
  },

  deleteTruck: async (name: string) => {
    const { error } = await supabase.from("trucks").delete().eq("name", name.trim());
    if (error) return fail(error.message);
    return ok(null);
  },

  // ==================== MILEAGE ====================
  addMileage: async (report: Omit<MileageReport, "id">) => {
    const { data, error } = await supabase.from("mileage").insert({
      user_id: report.driverId,
      km: report.km,
      photo_url: report.photoUrl,
      truck: report.truck ?? "",
    }).select("*, users!mileage_user_id_fkey(name, photo)").single();

    if (error) return fail(error.message);

    // Update truck on today's expenses
    if (report.truck) {
      const today = new Date().toISOString().split("T")[0];
      await supabase.from("expenses")
        .update({ truck: report.truck })
        .eq("user_id", report.driverId)
        .gte("date", today)
        .lte("date", today + "T23:59:59.999Z");
    }

    const user = data.users as Record<string, unknown> | null;
    return ok({
      id: data.id,
      driverId: data.user_id || "",
      driverName: user?.name ? String(user.name) : "",
      driverPhoto: user?.photo ? String(user.photo) : undefined,
      date: data.date,
      km: Number(data.km),
      photoUrl: data.photo_url || "",
      truck: data.truck || "",
    } as MileageReport);
  },

  getMileage: async (driverId?: string, params?: { limit?: number; offset?: number; since?: string; until?: string }): Promise<ApiResponse<MileageReport[]>> => {
    let query = supabase.from("mileage").select("*, users!mileage_user_id_fkey(name, photo)").order("date", { ascending: false });

    if (driverId) query = query.eq("user_id", driverId);
    if (params?.since) query = query.gte("date", params.since);
    if (params?.until) query = query.lte("date", params.until);
    if (params?.offset) query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
    else if (params?.limit) query = query.limit(params.limit);

    const { data, error } = await query;
    if (error) return fail(error.message);

    return ok((data || []).map((r: Record<string, unknown>) => {
      const user = r.users as Record<string, unknown> | null;
      return {
        id: String(r.id),
        driverId: String(r.user_id || ""),
        driverName: user?.name ? String(user.name) : "",
        driverPhoto: user?.photo ? String(user.photo) : undefined,
        date: String(r.date),
        km: Number(r.km) || 0,
        photoUrl: String(r.photo_url || ""),
        truck: String(r.truck || ""),
      };
    }));
  },

  updateMileage: async (data: { id: string; km?: number; truck?: string }) => {
    const updates: Record<string, unknown> = {};
    if (data.km !== undefined) updates.km = data.km;
    if (data.truck !== undefined) updates.truck = data.truck;

    const { error } = await supabase.from("mileage").update(updates).eq("id", data.id);
    if (error) return fail(error.message);
    return ok(null);
  },

  deleteMileage: async (mileageId: string) => {
    const { error } = await supabase.from("mileage").delete().eq("id", mileageId);
    if (error) return fail(error.message);
    return ok(null);
  },

  // ==================== DRIVERS ====================
  getDrivers: async (): Promise<ApiResponse<User[]>> => {
    const { data: users, error } = await supabase.from("users").select("*").order("name");
    if (error) return fail(error.message);

    const ids = (users || []).map((u) => u.id);
    const [{ data: bals }, { data: preBals }] = await Promise.all([
      supabase.from("balances").select("*").in("user_id", ids),
      supabase.from("pre_balances").select("*").in("user_id", ids),
    ]);

    const balMap = new Map((bals || []).map((b) => [b.user_id, b]));
    const preMap = new Map((preBals || []).map((b) => [b.user_id, b]));

    return ok((users || []).map((u) => normalizeUser(u, balMap.get(u.id), preMap.get(u.id))));
  },

  updateDriverCurrencies: async (driverId: string, currencies: string) => {
    const { error } = await supabase.from("users").update({ available_currencies: currencies }).eq("id", driverId);
    if (error) return fail(error.message);
    return ok(null);
  },

  createDriver: async (data: { login: string; password: string; name: string; currencies: string }) => {
    const { data: user, error } = await supabase.from("users").insert({
      login: data.login,
      password: data.password,
      name: data.name,
      available_currencies: data.currencies,
    }).select().single();

    if (error) return fail(error.message.includes("duplicate") ? "Логин уже занят" : error.message);

    return ok({
      id: user.id,
      login: user.login,
      name: user.name,
      role: "driver" as UserRole,
      availableCurrencies: user.available_currencies || "",
      balances: { KZT: 0, RUB: 0, UZS: 0, CNY: 0, EUR: 0 },
      preBalances: { KZT: 0, RUB: 0, UZS: 0, CNY: 0, EUR: 0 },
    } as User);
  },

  deleteDriver: async (driverId: string) => {
    const { error } = await supabase.from("users").delete().eq("id", driverId);
    if (error) return fail(error.message);
    return ok(null);
  },

  updateDriver: async (driverId: string, data: { name?: string; login?: string; password?: string }) => {
    const updates: Record<string, string> = {};
    if (data.name) updates.name = data.name;
    if (data.login) updates.login = data.login;
    if (data.password) updates.password = data.password;

    const { error } = await supabase.from("users").update(updates).eq("id", driverId);
    if (error) return fail(error.message.includes("duplicate") ? "Этот логин уже используется" : error.message);
    return ok(null);
  },
};
