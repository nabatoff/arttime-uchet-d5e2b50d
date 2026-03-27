
-- Users table (custom auth, not Supabase Auth)
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login text UNIQUE NOT NULL,
  password text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'driver',
  photo text,
  available_currencies text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Balances (one row per user, column per currency)
CREATE TABLE public.balances (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  kzt numeric NOT NULL DEFAULT 0,
  rub numeric NOT NULL DEFAULT 0,
  uzs numeric NOT NULL DEFAULT 0,
  cny numeric NOT NULL DEFAULT 0,
  eur numeric NOT NULL DEFAULT 0
);

-- Pre-balances
CREATE TABLE public.pre_balances (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  kzt numeric NOT NULL DEFAULT 0,
  rub numeric NOT NULL DEFAULT 0,
  uzs numeric NOT NULL DEFAULT 0,
  cny numeric NOT NULL DEFAULT 0,
  eur numeric NOT NULL DEFAULT 0
);

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  no_receipt boolean NOT NULL DEFAULT false,
  visible_to text NOT NULL DEFAULT 'both'
);

-- Trucks
CREATE TABLE public.trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL
);

-- Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  date timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'KZT',
  comment text DEFAULT '',
  receipt_url text DEFAULT '',
  performed_by text DEFAULT '',
  truck text DEFAULT ''
);

-- Mileage
CREATE TABLE public.mileage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  date timestamptz NOT NULL DEFAULT now(),
  km numeric NOT NULL,
  photo_url text DEFAULT '',
  truck text DEFAULT ''
);

-- Transfers
CREATE TABLE public.transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_driver_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  to_driver_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  currency text NOT NULL,
  amount numeric NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  performed_by text DEFAULT '',
  comment text DEFAULT ''
);

-- Indexes
CREATE INDEX idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX idx_expenses_date ON public.expenses(date);
CREATE INDEX idx_mileage_user_id ON public.mileage(user_id);
CREATE INDEX idx_mileage_date ON public.mileage(date);
CREATE INDEX idx_transfers_date ON public.transfers(date);
CREATE INDEX idx_transfers_from ON public.transfers(from_driver_id);
CREATE INDEX idx_transfers_to ON public.transfers(to_driver_id);

-- RLS: permissive policies (internal app with custom auth, not Supabase Auth)
CREATE POLICY "allow_all" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.balances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.pre_balances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.trucks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.mileage FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON public.transfers FOR ALL USING (true) WITH CHECK (true);

-- Function to auto-create balance rows when a user is created
CREATE OR REPLACE FUNCTION public.create_user_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.balances (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.pre_balances (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_balances();
