import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculatePrice, detectWarnings, type EventRule, type Promotion, type ProductForPricing, type PricingResult, type PricingWarning } from "@/lib/pricing";

export function usePricing() {
  const { data: eventRules = [] } = useQuery({
    queryKey: ["event_pricing_rules", "active"],
    queryFn: async (): Promise<EventRule[]> => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("event_pricing_rules")
        .select("*")
        .eq("is_active", true)
        .eq("is_archived", false)
        .lte("starts_at", now)
        .gte("ends_at", now);
      return (data ?? []) as EventRule[];
    },
    retry: false,
    meta: { suppressError: true },
  });

  const { data: promotions = [] } = useQuery({
    queryKey: ["promotions", "active"],
    queryFn: async (): Promise<Promotion[]> => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("promotions")
        .select("*")
        .eq("is_active", true)
        .eq("is_archived", false)
        .lte("starts_at", now)
        .gte("ends_at", now)
        .order("display_order", { ascending: true });
      return (data ?? []) as Promotion[];
    },
    meta: { suppressError: true },
  });

  const activeBannerPromos = promotions.filter(p => p.show_banner);

  const getPrice = (product: ProductForPricing): PricingResult => {
    return calculatePrice(product, eventRules, promotions);
  };

  const getWarnings = (product: ProductForPricing): PricingWarning[] => {
    return detectWarnings(product, eventRules, promotions);
  };

  return {
    eventRules,
    promotions,
    activeBannerPromos,
    getPrice,
    getWarnings,
  };
}
