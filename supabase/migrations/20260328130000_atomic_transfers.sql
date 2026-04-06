-- Атомарные переводы предбаланс→баланс и конвертация без гонки read-modify-write.
-- Одна транзакция: обновление счетов + строка в transfers.

CREATE OR REPLACE FUNCTION public.exec_transfer_pre_to_balance(
  p_from uuid,
  p_to uuid,
  p_currency text,
  p_amount numeric,
  p_performed_by text DEFAULT '',
  p_comment text DEFAULT '',
  p_allow_negative boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur text := lower(trim(p_currency));
  new_id uuid;
  n int;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF cur NOT IN ('kzt', 'rub', 'uzs', 'cny', 'eur') THEN
    RAISE EXCEPTION 'invalid currency';
  END IF;

  UPDATE public.pre_balances pb SET
    kzt = pb.kzt - CASE WHEN cur = 'kzt' THEN p_amount ELSE 0 END,
    rub = pb.rub - CASE WHEN cur = 'rub' THEN p_amount ELSE 0 END,
    uzs = pb.uzs - CASE WHEN cur = 'uzs' THEN p_amount ELSE 0 END,
    cny = pb.cny - CASE WHEN cur = 'cny' THEN p_amount ELSE 0 END,
    eur = pb.eur - CASE WHEN cur = 'eur' THEN p_amount ELSE 0 END
  WHERE pb.user_id = p_from
    AND (
      p_allow_negative
      OR (cur = 'kzt' AND pb.kzt >= p_amount)
      OR (cur = 'rub' AND pb.rub >= p_amount)
      OR (cur = 'uzs' AND pb.uzs >= p_amount)
      OR (cur = 'cny' AND pb.cny >= p_amount)
      OR (cur = 'eur' AND pb.eur >= p_amount)
    );

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    IF p_allow_negative THEN
      RAISE EXCEPTION 'Запись предбаланса отправителя не найдена';
    ELSE
      RAISE EXCEPTION 'Недостаточно средств на предбалансе';
    END IF;
  END IF;

  UPDATE public.balances b SET
    kzt = b.kzt + CASE WHEN cur = 'kzt' THEN p_amount ELSE 0 END,
    rub = b.rub + CASE WHEN cur = 'rub' THEN p_amount ELSE 0 END,
    uzs = b.uzs + CASE WHEN cur = 'uzs' THEN p_amount ELSE 0 END,
    cny = b.cny + CASE WHEN cur = 'cny' THEN p_amount ELSE 0 END,
    eur = b.eur + CASE WHEN cur = 'eur' THEN p_amount ELSE 0 END
  WHERE b.user_id = p_to;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'Запись баланса получателя не найдена';
  END IF;

  INSERT INTO public.transfers (from_driver_id, to_driver_id, currency, amount, performed_by, comment)
  VALUES (p_from, p_to, trim(p_currency), p_amount, COALESCE(p_performed_by, ''), COALESCE(p_comment, ''))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.exec_convert_pre_balance(
  p_user uuid,
  p_from text,
  p_to text,
  p_amount numeric,
  p_converted numeric,
  p_currency_label text,
  p_performed_by text DEFAULT '',
  p_comment text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lc_from text := lower(trim(p_from));
  lc_to text := lower(trim(p_to));
  new_id uuid;
  n int;
BEGIN
  IF lc_from = lc_to THEN
    RAISE EXCEPTION 'same currency';
  END IF;
  IF lc_from NOT IN ('kzt', 'rub', 'uzs', 'cny', 'eur') OR lc_to NOT IN ('kzt', 'rub', 'uzs', 'cny', 'eur') THEN
    RAISE EXCEPTION 'invalid currency';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_converted IS NULL OR p_converted <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  UPDATE public.pre_balances pb SET
    kzt = pb.kzt - CASE WHEN lc_from = 'kzt' THEN p_amount ELSE 0 END + CASE WHEN lc_to = 'kzt' THEN p_converted ELSE 0 END,
    rub = pb.rub - CASE WHEN lc_from = 'rub' THEN p_amount ELSE 0 END + CASE WHEN lc_to = 'rub' THEN p_converted ELSE 0 END,
    uzs = pb.uzs - CASE WHEN lc_from = 'uzs' THEN p_amount ELSE 0 END + CASE WHEN lc_to = 'uzs' THEN p_converted ELSE 0 END,
    cny = pb.cny - CASE WHEN lc_from = 'cny' THEN p_amount ELSE 0 END + CASE WHEN lc_to = 'cny' THEN p_converted ELSE 0 END,
    eur = pb.eur - CASE WHEN lc_from = 'eur' THEN p_amount ELSE 0 END + CASE WHEN lc_to = 'eur' THEN p_converted ELSE 0 END
  WHERE pb.user_id = p_user
    AND (
      (lc_from = 'kzt' AND pb.kzt >= p_amount)
      OR (lc_from = 'rub' AND pb.rub >= p_amount)
      OR (lc_from = 'uzs' AND pb.uzs >= p_amount)
      OR (lc_from = 'cny' AND pb.cny >= p_amount)
      OR (lc_from = 'eur' AND pb.eur >= p_amount)
    );

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'Недостаточно средств на предбалансе или запись не найдена';
  END IF;

  INSERT INTO public.transfers (from_driver_id, to_driver_id, currency, amount, performed_by, comment)
  VALUES (p_user, p_user, trim(p_currency_label), p_amount, COALESCE(p_performed_by, ''), COALESCE(p_comment, ''))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_transfer_pre_to_balance(uuid, uuid, text, numeric, text, text, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.exec_convert_pre_balance(uuid, text, text, numeric, numeric, text, text, text) TO anon, authenticated, service_role;
