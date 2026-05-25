import { supabase } from "@/integrations/supabase/client";
import type {
  ApiResponse,
  AppData,
  CategoryInfo,
  DriverLedgerData,
  DriverLedgerOpening,
  DriverLedgerRow,
  DriverLedgerSummaryItem,
  Expense,
  MileageReport,
  User,
  Currency,
  UserRole,
  TransferRecord,
  Truck,
  WalletType,
} from "@/types";
import { sortCategories } from "@/lib/utils";

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

/** Откат эффектов строки перевода на балансах. При ошибке — текст для пользователя. */
async function reverseTransferRowEffects(old: {
  from_driver_id: string | null;
  to_driver_id: string | null;
  currency: string;
  amount: number;
  comment: string | null;
}): Promise<string | null> {
  const currency = old.currency;
  const amount = Number(old.amount);
  const fromId = old.from_driver_id;
  const toId = old.to_driver_id;
  if (!fromId || !toId) return null;

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
    const { error: e1 } = await supabase.from("pre_balances").upsert({ user_id: fromId, [col1]: curFrom + amount }, { onConflict: "user_id" });
    if (e1) return e1.message;
    if (convertedAmount !== null && convertedAmount > 0) {
      const { error: e2 } = await supabase.from("pre_balances").upsert({ user_id: fromId, [col2]: curTo - convertedAmount }, { onConflict: "user_id" });
      if (e2) return e2.message;
    }
  } else {
    const col = currencyToCol(currency as Currency);
    const { data: preBal } = await supabase.from("pre_balances").select("*").eq("user_id", fromId).maybeSingle();
    const preVal = preBal ? Number(preBal[col]) || 0 : 0;
    const { error: e1 } = await supabase.from("pre_balances").upsert({ user_id: fromId, [col]: preVal + amount }, { onConflict: "user_id" });
    if (e1) return e1.message;

    const { data: balRow } = await supabase.from("balances").select("*").eq("user_id", toId).maybeSingle();
    const balVal = balRow ? Number(balRow[col]) || 0 : 0;
    const { error: e2 } = await supabase.from("balances").upsert({ user_id: toId, [col]: balVal - amount }, { onConflict: "user_id" });
    if (e2) return e2.message;
  }
  return null;
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

function isCurrency(value: string): value is Currency {
  return CURRENCY_COLS.includes(value.toLowerCase() as CurrencyCol);
}

