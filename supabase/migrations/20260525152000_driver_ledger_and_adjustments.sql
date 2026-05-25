CREATE TABLE IF NOT EXISTS public.wallet_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_type text NOT NULL CHECK (wallet_type IN ('balance', 'pre_balance')),
  currency text NOT NULL CHECK (currency IN ('KZT', 'RUB', 'UZS', 'CNY', 'EUR')),
  previous_amount numeric NOT NULL,
  new_amount numeric NOT NULL,
  delta numeric NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  performed_by text DEFAULT '',
  comment text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_wallet_adjustments_user_date
  ON public.wallet_adjustments(user_id, date);

ALTER TABLE public.wallet_adjustments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'wallet_adjustments'
      AND policyname = 'allow_all'
  ) THEN
    CREATE POLICY "allow_all"
      ON public.wallet_adjustments
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.exec_adjust_wallet_amount(
  p_user uuid,
  p_wallet_type text,
  p_currency text,
  p_new_amount numeric,
  p_performed_by text DEFAULT '',
  p_comment text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cur text := lower(trim(p_currency));
  wallet text := lower(trim(p_wallet_type));
  prev_amount numeric;
  adjustment_id uuid;
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'user is required';
  END IF;
  IF p_new_amount IS NULL THEN
    RAISE EXCEPTION 'new amount is required';
  END IF;
  IF wallet NOT IN ('balance', 'pre_balance') THEN
    RAISE EXCEPTION 'invalid wallet type';
  END IF;
  IF cur NOT IN ('kzt', 'rub', 'uzs', 'cny', 'eur') THEN
    RAISE EXCEPTION 'invalid currency';
  END IF;

  IF wallet = 'balance' THEN
    INSERT INTO public.balances (user_id)
    VALUES (p_user)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT CASE
      WHEN cur = 'kzt' THEN kzt
      WHEN cur = 'rub' THEN rub
      WHEN cur = 'uzs' THEN uzs
      WHEN cur = 'cny' THEN cny
      ELSE eur
    END
    INTO prev_amount
    FROM public.balances
    WHERE user_id = p_user
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'balance row not found';
    END IF;

    UPDATE public.balances
    SET
      kzt = CASE WHEN cur = 'kzt' THEN p_new_amount ELSE kzt END,
      rub = CASE WHEN cur = 'rub' THEN p_new_amount ELSE rub END,
      uzs = CASE WHEN cur = 'uzs' THEN p_new_amount ELSE uzs END,
      cny = CASE WHEN cur = 'cny' THEN p_new_amount ELSE cny END,
      eur = CASE WHEN cur = 'eur' THEN p_new_amount ELSE eur END
    WHERE user_id = p_user;
  ELSE
    INSERT INTO public.pre_balances (user_id)
    VALUES (p_user)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT CASE
      WHEN cur = 'kzt' THEN kzt
      WHEN cur = 'rub' THEN rub
      WHEN cur = 'uzs' THEN uzs
      WHEN cur = 'cny' THEN cny
      ELSE eur
    END
    INTO prev_amount
    FROM public.pre_balances
    WHERE user_id = p_user
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'pre_balance row not found';
    END IF;

    UPDATE public.pre_balances
    SET
      kzt = CASE WHEN cur = 'kzt' THEN p_new_amount ELSE kzt END,
      rub = CASE WHEN cur = 'rub' THEN p_new_amount ELSE rub END,
      uzs = CASE WHEN cur = 'uzs' THEN p_new_amount ELSE uzs END,
      cny = CASE WHEN cur = 'cny' THEN p_new_amount ELSE cny END,
      eur = CASE WHEN cur = 'eur' THEN p_new_amount ELSE eur END
    WHERE user_id = p_user;
  END IF;

  INSERT INTO public.wallet_adjustments (
    user_id,
    wallet_type,
    currency,
    previous_amount,
    new_amount,
    delta,
    performed_by,
    comment
  )
  VALUES (
    p_user,
    wallet,
    upper(cur),
    coalesce(prev_amount, 0),
    p_new_amount,
    p_new_amount - coalesce(prev_amount, 0),
    coalesce(p_performed_by, ''),
    coalesce(p_comment, '')
  )
  RETURNING id INTO adjustment_id;

  RETURN adjustment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_driver_ledger_rows(
  p_user uuid,
  p_since timestamptz DEFAULT NULL,
  p_until timestamptz DEFAULT NULL
) RETURNS TABLE (
  row_key text,
  event_id text,
  event_time timestamptz,
  source_type text,
  operation_type text,
  wallet_type text,
  currency text,
  delta numeric,
  title text,
  description text,
  performed_by text,
  related_currency text,
  related_amount numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH expense_rows AS (
    SELECT
      e.id::text || ':' || CASE WHEN e.category = 'Пополнение' THEN 'pre' ELSE 'bal' END AS row_key,
      e.id::text AS event_id,
      e.date AS event_time,
      'expense'::text AS source_type,
      CASE WHEN e.category = 'Пополнение' THEN 'topup' ELSE 'expense' END AS operation_type,
      CASE WHEN e.category = 'Пополнение' THEN 'pre_balance' ELSE 'balance' END AS wallet_type,
      upper(e.currency) AS currency,
      CASE WHEN e.category = 'Пополнение' THEN e.amount ELSE -e.amount END AS delta,
      CASE WHEN e.category = 'Пополнение' THEN 'Пополнение' ELSE e.category END AS title,
      coalesce(e.comment, '') AS description,
      coalesce(e.performed_by, '') AS performed_by,
      NULL::text AS related_currency,
      NULL::numeric AS related_amount
    FROM public.expenses e
    WHERE e.user_id = p_user
      AND (p_since IS NULL OR e.date >= p_since)
      AND (p_until IS NULL OR e.date <= p_until)
  ),
  transfer_rows AS (
    SELECT
      t.id::text || ':pre_out' AS row_key,
      t.id::text AS event_id,
      t.date AS event_time,
      'transfer'::text AS source_type,
      'transfer_out'::text AS operation_type,
      'pre_balance'::text AS wallet_type,
      upper(t.currency) AS currency,
      -t.amount AS delta,
      CASE WHEN t.from_driver_id = t.to_driver_id THEN 'Перевод на баланс' ELSE 'Перевод' END AS title,
      CASE
        WHEN t.from_driver_id = t.to_driver_id THEN 'На свой основной баланс'
        ELSE 'Получатель: ' || coalesce(u_to.name, t.to_driver_id::text)
      END AS description,
      coalesce(t.performed_by, '') AS performed_by,
      NULL::text AS related_currency,
      NULL::numeric AS related_amount
    FROM public.transfers t
    LEFT JOIN public.users u_to ON u_to.id = t.to_driver_id
    WHERE t.currency NOT LIKE '%→%'
      AND t.from_driver_id = p_user
      AND (p_since IS NULL OR t.date >= p_since)
      AND (p_until IS NULL OR t.date <= p_until)

    UNION ALL

    SELECT
      t.id::text || ':bal_in' AS row_key,
      t.id::text AS event_id,
      t.date AS event_time,
      'transfer'::text AS source_type,
      'transfer_in'::text AS operation_type,
      'balance'::text AS wallet_type,
      upper(t.currency) AS currency,
      t.amount AS delta,
      CASE WHEN t.from_driver_id = t.to_driver_id THEN 'Зачисление на баланс' ELSE 'Поступление' END AS title,
      CASE
        WHEN t.from_driver_id = t.to_driver_id THEN 'С собственного предбаланса'
        ELSE 'Отправитель: ' || coalesce(u_from.name, t.from_driver_id::text)
      END AS description,
      coalesce(t.performed_by, '') AS performed_by,
      NULL::text AS related_currency,
      NULL::numeric AS related_amount
    FROM public.transfers t
    LEFT JOIN public.users u_from ON u_from.id = t.from_driver_id
    WHERE t.currency NOT LIKE '%→%'
      AND t.to_driver_id = p_user
      AND (p_since IS NULL OR t.date >= p_since)
      AND (p_until IS NULL OR t.date <= p_until)
  ),
  conversion_rows AS (
    SELECT
      t.id::text || ':conv_out' AS row_key,
      t.id::text AS event_id,
      t.date AS event_time,
      'conversion'::text AS source_type,
      'conversion_out'::text AS operation_type,
      'pre_balance'::text AS wallet_type,
      upper(split_part(t.currency, '→', 1)) AS currency,
      -t.amount AS delta,
      'Конвертация'::text AS title,
      coalesce(t.comment, '') AS description,
      coalesce(t.performed_by, '') AS performed_by,
      upper(split_part(t.currency, '→', 2)) AS related_currency,
      COALESCE(replace(substring(t.comment from '→\\s*([\\d.,]+)'), ',', '.')::numeric, 0) AS related_amount
    FROM public.transfers t
    WHERE t.from_driver_id = p_user
      AND t.to_driver_id = p_user
      AND t.currency LIKE '%→%'
      AND (p_since IS NULL OR t.date >= p_since)
      AND (p_until IS NULL OR t.date <= p_until)

    UNION ALL

    SELECT
      t.id::text || ':conv_in' AS row_key,
      t.id::text AS event_id,
      t.date AS event_time,
      'conversion'::text AS source_type,
      'conversion_in'::text AS operation_type,
      'pre_balance'::text AS wallet_type,
      upper(split_part(t.currency, '→', 2)) AS currency,
      COALESCE(replace(substring(t.comment from '→\\s*([\\d.,]+)'), ',', '.')::numeric, 0) AS delta,
      'Конвертация'::text AS title,
      coalesce(t.comment, '') AS description,
      coalesce(t.performed_by, '') AS performed_by,
      upper(split_part(t.currency, '→', 1)) AS related_currency,
      t.amount AS related_amount
    FROM public.transfers t
    WHERE t.from_driver_id = p_user
      AND t.to_driver_id = p_user
      AND t.currency LIKE '%→%'
      AND (p_since IS NULL OR t.date >= p_since)
      AND (p_until IS NULL OR t.date <= p_until)
  ),
  adjustment_rows AS (
    SELECT
      wa.id::text AS row_key,
      wa.id::text AS event_id,
      wa.date AS event_time,
      'adjustment'::text AS source_type,
      'adjustment'::text AS operation_type,
      wa.wallet_type,
      wa.currency,
      wa.delta,
      'Корректировка'::text AS title,
      coalesce(wa.comment, '') AS description,
      coalesce(wa.performed_by, '') AS performed_by,
      NULL::text AS related_currency,
      NULL::numeric AS related_amount
    FROM public.wallet_adjustments wa
    WHERE wa.user_id = p_user
      AND (p_since IS NULL OR wa.date >= p_since)
      AND (p_until IS NULL OR wa.date <= p_until)
  )
  SELECT *
  FROM (
    SELECT * FROM expense_rows
    UNION ALL
    SELECT * FROM transfer_rows
    UNION ALL
    SELECT * FROM conversion_rows
    UNION ALL
    SELECT * FROM adjustment_rows
  ) ledger
  ORDER BY event_time ASC, row_key ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_driver_ledger_opening(
  p_user uuid,
  p_at timestamptz
) RETURNS TABLE (
  wallet_type text,
  currency text,
  amount numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH actual AS (
    SELECT 'balance'::text AS wallet_type, 'KZT'::text AS currency, kzt::numeric AS amount
    FROM public.balances WHERE user_id = p_user
    UNION ALL
    SELECT 'balance', 'RUB', rub::numeric FROM public.balances WHERE user_id = p_user
    UNION ALL
    SELECT 'balance', 'UZS', uzs::numeric FROM public.balances WHERE user_id = p_user
    UNION ALL
    SELECT 'balance', 'CNY', cny::numeric FROM public.balances WHERE user_id = p_user
    UNION ALL
    SELECT 'balance', 'EUR', eur::numeric FROM public.balances WHERE user_id = p_user
    UNION ALL
    SELECT 'pre_balance', 'KZT', kzt::numeric FROM public.pre_balances WHERE user_id = p_user
    UNION ALL
    SELECT 'pre_balance', 'RUB', rub::numeric FROM public.pre_balances WHERE user_id = p_user
    UNION ALL
    SELECT 'pre_balance', 'UZS', uzs::numeric FROM public.pre_balances WHERE user_id = p_user
    UNION ALL
    SELECT 'pre_balance', 'CNY', cny::numeric FROM public.pre_balances WHERE user_id = p_user
    UNION ALL
    SELECT 'pre_balance', 'EUR', eur::numeric FROM public.pre_balances WHERE user_id = p_user
  ),
  future_deltas AS (
    SELECT
      wallet_type,
      currency,
      COALESCE(sum(delta), 0)::numeric AS delta_sum
    FROM public.get_driver_ledger_rows(p_user, p_at, NULL)
    GROUP BY wallet_type, currency
  )
  SELECT
    a.wallet_type,
    a.currency,
    a.amount - COALESCE(fd.delta_sum, 0) AS amount
  FROM actual a
  LEFT JOIN future_deltas fd
    ON fd.wallet_type = a.wallet_type
   AND fd.currency = a.currency
  ORDER BY a.wallet_type, a.currency;
$$;

GRANT EXECUTE ON FUNCTION public.exec_adjust_wallet_amount(uuid, text, text, numeric, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_driver_ledger_rows(uuid, timestamptz, timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_driver_ledger_opening(uuid, timestamptz) TO anon, authenticated, service_role;
