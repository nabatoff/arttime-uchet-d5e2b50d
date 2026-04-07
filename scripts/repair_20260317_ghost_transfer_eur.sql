-- Корректировка после бага гонки / «тихих» ошибок (17.03.2026), пользователь 60765 (Жандос).
-- 1) 2500 EUR предбаланс→баланс попали в transfers, но не на balances.eur.
-- 2) С предбаланса не списались 50 + 2500 EUR (остаток «призрак» 2550 на pre_balances.eur).

-- Доначислить основной баланс (если ещё не делали — не выполнять повторно).
-- UPDATE public.balances
-- SET eur = eur + 2500
-- WHERE user_id = '60765e20-eff2-5ce6-983e-33fb469fb691'::uuid;

-- Снять призрачные 2550 EUR с предбаланса (идемпотентно при eur = 2550).
UPDATE public.pre_balances
SET eur = 0
WHERE user_id = '60765e20-eff2-5ce6-983e-33fb469fb691'::uuid
  AND eur::numeric = 2550;
