CREATE TABLE public.super_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_category_name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  active_status boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.super_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_categories TO authenticated;
GRANT ALL ON public.super_categories TO service_role;

ALTER TABLE public.super_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read super_categories" ON public.super_categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admin manage super_categories" ON public.super_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_super_categories_updated_at
  BEFORE UPDATE ON public.super_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.categories
  ADD COLUMN super_category_id uuid REFERENCES public.super_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_categories_super_category_id ON public.categories(super_category_id);