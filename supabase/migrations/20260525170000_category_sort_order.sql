ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS sort_order integer;

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_sort_order_unique
  ON public.categories (sort_order)
  WHERE sort_order IS NOT NULL;
