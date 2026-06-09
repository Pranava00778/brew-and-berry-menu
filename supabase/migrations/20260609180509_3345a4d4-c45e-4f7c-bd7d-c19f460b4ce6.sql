
-- ROLES
CREATE TYPE public.app_role AS ENUM ('super_admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- LANDING SETTINGS (single row)
CREATE TABLE public.landing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cover_image text,
  title text NOT NULL DEFAULT 'Brew & Berry',
  subtitle text NOT NULL DEFAULT 'Brewing serotonin daily.',
  cta_text text NOT NULL DEFAULT 'Explore The Menu',
  overlay_opacity numeric NOT NULL DEFAULT 0.45,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.landing_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.landing_settings TO authenticated;
GRANT ALL ON public.landing_settings TO service_role;
ALTER TABLE public.landing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read landing" ON public.landing_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage landing" ON public.landing_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_landing_updated BEFORE UPDATE ON public.landing_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CATEGORIES
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL,
  category_image text,
  display_order integer NOT NULL DEFAULT 0,
  active_status boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  product_description text,
  product_image text,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  price numeric NOT NULL DEFAULT 0,
  allergen_warning text,
  serving_size text,
  display_order integer NOT NULL DEFAULT 0,
  active_status boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON public.products(category_id, display_order);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read products" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED LANDING
INSERT INTO public.landing_settings (title, subtitle, cta_text, overlay_opacity)
VALUES ('Brew & Berry', 'Brewing serotonin daily.', 'Explore The Menu', 0.45);

-- SEED CATEGORIES + PRODUCTS
DO $$
DECLARE
  cat_id uuid;
  ord int := 0;
  cats text[][] := ARRAY[
    ARRAY['Mojitos','Virgin Mojito|Lemon Mint Mojito|Watermelon Mojito|Green Apple Mojito|Strawberry Mojito|Blue Lagoon Mojito|Kiwi Mojito|Mango Mojito|Lychee Mojito|Peach Mojito|Pineapple Mojito|Cranberry Mojito'],
    ARRAY['Ice Tea','Peach Ice Tea|Lemon Ice Tea'],
    ARRAY['Cold Coffee & Iced Coffee','Classic Cold Coffee|Brownie Cold Coffee|Oreo Cold Coffee|Iced Americano|Iced Latte|Iced Spanish Latte|Biscoff Coffee'],
    ARRAY['Fruit Shakes','Mango Shake|Strawberry Shake|Banana Shake'],
    ARRAY['Chocolate Shakes','Chocolate Shake|Oreo Shake|KitKat Shake|Brownie Shake'],
    ARRAY['Fries','Salted Fries|Peri Peri Fries|Cheese Fries'],
    ARRAY['Loaded Fries','Cheese Burst Fries|Nacho Cheese Fries|Chicken Loaded Fries'],
    ARRAY['Potato Snacks','Potato Pops|Potato Wedges'],
    ARRAY['Nachos','Classic Nachos|Cheese Nachos'],
    ARRAY['Corn Bar','Butter Sweet Corn|Cheese Corn Cup|Peri Peri Corn'],
    ARRAY['Veg Frozen Snacks','Veg Nuggets|Veg Fingers|Spring Rolls'],
    ARRAY['Chicken Frozen Snacks','Chicken Nuggets|Chicken Popcorn|Chicken Strips|Chicken Wings|Chicken Cheese Balls|Chicken Spring Rolls'],
    ARRAY['Burgers','Classic Veg Burger|Crispy Chicken Burger'],
    ARRAY['Sandwiches','Veg Grilled Sandwich|Corn Cheese Sandwich|Paneer Sandwich|Fresh Vegetable Sandwich'],
    ARRAY['Pasta','White Sauce Pasta (Veg)|White Sauce Pasta (Non Veg)|Pink Sauce Pasta (Veg)|Pink Sauce Pasta (Non Veg)|Red Sauce Pasta (Veg)|Red Sauce Pasta (Non Veg)'],
    ARRAY['Pizza','Margherita|Corn & Cheese|Vegetable Pizza|Paneer Pizza|Chicken Tikka Pizza'],
    ARRAY['Maggi Bar','Plain Butter Maggi|Cheese Maggi|Peri Peri Maggi|Schezwan Maggi'],
    ARRAY['Brownie Series','Brownie With Ice Cream|Nutella Brownie Bowl|Chocolate Brownie|Chocolate Sundae|Brownie Sundae|Tropical Fruit Bowl|Berry Bowl|Fruit & Cream Bowl'],
    ARRAY['Rice Bowls','Chicken Rice Bowl|Mutton Rice Bowl']
  ];
  c text[];
  p text;
  pord int;
BEGIN
  FOREACH c SLICE 1 IN ARRAY cats LOOP
    ord := ord + 1;
    INSERT INTO public.categories(category_name, display_order) VALUES (c[1], ord) RETURNING id INTO cat_id;
    pord := 0;
    FOREACH p IN ARRAY string_to_array(c[2], '|') LOOP
      pord := pord + 1;
      INSERT INTO public.products(product_name, category_id, display_order, price) VALUES (p, cat_id, pord, 0);
    END LOOP;
  END LOOP;
END $$;
