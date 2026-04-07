/**
 * Сверка pre_balances / balances с суммарным эффектом transfers + expenses.
 * Жандос (60765) — «касса»: стартовые остатки не из журнала, по KZT/RUB/CNY полная
 * симуляция с нуля не совпадёт; по остальным пользователям расхождений быть не должно.
 *
 * Запуск из корня проекта (подставь URL и anon key из .env или src/integrations/supabase/client.ts):
 *   set SUPABASE_URL=... && set SUPABASE_ANON_KEY=... && node scripts/reconcile-balances.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^VITE_SUPABASE_(URL|ANON_KEY)=(.*)$/);
    if (m) process.env[`SUPABASE_${m[1] === "URL" ? "URL" : "ANON_KEY"}`] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!URL || !KEY) {
  console.error("Задай SUPABASE_URL и SUPABASE_ANON_KEY (или VITE_* в .env).");
  process.exit(1);
}

const CURRS = ["KZT", "RUB", "UZS", "CNY", "EUR"];
const MAIN_TREASURER = "60765e20-eff2-5ce6-983e-33fb469fb691";

const supabase = createClient(URL, KEY);

function emptyWallet() {
  return { KZT: 0, RUB: 0, UZS: 0, CNY: 0, EUR: 0 };
}

function ensure(map, id) {
  if (!id) return null;
  const s = String(id);
  if (!map.has(s)) map.set(s, emptyWallet());
  return map.get(s);
}

function parseConverted(comment) {
  const m = String(comment || "").match(/→\s*([\d.,]+)/);
  return m ? Number(String(m[1]).replace(",", ".")) : null;
}

function normCur(c) {
  return String(c || "").trim().toUpperCase();
}

async function main() {
  const apply = process.argv.includes("--apply");

  const { data: transfers, error: te } = await supabase.from("transfers").select("*").order("date", { ascending: true });
  if (te) throw te;

  const { data: expenses, error: ee } = await supabase.from("expenses").select("user_id, currency, amount");
  if (ee) throw ee;

  const { data: preRows, error: pe } = await supabase.from("pre_balances").select("*");
  if (pe) throw pe;

  const { data: balRows, error: be } = await supabase.from("balances").select("*");
  if (be) throw be;

  const simPre = new Map();
  const simBal = new Map();

  for (const t of transfers || []) {
    const from = t.from_driver_id;
    const to = t.to_driver_id;
    const curRaw = t.currency;
    const amt = Number(t.amount);
    if (!from || !to || !(amt > 0)) continue;

    if (String(from) === String(to) && String(curRaw).includes("→")) {
      const parts = String(curRaw)
        .split("→")
        .map((s) => s.trim());
      const fromC = normCur(parts[0]);
      const toC = normCur(parts[1]);
      const conv = parseConverted(t.comment);
      if (!fromC || !toC || conv == null || !(conv > 0)) {
        console.warn("skip bad conversion row", t.id, curRaw);
        continue;
      }
      const pw = ensure(simPre, from);
      pw[fromC] -= amt;
      pw[toC] += conv;
    } else {
      const c = normCur(curRaw);
      if (!CURRS.includes(c)) {
        console.warn("unknown currency", c, t.id);
        continue;
      }
      ensure(simPre, from)[c] -= amt;
      ensure(simBal, to)[c] += amt;
    }
  }

  for (const e of expenses || []) {
    const uid = e.user_id;
    const c = normCur(e.currency);
    if (!uid || !CURRS.includes(c)) continue;
    ensure(simBal, uid)[c] -= Number(e.amount);
  }

  const allIds = new Set([
    ...simPre.keys(),
    ...simBal.keys(),
    ...(preRows || []).map((r) => String(r.user_id)),
    ...(balRows || []).map((r) => String(r.user_id)),
  ]);

  const colMap = { KZT: "kzt", RUB: "rub", UZS: "uzs", CNY: "cny", EUR: "eur" };
  const round2 = (n) => Math.round(Number(n) * 100) / 100;

  const fixes = [];

  for (const uid of allIds) {
    const expPre = simPre.get(uid) || emptyWallet();
    const expBal = simBal.get(uid) || emptyWallet();
    const preRow = (preRows || []).find((r) => String(r.user_id) === uid);
    const balRow = (balRows || []).find((r) => String(r.user_id) === uid);

    for (const c of CURRS) {
      const col = colMap[c];
      const actPre = preRow ? round2(preRow[col]) : 0;
      const actBal = balRow ? round2(balRow[col]) : 0;
      const ePre = round2(expPre[c]);
      const eBal = round2(expBal[c]);
      if (uid === MAIN_TREASURER) continue;
      if (actPre !== ePre) fixes.push({ kind: "pre", uid, col, c, actual: actPre, expected: ePre, delta: round2(ePre - actPre) });
      if (actBal !== eBal) fixes.push({ kind: "bal", uid, col, c, actual: actBal, expected: eBal, delta: round2(eBal - actBal) });
    }
  }

  console.log("Расхождения (все пользователи, кроме кассы 60765):");
  if (fixes.length === 0) console.log("  нет");
  else for (const f of fixes) console.log(`  ${f.kind} ${f.uid} ${f.c}: факт=${f.actual} ожид=${f.expected} Δ=${f.delta}`);

  const p60765 = (preRows || []).find((r) => String(r.user_id) === MAIN_TREASURER);
  const b60765 = (balRows || []).find((r) => String(r.user_id) === MAIN_TREASURER);
  if (p60765) console.log("\nКасса 60765 pre EUR (факт):", round2(p60765.eur), "— сверяйте вручную с журналом; KZT/RUB/CNY не сравниваются с нулевой симуляцией.");

  if (!apply) {
    console.log("\nДобавь --apply чтобы записать ожидаемые значения (только для строк из списка выше).");
    return;
  }

  for (const f of fixes) {
    const table = f.kind === "pre" ? "pre_balances" : "balances";
    const row = f.kind === "pre" ? (preRows || []).find((r) => String(r.user_id) === f.uid) : (balRows || []).find((r) => String(r.user_id) === f.uid);
    if (!row) {
      console.warn("no row for", f.uid, table);
      continue;
    }
    const patch = { user_id: f.uid, [f.col]: f.expected };
    const { error } = await supabase.from(table).upsert(patch, { onConflict: "user_id" });
    if (error) console.error("upsert fail", f, error.message);
    else console.log("fixed", table, f.uid, f.col, "=", f.expected);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
