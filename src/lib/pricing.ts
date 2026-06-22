export type EventRule = {
  id: string;
  name: string;
  adjustment_type: string;
  adjustment_value: number;
  scope: string;
  scope_id: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  is_archived: boolean;
};

export type Promotion = {
  id: string;
  title: string;
  subtitle: string | null;
  banner_image: string | null;
  badge_text: string | null;
  discount_type: string;
  discount_value: number;
  scope: string;
  scope_id: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  is_archived: boolean;
  show_banner: boolean;
  banner_cta_text: string | null;
  display_order: number;
  days_of_week?: number[] | null;
};

export type ProductForPricing = {
  id: string;
  price: number;
  category_id: string;
  super_category_id?: string | null;
};

export type PricingResult = {
  basePrice: number;
  adjustedPrice: number;
  customerPrice: number;
  eventRule: EventRule | null;
  promotion: Promotion | null;
  eventAdjustmentAmount: number;
  discountAmount: number;
};

export type PricingWarning = {
  type: 'overlap' | 'excessive_increase' | 'negative_price' | 'override';
  message: string;
};

const SCOPE_PRIORITY: Record<string, number> = {
  product: 0,
  category: 1,
  super_category: 2,
  global: 3,
};

function isCurrentlyActive(
  rule: { starts_at: string; ends_at: string; is_active: boolean; is_archived: boolean; days_of_week?: number[] | null },
  now: Date
): boolean {
  if (!rule.is_active || rule.is_archived) return false;
  const start = new Date(rule.starts_at);
  const end = new Date(rule.ends_at);
  if (now < start || now > end) return false;

  if (rule.days_of_week && rule.days_of_week.length > 0) {
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
    if (!rule.days_of_week.includes(currentDay)) {
      return false;
    }
  }

  return true;
}

function matchesScope(rule: { scope: string; scope_id: string | null }, product: ProductForPricing): boolean {
  switch (rule.scope) {
    case 'global': return true;
    case 'product': return rule.scope_id === product.id;
    case 'category': return rule.scope_id === product.category_id;
    case 'super_category': return rule.scope_id === (product.super_category_id ?? null);
    default: return false;
  }
}

function findWinning<T extends { scope: string; scope_id: string | null; starts_at: string; ends_at: string; is_active: boolean; is_archived: boolean; days_of_week?: number[] | null }>(
  rules: T[],
  product: ProductForPricing,
  now: Date
): T | null {
  const matching = rules
    .filter((r) => isCurrentlyActive(r, now) && matchesScope(r, product))
    .sort((a, b) => (SCOPE_PRIORITY[a.scope] ?? 99) - (SCOPE_PRIORITY[b.scope] ?? 99));
  return matching[0] ?? null;
}

function applyAdjustment(basePrice: number, type: string, value: number): number {
  if (type === 'percentage') return basePrice * (value / 100);
  return value;
}

export function calculatePrice(product: ProductForPricing, eventRules: EventRule[], promotions: Promotion[], now: Date = new Date()): PricingResult {
  const basePrice = Number(product.price) || 0;

  const eventRule = findWinning(eventRules, product, now);
  const eventAdjustmentAmount = eventRule
    ? applyAdjustment(basePrice, eventRule.adjustment_type, eventRule.adjustment_value)
    : 0;
  const adjustedPrice = Math.round(basePrice + eventAdjustmentAmount);

  const promotion = findWinning(promotions, product, now);
  const discountAmount = promotion
    ? applyAdjustment(adjustedPrice, promotion.discount_type, promotion.discount_value)
    : 0;
  const customerPrice = Math.max(0, Math.round(adjustedPrice - discountAmount));

  return {
    basePrice,
    adjustedPrice,
    customerPrice,
    eventRule,
    promotion,
    eventAdjustmentAmount: Math.round(eventAdjustmentAmount),
    discountAmount: Math.round(discountAmount),
  };
}

export function detectWarnings(product: ProductForPricing, eventRules: EventRule[], promotions: Promotion[], now: Date = new Date()): PricingWarning[] {
  const warnings: PricingWarning[] = [];
  const result = calculatePrice(product, eventRules, promotions, now);

  if (result.eventAdjustmentAmount > 0 && result.basePrice > 0) {
    const increasePercent = (result.eventAdjustmentAmount / result.basePrice) * 100;
    if (increasePercent > 50) {
      warnings.push({ type: 'excessive_increase', message: `Price increase exceeds 50% (${increasePercent.toFixed(0)}% increase)` });
    }
  }

  const activeEventRules = eventRules.filter((r) => isCurrentlyActive(r, now) && matchesScope(r, product));
  if (activeEventRules.length > 1) {
    warnings.push({ type: 'overlap', message: `${activeEventRules.length} event rules overlap for this product` });
  }

  const activePromos = promotions.filter((r) => isCurrentlyActive(r, now) && matchesScope(r, product));
  if (activePromos.length > 1) {
    warnings.push({ type: 'overlap', message: `${activePromos.length} promotions overlap for this product` });
  }

  if (result.customerPrice < 0) {
    warnings.push({ type: 'negative_price', message: `Promotional discount makes the price negative (₹${result.customerPrice})` });
  }

  return warnings;
}
