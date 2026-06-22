-- =============================================================================
-- DYNAMIC PRICING & PROMOTIONAL ENGINE
-- =============================================================================

-- ─── EVENT PRICING RULES ────────────────────────────────────────────────────
-- Hidden margin adjustments applied during events (not visible to customers)
CREATE TABLE public.event_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  adjustment_type text NOT NULL DEFAULT 'percentage' CHECK (adjustment_type IN ('percentage', 'flat')),
  adjustment_value numeric NOT NULL DEFAULT 0,
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'super_category', 'category', 'product')),
  scope_id uuid,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  is_active boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_pricing_active ON public.event_pricing_rules (is_active, is_archived, starts_at, ends_at);

GRANT SELECT ON public.event_pricing_rules TO authenticated;
GRANT ALL ON public.event_pricing_rules TO service_role;
ALTER TABLE public.event_pricing_rules ENABLE ROW LEVEL SECURITY;

-- Only admins can read event pricing rules (they are internal)
CREATE POLICY "Admin read event_pricing_rules" ON public.event_pricing_rules
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin manage event_pricing_rules" ON public.event_pricing_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_event_pricing_rules_updated
  BEFORE UPDATE ON public.event_pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─── PROMOTIONS ─────────────────────────────────────────────────────────────
-- Customer-visible promotional discounts with badges and banners
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  banner_image text,
  badge_text text DEFAULT 'OFFER',
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'flat')),
  discount_value numeric NOT NULL DEFAULT 0,
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'super_category', 'category', 'product')),
  scope_id uuid,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  is_active boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  show_banner boolean NOT NULL DEFAULT false,
  banner_cta_text text DEFAULT 'Order Now',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_promotions_active ON public.promotions (is_active, is_archived, starts_at, ends_at);

GRANT SELECT ON public.promotions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Promotions are publicly visible (customers need to see them)
CREATE POLICY "Public read promotions" ON public.promotions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admin manage promotions" ON public.promotions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_promotions_updated
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ─── PRICING AUDIT LOG ──────────────────────────────────────────────────────
-- Tracks all pricing-related changes for accountability
CREATE TABLE public.pricing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('event_rule', 'promotion')),
  entity_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON public.pricing_audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON public.pricing_audit_log (created_at DESC);

GRANT SELECT ON public.pricing_audit_log TO authenticated;
GRANT INSERT ON public.pricing_audit_log TO authenticated;
GRANT ALL ON public.pricing_audit_log TO service_role;
ALTER TABLE public.pricing_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write audit logs
CREATE POLICY "Admin read audit_log" ON public.pricing_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Admin insert audit_log" ON public.pricing_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
