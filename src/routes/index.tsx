import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import heroFallback from "@/assets/hero-rooftop.jpg";
import { Leaf, Lock } from "lucide-react";

export const Route = createFileRoute("/")({
  component: MenuPage,
});

type Category = {
  id: string;
  category_name: string;
  category_image: string | null;
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
};

function MenuPage() {
  const navigate = useNavigate();
  const { data: landing } = useQuery({
    queryKey: ["landing"],
    queryFn: async (): Promise<Landing | null> => {
      const { data } = await supabase.from("landing_settings").select("*").limit(1).maybeSingle();
      return data as Landing | null;
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

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      if (!map.has(p.category_id)) map.set(p.category_id, []);
      map.get(p.category_id)!.push(p);
    }
    return map;
  }, [products]);

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!activeCat && categories.length) setActiveCat(categories[0].id);
  }, [categories, activeCat]);

  const scrollToCategory = (id: string) => {
    setActiveCat(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cover = landing?.cover_image || heroFallback;
  const overlay = landing?.overlay_opacity ?? 0.45;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative h-[100svh] w-full overflow-hidden">
        <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div
          className="absolute inset-0 bg-gradient-to-b from-espresso/60 via-espresso/30 to-background"
          style={{ opacity: overlay }}
        />
        <div className="absolute top-6 left-0 right-0 z-10 flex items-center justify-between px-5">
          <div className="flex items-center gap-2 text-cream">
            <Leaf className="h-4 w-4" />
            <span className="font-display text-sm tracking-[0.3em] uppercase">Rooftop Café</span>
          </div>
          <button
            onClick={() => navigate({ to: "/admin" })}
            className="text-cream/70 hover:text-cream transition-colors"
            aria-label="Admin"
          >
            <Lock className="h-4 w-4" />
          </button>
        </div>
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-cream text-5xl md:text-7xl leading-[1.05] max-w-3xl">
            {landing?.title ?? "Brew & Berry"}
          </h1>
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

      {/* Sticky category nav */}
      <div id="menu" className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 px-4 py-3 min-w-max">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => scrollToCategory(c.id)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  activeCat === c.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-secondary-foreground hover:bg-muted"
                }`}
              >
                {c.category_name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category sections */}
      <main className="px-4 pb-32 pt-8 max-w-6xl mx-auto">
        {categories.length === 0 && (
          <p className="text-center text-muted-foreground py-20">The menu is being prepared…</p>
        )}
        {categories.map((cat) => {
          const items = productsByCategory.get(cat.id) ?? [];
          return (
            <section
              key={cat.id}
              ref={(el) => { sectionRefs.current[cat.id] = el; }}
              className="scroll-mt-20 mb-16"
            >
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl md:text-4xl text-espresso">{cat.category_name}</h2>
                  <div className="mt-2 h-px w-12 bg-primary" />
                </div>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
              </div>

              {cat.category_image && (
                <div className="mb-6 overflow-hidden rounded-2xl aspect-[21/9]">
                  <img src={cat.category_image} alt={cat.category_name} className="h-full w-full object-cover" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((p) => (
                  <article
                    key={p.id}
                    className="group rounded-2xl bg-card border border-border overflow-hidden shadow-sm hover:shadow-lg transition-all"
                  >
                    {p.product_image ? (
                      <div className="aspect-[4/3] overflow-hidden bg-muted">
                        <img
                          src={p.product_image}
                          alt={p.product_name}
                          loading="lazy"
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-gradient-to-br from-bamboo-soft/30 to-sand flex items-center justify-center">
                        <Leaf className="h-10 w-10 text-bamboo-soft/60" />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-lg leading-tight text-espresso">{p.product_name}</h3>
                        {Number(p.price) > 0 && (
                          <span className="font-semibold text-primary tabular-nums">
                            ₹{Number(p.price).toFixed(0)}
                          </span>
                        )}
                      </div>
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
                ))}
              </div>
            </section>
          );
        })}
      </main>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        <p className="font-display text-lg text-espresso">Brew & Berry</p>
        <p className="mt-1">Leaf it to us. 🌿</p>
        <Link to="/admin" className="mt-4 inline-block text-xs uppercase tracking-widest hover:text-primary">
          Staff Login
        </Link>
      </footer>
    </div>
  );
}
