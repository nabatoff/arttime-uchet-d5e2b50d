# -*- coding: utf-8 -*-
"""Генерация SQL импорта из Google Sheets CSV (маппинг legacy userId → uuid как в users)."""
from __future__ import annotations

import csv
import uuid
from pathlib import Path

NS = uuid.UUID("a1b2c3d4-e5f6-5a5b-8c9d-0e1f2a3b4c5d")
DOWNLOADS = Path(r"c:\Users\15bit\Downloads")
TZ = "Asia/Almaty"


def map_user_id(raw: str) -> str | None:
    s = (raw or "").strip()
    if not s:
        return None
    if s.isdigit():
        return str(uuid.uuid5(NS, s))
    try:
        u = uuid.UUID(s)
        return str(u)
    except ValueError:
        raise ValueError(f"Неизвестный userId: {raw!r}")


def sql_str(s: str | None) -> str:
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def sql_num(s: str) -> str:
    s = (s or "").strip().replace(",", ".")
    if not s:
        return "0"
    return s


def parse_ts(cell: str) -> str:
    """SQL выражение timestamptz из DD.MM.YYYY H:MM:SS."""
    c = (cell or "").strip()
    if not c:
        raise ValueError("empty date")
    return f"(to_timestamp({sql_str(c)}, 'DD.MM.YYYY HH24:MI:SS') AT TIME ZONE {sql_str(TZ)})"


def main() -> None:
    lines: list[str] = []
    add = lines.append

    add("BEGIN;")
    add("SET LOCAL statement_timeout = '600s';")
    add("-- очистка импортируемых таблиц (порядок без нарушения FK)")
    add("DELETE FROM public.transfers;")
    add("DELETE FROM public.expenses;")
    add("DELETE FROM public.mileage;")
    add("DELETE FROM public.categories;")

    # Categories
    cat_path = DOWNLOADS / "Учет расходов ArtTime - Categories.csv"
    with open(cat_path, encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            name = (row.get("name") or "").strip()
            if not name:
                continue
            nr = (row.get("noReceipt") or "").strip().upper()
            no_receipt = "true" if nr == "TRUE" else "false"
            vt = (row.get("visibleTo") or "").strip()
            if not vt:
                vt = "both"
            add(
                f"INSERT INTO public.categories (name, no_receipt, visible_to) VALUES "
                f"({sql_str(name)}, {no_receipt}, {sql_str(vt)}) ON CONFLICT (name) DO NOTHING;"
            )

    # Balances
    bal_path = DOWNLOADS / "Учет расходов ArtTime - Balances.csv"
    with open(bal_path, encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            uid_raw = (row.get("userId") or "").strip()
            try:
                uid = map_user_id(uid_raw)
            except ValueError as e:
                add(f"-- SKIP balances {uid_raw}: {e}")
                continue
            if not uid:
                continue
            add(
                f"UPDATE public.balances SET kzt = {sql_num(row.get('KZT'))}, "
                f"rub = {sql_num(row.get('RUB'))}, uzs = {sql_num(row.get('UZS'))}, "
                f"cny = {sql_num(row.get('CNY'))}, eur = {sql_num(row.get('EUR'))} "
                f"WHERE user_id = '{uid}'::uuid;"
            )

    # PreBalances
    pre_path = DOWNLOADS / "Учет расходов ArtTime - PreBalances.csv"
    with open(pre_path, encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            uid_raw = (row.get("userId") or "").strip()
            try:
                uid = map_user_id(uid_raw)
            except ValueError as e:
                add(f"-- SKIP pre_balances {uid_raw}: {e}")
                continue
            if not uid:
                continue
            add(
                f"UPDATE public.pre_balances SET kzt = {sql_num(row.get('KZT'))}, "
                f"rub = {sql_num(row.get('RUB'))}, uzs = {sql_num(row.get('UZS'))}, "
                f"cny = {sql_num(row.get('CNY'))}, eur = {sql_num(row.get('EUR'))} "
                f"WHERE user_id = '{uid}'::uuid;"
            )

    # Mileage
    mile_path = DOWNLOADS / "Учет расходов ArtTime - Mileage.csv"
    with open(mile_path, encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            eid = (row.get("id") or "").strip()
            uid_raw = (row.get("userId") or "").strip()
            uid = map_user_id(uid_raw)
            dt = parse_ts(row.get("date") or "")
            km = sql_num(row.get("km_value"))
            photo = sql_str(row.get("photo_url") or "")
            truck = sql_str(row.get("truck") or "")
            add(
                f"INSERT INTO public.mileage (id, user_id, date, km, photo_url, truck) VALUES "
                f"('{eid}'::uuid, '{uid}'::uuid, {dt}, {km}, COALESCE({photo}, ''), COALESCE({truck}, ''));"
            )

    # Expenses
    exp_path = DOWNLOADS / "Учет расходов ArtTime - Expenses.csv"
    with open(exp_path, encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            eid = (row.get("id") or "").strip()
            uid = map_user_id((row.get("userId") or "").strip())
            dt = parse_ts(row.get("date") or "")
            cat = sql_str(row.get("category") or "")
            amt = sql_num(row.get("amount"))
            cur = sql_str(row.get("currency") or "KZT")
            comment = sql_str(row.get("comment") or "")
            receipt = sql_str(row.get("receipt_url") or "")
            perf = sql_str(row.get("performedBy") or "")
            truck = sql_str(row.get("truck") or "")
            add(
                f"INSERT INTO public.expenses (id, user_id, date, category, amount, currency, "
                f"comment, receipt_url, performed_by, truck) VALUES ("
                f"'{eid}'::uuid, '{uid}'::uuid, {dt}, {cat}, {amt}, {cur}, "
                f"COALESCE({comment}, ''), COALESCE({receipt}, ''), COALESCE({perf}, ''), COALESCE({truck}, ''));"
            )

    # Transfers
    tr_path = DOWNLOADS / "Учет расходов ArtTime - Transfers.csv"
    with open(tr_path, encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            tid = (row.get("id") or "").strip()
            fid = map_user_id((row.get("fromDriverId") or "").strip())
            tid_u = map_user_id((row.get("toDriverId") or "").strip())
            cur = sql_str(row.get("currency") or "")
            amt = sql_num(row.get("amount"))
            dt = parse_ts(row.get("date") or "")
            perf = sql_str(row.get("performedBy") or "")
            comment = sql_str(row.get("comment") or "")
            add(
                f"INSERT INTO public.transfers (id, from_driver_id, to_driver_id, currency, amount, date, performed_by, comment) VALUES ("
                f"'{tid}'::uuid, '{fid}'::uuid, '{tid_u}'::uuid, {cur}, {amt}, {dt}, COALESCE({perf}, ''), COALESCE({comment}, ''));"
            )

    add("COMMIT;")

    out = Path(__file__).resolve().parent / "google_sheets_import.sql"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out} ({len(lines)} lines)")


if __name__ == "__main__":
    main()
