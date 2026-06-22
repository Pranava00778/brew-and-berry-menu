-- Create super_categories table
CREATE TABLE public.super_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_category_name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  active_status boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add super_category_id to categories
ALTER TABLE public.categories ADD COLUMN super_category_id uuid REFERENCES public.super_categories(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.super_categories ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
CREATE POLICY "Public read super_categories" ON public.super_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage super_categories" ON public.super_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Trigger for updating updated_at column
CREATE TRIGGER trg_super_categories_updated BEFORE UPDATE ON public.super_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