function normalizeWalletType(value: string): WalletType {
  return value === "pre_balance" ? "pre_balance" : "balance";
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
    const { data, error } = await supabase.from("categories").select("*");
    if (error) return fail(error.message);

    const categories: CategoryInfo[] = sortCategories((data || []).map((c) => ({
      name: c.name,
      noReceipt: !!c.no_receipt,
      visibleTo: (c.visible_to === "driver" || c.visible_to === "balance" ? c.visible_to : "both") as CategoryInfo["visibleTo"],
      sortOrder: c.sort_order == null ? null : Number(c.sort_order),
    })));
    return ok({ categories });
  },

  // ==================== CATEGORIES ====================
  saveCategory: async (
    name: string,
    noReceipt: boolean,
    visibleTo?: "driver" | "balance" | "both",
    sortOrder?: number | null,
  ) => {
    const { error } = await supabase.from("categories").insert({
      name: name.trim(),
      no_receipt: noReceipt,
      visible_to: visibleTo || "both",
      sort_order: sortOrder ?? null,
    });
    if (error) {
      if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
        if (/sort_order/i.test(error.message)) {
          return fail("Такой порядковый номер уже занят другой категорией");
        }
        return fail("Категория уже существует");
      }
      return fail(error.message);
    }
    return ok(null);
  },

  updateCategory: async (
    oldName: string,
    newName: string,
    noReceipt: boolean,
    visibleTo?: "driver" | "balance" | "both",
    sortOrder?: number | null,
  ) => {
    const { error } = await supabase
      .from("categories")
      .update({
        name: newName.trim(),
        no_receipt: noReceipt,
        visible_to: visibleTo || "both",
        sort_order: sortOrder ?? null,
      })
      .eq("name", oldName.trim());
    if (error) {
      if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
        if (/sort_order/i.test(error.message)) {
          return fail("Такой порядковый номер уже занят другой категорией");
        }
        return fail(error.message);
      }
      return fail(error.message);
    }
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

  adjustWalletAmount: async (
    driverId: string,
    walletType: WalletType,
    currency: Currency,
    amount: number,
    performedBy?: string,
    comment?: string,
  ) => {
    const { error } = await supabase.rpc("exec_adjust_wallet_amount", {
      p_user: driverId,
      p_wallet_type: walletType,
      p_currency: currency,
      p_new_amount: amount,
      p_performed_by: performedBy ?? "",
      p_comment: comment ?? "",
    });
    if (error) return fail(error.message);
    return ok(null);
  },

  getDriverLedger: async (
    driverId: string,
    since: string,
    until: string,
  ): Promise<ApiResponse<DriverLedgerData>> => {
    const [{ data: openingRows, error: openingErr }, { data: ledgerRows, error: ledgerErr }] = await Promise.all([
      supabase.rpc("get_driver_ledger_opening", {
        p_user: driverId,
        p_at: since,
      }),
      supabase.rpc("get_driver_ledger_rows", {
        p_user: driverId,
        p_since: since,
        p_until: until,
      }),
    ]);

    if (openingErr) return fail(openingErr.message);
    if (ledgerErr) return fail(ledgerErr.message);

    const openings: DriverLedgerOpening[] = (openingRows || [])
      .filter((row) => isCurrency(String(row.currency || "")))
      .map((row) => ({
        walletType: normalizeWalletType(String(row.wallet_type || "")),
        currency: String(row.currency).toUpperCase() as Currency,
        amount: Number(row.amount) || 0,
      }));

    for (const walletType of ["balance", "pre_balance"] as const) {
      for (const currency of ["KZT", "RUB", "UZS", "CNY", "EUR"] as const) {
        if (!openings.some((item) => item.walletType === walletType && item.currency === currency)) {
          openings.push({ walletType, currency, amount: 0 });
        }
      }
    }

    const running = new Map<string, number>();
    for (const item of openings) {
      running.set(`${item.walletType}:${item.currency}`, item.amount);
    }

    const rows: DriverLedgerRow[] = [];
    for (const row of ledgerRows || []) {
      const currency = String(row.currency || "").toUpperCase();
      if (!isCurrency(currency)) continue;
      const walletType = normalizeWalletType(String(row.wallet_type || ""));
      const key = `${walletType}:${currency}`;
      const next = (running.get(key) || 0) + (Number(row.delta) || 0);
      running.set(key, next);
      rows.push({
        rowKey: String(row.row_key || ""),
        eventId: String(row.event_id || ""),
        eventTime: String(row.event_time || ""),
        sourceType: (String(row.source_type || "") as DriverLedgerRow["sourceType"]) || "expense",
        operationType: String(row.operation_type || ""),
        walletType,
        currency,
        delta: Number(row.delta) || 0,
        title: String(row.title || ""),
        description: String(row.description || ""),
        performedBy: String(row.performed_by || ""),
        relatedCurrency: isCurrency(String(row.related_currency || "").toUpperCase())
          ? (String(row.related_currency || "").toUpperCase() as Currency)
          : undefined,
        relatedAmount: row.related_amount == null ? undefined : Number(row.related_amount),
        balanceAfter: next,
      });
    }

    const summaryMap = new Map<string, DriverLedgerSummaryItem>();
    for (const item of openings) {
      summaryMap.set(`${item.walletType}:${item.currency}`, {
        walletType: item.walletType,
        currency: item.currency,
        opening: item.amount,
        inflow: 0,
        outflow: 0,
        closing: item.amount,
      });
    }

    for (const row of rows) {
      const key = `${row.walletType}:${row.currency}`;
      const current = summaryMap.get(key) ?? {
        walletType: row.walletType,
        currency: row.currency,
        opening: 0,
        inflow: 0,
        outflow: 0,
        closing: 0,
      };
      if (row.delta >= 0) current.inflow += row.delta;
      else current.outflow += Math.abs(row.delta);
      current.closing = row.balanceAfter;
      summaryMap.set(key, current);
    }

    return ok({
      openings,
      rows,
      summary: [...summaryMap.values()].sort((a, b) => {
        if (a.walletType !== b.walletType) return a.walletType.localeCompare(b.walletType);
        return a.currency.localeCompare(b.currency);
      }),
    });
  },

  // ==================== TRANSFERS ====================
  transfer: async (fromDriverId: string, toDriverId: string, currency: Currency, amount: number, performedBy: string, comment?: string, allowNegative?: boolean) => {
    const { data: preBal, error: preSelErr } = await supabase.from("pre_balances").select("*").eq("user_id", fromDriverId).maybeSingle();
    if (preSelErr) return fail(preSelErr.message);
    const col = currencyToCol(currency);
    const currentPre = preBal ? Number(preBal[col]) || 0 : 0;

    if (!allowNegative && currentPre < amount) {
      return fail("Недостаточно средств на предбалансе");
    }

    let performerName = performedBy;
    if (performedBy) {
      const { data: pUser } = await supabase.from("users").select("name").eq("id", performedBy).maybeSingle();
      if (pUser) performerName = pUser.name;
    }

    const { error: rpcErr } = await supabase.rpc("exec_transfer_pre_to_balance", {
      p_from: fromDriverId,
      p_to: toDriverId,
      p_currency: currency,
      p_amount: amount,
      p_performed_by: performerName,
      p_comment: comment ?? "",
      p_allow_negative: !!allowNegative,
    });
    if (rpcErr) return fail(rpcErr.message);

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

    const revErr = await reverseTransferRowEffects(old);
    if (revErr) return fail(revErr);

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
      const { error: convUpsertErr } = await supabase.from("pre_balances").upsert(
        {
          user_id: transfer.fromDriverId,
          [fromCol]: currentFrom - transfer.amount,
          [toCol]: currentTo + convertedAmount,
        },
        { onConflict: "user_id" },
      );
      if (convUpsertErr) return fail(convUpsertErr.message);

      let commentFinal = String(transfer.comment ?? "").trim();
      if (!commentFinal) {
        commentFinal = `Конвертация: ${transfer.amount} ${fromCur} → ${convertedAmount} ${toCur} (курс ${rate})`;
      }
      const { error: updErr } = await supabase
        .from("transfers")
        .update({
          from_driver_id: transfer.fromDriverId,
          to_driver_id: transfer.toDriverId,
          currency: transfer.currency,
          amount: transfer.amount,
          comment: commentFinal,
        })
        .eq("id", transfer.id);
      if (updErr) return fail(updErr.message);

      return ok(null);
    }

    const newCol = currencyToCol(transfer.currency as Currency);

    const { data: newPreFrom } = await supabase.from("pre_balances").select("*").eq("user_id", transfer.fromDriverId).maybeSingle();
    const newPreVal = newPreFrom ? Number(newPreFrom[newCol]) || 0 : 0;
    const { error: preErr } = await supabase
      .from("pre_balances")
      .upsert({ user_id: transfer.fromDriverId, [newCol]: newPreVal - transfer.amount }, { onConflict: "user_id" });
    if (preErr) return fail(preErr.message);

    const { data: newBalTo } = await supabase.from("balances").select("*").eq("user_id", transfer.toDriverId).maybeSingle();
    const newBalVal = newBalTo ? Number(newBalTo[newCol]) || 0 : 0;
    const { error: balErr } = await supabase
      .from("balances")
      .upsert({ user_id: transfer.toDriverId, [newCol]: newBalVal + transfer.amount }, { onConflict: "user_id" });
    if (balErr) return fail(balErr.message);

    const { error: trErr } = await supabase
      .from("transfers")
      .update({
        from_driver_id: transfer.fromDriverId,
        to_driver_id: transfer.toDriverId,
        currency: transfer.currency,
        amount: transfer.amount,
        comment: transfer.comment ?? "",
      })
      .eq("id", transfer.id);
    if (trErr) return fail(trErr.message);

    return ok(null);
  },

  deleteTransfer: async (transferId: string) => {
    const { data: old } = await supabase.from("transfers").select("*").eq("id", transferId).maybeSingle();
    if (!old) return fail("Перевод не найден");

    const revErr = await reverseTransferRowEffects(old);
    if (revErr) return fail(revErr);
    const { error: delErr } = await supabase.from("transfers").delete().eq("id", transferId);
    if (delErr) return fail(delErr.message);
    return ok(null);
  },

  convertPreBalance: async (driverId: string, fromCurrency: Currency, toCurrency: Currency, amount: number, rate: number, performedBy: string) => {
    if (fromCurrency === toCurrency) return fail("Валюты должны отличаться");
    if (!(amount > 0) || !(rate > 0)) return fail("Сумма и курс должны быть > 0");

    const convertedAmount = computeConvertedAmount(fromCurrency, toCurrency, amount, rate);

    let performerName = performedBy;
    if (performedBy) {
      const { data: pUser } = await supabase.from("users").select("name").eq("id", performedBy).maybeSingle();
      if (pUser) performerName = pUser.name;
    }

    const convComment = `Конвертация: ${amount} ${fromCurrency} → ${convertedAmount} ${toCurrency} (курс ${rate})`;
    const { error: rpcErr } = await supabase.rpc("exec_convert_pre_balance", {
      p_user: driverId,
      p_from: fromCurrency,
      p_to: toCurrency,
      p_amount: amount,
      p_converted: convertedAmount,
      p_currency_label: `${fromCurrency}→${toCurrency}`,
      p_performed_by: performerName,
      p_comment: convComment,
    });
    if (rpcErr) return fail(rpcErr.message);

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

    const { data: expenseId, error } = await supabase.rpc("exec_add_expense_with_effects", {
      p_user: expense.driverId,
      p_date: expense.date,
      p_category: expense.category,
      p_amount: expense.amount,
      p_currency: expense.currency,
      p_comment: expense.comment,
      p_receipt_url: expense.receiptUrl,
      p_performed_by: performedByName ?? "",
      p_truck: truckName,
    });

    if (error) return fail(error.message);

    return ok({
      id: String(expenseId ?? ""),
      driverId: expense.driverId,
      date: expense.date,
      category: expense.category,
      amount: expense.amount,
      currency: expense.currency,
      comment: expense.comment || "",
      receiptUrl: expense.receiptUrl || "",
      performedBy: performedByName || "",
      truck: truckName || "",
    } as Expense);
  },

  updateExpense: async (expense: Expense) => {
    const { error } = await supabase.rpc("exec_update_expense_with_effects", {
      p_expense_id: expense.id,
      p_date: expense.date,
      p_category: expense.category,
      p_amount: expense.amount,
      p_currency: expense.currency,
      p_comment: expense.comment,
      p_receipt_url: expense.receiptUrl,
      p_performed_by: expense.performedBy || "",
      p_truck: expense.truck || "",
    });
    if (error) return fail(error.message);
    return ok(null);
  },

  deleteExpense: async (expenseId: string) => {
    const { error } = await supabase.rpc("exec_delete_expense_with_effects", {
      p_expense_id: expenseId,
    });
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
