CREATE OR REPLACE FUNCTION public.apply_expense_effect(
  p_user uuid,
  p_category text,
  p_currency text,
  p_amount numeric,
  p_effect_sign integer
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cur text := lower(trim(p_currency));
  n int;
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'user is required';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF p_effect_sign NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'invalid effect sign';
  END IF;
  IF cur NOT IN ('kzt', 'rub', 'uzs', 'cny', 'eur') THEN
    RAISE EXCEPTION 'invalid currency';
  END IF;

  IF coalesce(trim(p_category), '') = 'Пополнение' THEN
    UPDATE public.pre_balances pb
    SET
      kzt = pb.kzt + CASE WHEN cur = 'kzt' THEN p_effect_sign * p_amount ELSE 0 END,
      rub = pb.rub + CASE WHEN cur = 'rub' THEN p_effect_sign * p_amount ELSE 0 END,
      uzs = pb.uzs + CASE WHEN cur = 'uzs' THEN p_effect_sign * p_amount ELSE 0 END,
      cny = pb.cny + CASE WHEN cur = 'cny' THEN p_effect_sign * p_amount ELSE 0 END,
      eur = pb.eur + CASE WHEN cur = 'eur' THEN p_effect_sign * p_amount ELSE 0 END
    WHERE pb.user_id = p_user;

    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN
      RAISE EXCEPTION 'pre_balance row not found';
    END IF;
  ELSE
    UPDATE public.balances b
    SET
      kzt = b.kzt - CASE WHEN cur = 'kzt' THEN p_effect_sign * p_amount ELSE 0 END,
      rub = b.rub - CASE WHEN cur = 'rub' THEN p_effect_sign * p_amount ELSE 0 END,
      uzs = b.uzs - CASE WHEN cur = 'uzs' THEN p_effect_sign * p_amount ELSE 0 END,
      cny = b.cny - CASE WHEN cur = 'cny' THEN p_effect_sign * p_amount ELSE 0 END,
      eur = b.eur - CASE WHEN cur = 'eur' THEN p_effect_sign * p_amount ELSE 0 END
    WHERE b.user_id = p_user;

    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN
      RAISE EXCEPTION 'balance row not found';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.exec_add_expense_with_effects(
  p_user uuid,
  p_date timestamptz,
  p_category text,
  p_amount numeric,
  p_currency text,
  p_comment text DEFAULT '',
  p_receipt_url text DEFAULT '',
  p_performed_by text DEFAULT '',
  p_truck text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  PERFORM public.apply_expense_effect(p_user, p_category, p_currency, p_amount, 1);

  INSERT INTO public.expenses (
    user_id,
    date,
    category,
    amount,
    currency,
    comment,
    receipt_url,
    performed_by,
    truck
  )
  VALUES (
    p_user,
    coalesce(p_date, now()),
    trim(p_category),
    p_amount,
    upper(trim(p_currency)),
    coalesce(p_comment, ''),
    coalesce(p_receipt_url, ''),
    coalesce(p_performed_by, ''),
    coalesce(p_truck, '')
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.exec_update_expense_with_effects(
  p_expense_id uuid,
  p_date timestamptz,
  p_category text,
  p_amount numeric,
  p_currency text,
  p_comment text DEFAULT '',
  p_receipt_url text DEFAULT '',
  p_performed_by text DEFAULT '',
  p_truck text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  old_row public.expenses%ROWTYPE;
BEGIN
  SELECT *
  INTO old_row
  FROM public.expenses
  WHERE id = p_expense_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'expense not found';
  END IF;

  PERFORM public.apply_expense_effect(old_row.user_id, old_row.category, old_row.currency, old_row.amount, -1);
  PERFORM public.apply_expense_effect(old_row.user_id, p_category, p_currency, p_amount, 1);

  UPDATE public.expenses
  SET
    date = coalesce(p_date, old_row.date),
    category = trim(p_category),
    amount = p_amount,
    currency = upper(trim(p_currency)),
    comment = coalesce(p_comment, ''),
    receipt_url = coalesce(p_receipt_url, ''),
    performed_by = coalesce(p_performed_by, ''),
    truck = coalesce(p_truck, '')
  WHERE id = p_expense_id;

  RETURN p_expense_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.exec_delete_expense_with_effects(
  p_expense_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  old_row public.expenses%ROWTYPE;
BEGIN
  SELECT *
  INTO old_row
  FROM public.expenses
  WHERE id = p_expense_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'expense not found';
  END IF;

  PERFORM public.apply_expense_effect(old_row.user_id, old_row.category, old_row.currency, old_row.amount, -1);

  DELETE FROM public.expenses
  WHERE id = p_expense_id;

  RETURN p_expense_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_add_expense_with_effects(uuid, timestamptz, text, numeric, text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.exec_update_expense_with_effects(uuid, timestamptz, text, numeric, text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.exec_delete_expense_with_effects(uuid) TO anon, authenticated, service_role;
