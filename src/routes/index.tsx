import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import heroFallback from "@/assets/hero-rooftop.jpg";
import { Leaf, Lock, X, Search } from "lucide-react";
import { usePricing } from "@/hooks/use-pricing";

export const Route = createFileRoute("/")({
  component: MenuPage,
});

type SuperCategory = {
  id: string;
  super_category_name: string;
  display_order: number;
  active_status: boolean;
};

type Category = {
  id: string;
  category_name: string;
  category_image: string | null;
  super_category_id: string | null;
  display_order: number;
  active_status: boolean;
};

type Product = {
  id: string;
  product_name: string;
  product_description: string | null;
  product_image: string | null;
  category_id: string;
  price: number;
  allergen_warning: string | null;
  serving_size: string | null;
  display_order: number;
  active_status: boolean;
};

type Landing = {
  cover_image: string | null;
  title: string;
  subtitle: string;
  cta_text: string;
  overlay_opacity: number;
  show_product_images: boolean;
};

function MenuPage() {
  const navigate = useNavigate();
  const { getPrice, activeBannerPromos } = usePricing();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: landing } = useQuery({
    queryKey: ["landing"],
    queryFn: async (): Promise<Landing | null> => {
      const { data } = await supabase.from("landing_settings").select("*").limit(1).maybeSingle();
      return data as Landing | null;
    },
  });

  const { data: superCategories = [] } = useQuery({
    queryKey: ["super_categories", "public"],
    queryFn: async (): Promise<SuperCategory[]> => {
      const { data } = await supabase
        .from("super_categories")
        .select("*")
        .eq("active_status", true)
        .order("display_order", { ascending: true });
      return (data ?? []) as SuperCategory[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", "public"],
    queryFn: async (): Promise<Category[]> => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("active_status", true)
        .order("display_order", { ascending: true });
      return (data ?? []) as Category[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", "public"],
    queryFn: async (): Promise<Product[]> => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("active_status", true)
        .order("display_order", { ascending: true });
      return (data ?? []) as Product[];
    },
  });

  // Build a lookup map: category_id -> super_category_id
  const catSuperMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const c of categories) map.set(c.id, c.super_category_id);
    return map;
  }, [categories]);

  const displayProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p) => 
      p.product_name.toLowerCase().includes(q) || 
      p.product_description?.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of displayProducts) {
      if (!map.has(p.category_id)) map.set(p.category_id, []);
      map.get(p.category_id)!.push(p);
    }
    return map;
  }, [displayProducts]);

  const [activeSuperCat, setActiveSuperCat] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pillsRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const displaySuperCats = useMemo(() => {
    const list = [...superCategories];
    const hasUnassigned = categories.some((c) => !c.super_category_id);
    if (hasUnassigned) {
      list.push({
        id: "unassigned",
        super_category_name: "Others",
        display_order: 9999,
        active_status: true,
      });
    }
    return list;
  }, [superCategories, categories]);

  useEffect(() => {
    if (!activeSuperCat && displaySuperCats.length > 0) {
      setActiveSuperCat(displaySuperCats[0].id);
    }
  }, [displaySuperCats, activeSuperCat]);

  const filteredCategories = useMemo(() => {
    let cats = categories;
    
    if (searchQuery.trim()) {
      // Global search: only show categories that have matching products
      cats = cats.filter((c) => (productsByCategory.get(c.id)?.length ?? 0) > 0);
    } else {
      // Normal filtering by active super category
      if (activeSuperCat && activeSuperCat !== "unassigned") {
        cats = cats.filter((c) => c.super_category_id === activeSuperCat);
      } else if (activeSuperCat === "unassigned") {
        cats = cats.filter((c) => !c.super_category_id);
      }
    }
    return cats;
  }, [categories, activeSuperCat, searchQuery, productsByCategory]);

  useEffect(() => {
    if (filteredCategories.length > 0) {
      const exists = filteredCategories.some((c) => c.id === activeCat);
      if (!exists) {
        setActiveCat(filteredCategories[0].id);
      }
    } else {
      setActiveCat(null);
    }
  }, [activeSuperCat, filteredCategories, activeCat]);

  // Observe horizontal scroll to update active category
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || filteredCategories.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const id = (visible.target as HTMLElement).dataset.catId;
          if (id) setActiveCat(id);
        }
      },
      { root, threshold: [0.5, 0.75] }
    );
    Object.values(sectionRefs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [filteredCategories]);

  // Auto-scroll active pill into view
  useEffect(() => {
    if (!activeCat || !pillsRef.current) return;
    const pill = pillsRef.current.querySelector<HTMLElement>(`[data-pill-id="${activeCat}"]`);
    pill?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCat]);

  const scrollToCategory = (id: string) => {
    setActiveCat(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  const cover = landing?.cover_image || heroFallback;
  const overlay = landing?.overlay_opacity ?? 0.45;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative h-[100svh] w-full overflow-hidden">
        <img
          src={cover}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.src = heroFallback;
          }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-espresso/60 via-espresso/30 to-background"
          style={{ opacity: overlay }}
        />
        <div className="absolute top-6 left-0 right-0 z-10 flex items-center justify-between px-5">
          <div className="flex items-center gap-2 text-cream">
            <Leaf className="h-4 w-4" />
            <span className="font-title text-sm tracking-[0.3em] uppercase">Rooftop Cafe</span>
          </div>
        </div>
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          {(!landing?.title || landing.title === "Brew & Berry") ? (
            <img
              src="/logo-light.png"
              alt="Brew & Berry"
              className="h-24 sm:h-32 md:h-40 object-contain select-none pointer-events-none"
            />
          ) : (
            <h1 className="font-title text-cream text-5xl md:text-7xl leading-[1.05] max-w-3xl">
              {landing.title}
            </h1>
          )}
          <p className="mt-5 text-cream/90 text-lg md:text-xl max-w-xl">
            {landing?.subtitle ?? "Brewing serotonin daily."}
          </p>
          <a
            href="#menu"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-cream text-espresso px-8 py-3.5 text-sm font-semibold tracking-wide hover:bg-gold transition-colors shadow-lg"
          >
            {landing?.cta_text ?? "Explore The Menu"}
          </a>
        </div>
        <div className="absolute bottom-6 left-0 right-0 z-10 flex justify-center">
          <div className="h-10 w-px bg-cream/40 animate-pulse" />
        </div>
      </section>

      {/* Simple Promotional Strip */}
      {!bannerDismissed && activeBannerPromos.length > 0 && (
        <div className="bg-primary text-primary-foreground text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 tracking-wide">
          <span>{activeBannerPromos[0].title}</span>
          {activeBannerPromos[0].subtitle && (
            <span className="opacity-80 hidden sm:inline">- {activeBannerPromos[0].subtitle}</span>
          )}
          <button onClick={() => setBannerDismissed(true)} className="ml-2 hover:opacity-70 transition-opacity">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sticky category nav with photos */}
      <div id="menu" className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border divide-y divide-border/60">
        
        {/* Category Search Bar */}
        <div className="px-4 py-3 bg-background/50">
          <div className="relative max-w-sm mx-auto md:mx-0 md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-secondary text-sm rounded-full border-transparent focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>
        </div>

        {/* Super Categories Pills */}
        {displaySuperCats.length > 1 && (
          <div className="overflow-x-auto no-scrollbar py-2.5 px-4 bg-background/50">
            <div className="flex items-center gap-2 min-w-max">
              {displaySuperCats.map((sc) => {
                const active = activeSuperCat === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => setActiveSuperCat(sc.id)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {sc.super_category_name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Secondary Categories Pills */}
        <div ref={pillsRef} className="overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-3 px-4 py-3 min-w-max">
            {filteredCategories.map((c) => {
              const active = activeCat === c.id;
              return (
                <button
                  key={c.id}
                  data-pill-id={c.id}
                  onClick={() => scrollToCategory(c.id)}
                  className={`flex flex-col items-center gap-1.5 shrink-0 transition-all w-[90px] ${
                    active ? "scale-105" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`h-14 w-14 rounded-full overflow-hidden border-2 transition-colors ${
                      active ? "border-primary shadow-md" : "border-transparent"
                    }`}
                  >
                    {c.category_image ? (
                      <img src={c.category_image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-secondary grid place-items-center">
                        <Leaf className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                   <span
                    className={`text-xs font-medium w-full text-center line-clamp-2 leading-tight px-0.5 ${
                      active ? "text-primary font-semibold" : "text-muted-foreground"
                    }`}
                  >
                    {c.category_name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Swipeable category sections */}
      <main className="pb-32 pt-6">
        {filteredCategories.length === 0 && (
          <p className="text-center text-muted-foreground py-20">The menu is being prepared…</p>
        )}
        <div
          ref={scrollerRef}
          className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {filteredCategories.map((cat) => {
            const items = productsByCategory.get(cat.id) ?? [];
            return (
              <section
                key={cat.id}
                data-cat-id={cat.id}
                ref={(el: HTMLDivElement | null) => { sectionRefs.current[cat.id] = el; }}
                className="snap-start shrink-0 w-full px-4 md:px-8"
              >
                <div className="max-w-6xl mx-auto">
                  {cat.category_image && (
                    <div className="mb-6 overflow-hidden rounded-2xl aspect-square w-full md:max-w-md mx-auto">
                      <img src={cat.category_image} alt={cat.category_name} className="h-full w-full object-cover" />
                    </div>
                  )}

                  <div className="mb-6 flex items-end justify-between gap-4">
                    <div>
                      <h2 className="font-heading text-3xl md:text-4xl text-espresso">{cat.category_name}</h2>
                      <div className="mt-2 h-px w-12 bg-primary" />
                    </div>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">
                      {items.length} {items.length === 1 ? "item" : "items"}
                    </span>
                  </div>

                  <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 [column-fill:_balance]">
                    {items.map((p) => {
                      const pricing = getPrice({
                        id: p.id,
                        price: p.price,
                        category_id: p.category_id,
                        super_category_id: catSuperMap.get(p.category_id),
                      });
                      const hasPromo = !!pricing.promotion;
                      const displayPrice = pricing.customerPrice;
                      const showStrike = hasPromo && pricing.adjustedPrice !== pricing.customerPrice;

                      return (
                        <article
                          key={p.id}
                          className="break-inside-avoid inline-block w-full mb-5 group rounded-2xl bg-card border border-border overflow-hidden shadow-sm hover:shadow-lg transition-all relative"
                        >
                          {/* Promo badge (on top of image) */}
                          {hasPromo && pricing.promotion!.badge_text && (landing?.show_product_images !== false && p.product_image) && (
                            <div className="absolute top-3 left-3 z-10">
                              <span className="text-[10px] font-bold uppercase tracking-widest bg-accent text-accent-foreground px-2.5 py-1 rounded-full shadow-sm">
                                {pricing.promotion!.badge_text}
                              </span>
                            </div>
                          )}
                          {landing?.show_product_images !== false && p.product_image && (
                            <div className="aspect-[4/3] overflow-hidden bg-muted">
                              <img
                                src={p.product_image}
                                alt={p.product_name}
                                loading="lazy"
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            </div>
                          )}
                          <div className="p-5">
                            {/* Promo badge (inline when no image is present) */}
                            {hasPromo && pricing.promotion!.badge_text && !(landing?.show_product_images !== false && p.product_image) && (
                              <div className="mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest bg-accent text-accent-foreground px-2.5 py-1 rounded-full shadow-sm">
                                  {pricing.promotion!.badge_text}
                                </span>
                              </div>
                            )}
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="font-heading text-lg leading-tight text-espresso">{p.product_name}</h3>
                              {displayPrice > 0 && (
                                <div className="text-right shrink-0">
                                  {showStrike && (
                                    <span className="text-xs text-muted-foreground line-through tabular-nums block">
                                      ₹{pricing.adjustedPrice}
                                    </span>
                                  )}
                                  <span className={`font-semibold tabular-nums ${hasPromo ? "text-accent" : "text-primary"}`}>
                                    ₹{displayPrice}
                                  </span>
                                </div>
                              )}
                            </div>
                            {/* Promo title */}
                            {hasPromo && pricing.promotion!.title && (
                              <p className="mt-1.5 text-xs font-medium text-accent">
                                {pricing.promotion!.title}
                                {pricing.promotion!.subtitle && (
                                  <span className="text-muted-foreground font-normal"> — {pricing.promotion!.subtitle}</span>
                                )}
                              </p>
                            )}
                            {p.product_description && (
                              <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                                {p.product_description}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              {p.serving_size && (
                                <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                                  {p.serving_size}
                                </span>
                              )}
                              {p.allergen_warning && (
                                <span className="rounded-full bg-accent/10 px-2.5 py-1 text-accent">
                                  ⚠ {p.allergen_warning}
                                </span>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                    {items.length === 0 && (
                      <p
                        style={{ columnSpan: "all" }}
                        className="text-center text-muted-foreground py-12 text-sm w-full"
                      >
                        No items in this category yet.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </main>


      <SiteFooter />
    </div>
  );
}

function SiteFooter() {
  const { data: links = [] } = useQuery({
    queryKey: ["footer_links", "public"],
    queryFn: async (): Promise<{ label: string; url: string }[]> => {
      const { data } = await supabase
        .from("footer_links")
        .select("label, url")
        .eq("active_status", true)
        .order("display_order", { ascending: true });
      return (data ?? []) as { label: string; url: string }[];
    },
  });

  return (
    <footer className="bg-espresso text-cream/80 py-12 px-6 border-t border-cream/10">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2 text-cream">
          <Leaf className="h-5 w-5 text-primary" />
          <span className="font-title text-base tracking-[0.2em] uppercase">Brew & Berry</span>
        </div>
        
        {links.length > 0 && (
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-4">
            {links.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:text-cream transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}
        
        <p className="text-xs text-cream/40">
          &copy; {new Date().getFullYear()} Brew & Berry. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
