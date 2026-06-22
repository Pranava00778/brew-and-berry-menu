import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layers, Coffee, ImageIcon, Leaf, TrendingUp, Tag } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const [cats, prods, active, eventRules, promos] = await Promise.all([
        supabase.from("categories").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("active_status", true),
        supabase.from("event_pricing_rules").select("id", { count: "exact", head: true }).eq("is_active", true).eq("is_archived", false),
        supabase.from("promotions").select("id", { count: "exact", head: true }).eq("is_active", true).eq("is_archived", false),
      ]);
      return {
        categories: cats.count ?? 0,
        products: prods.count ?? 0,
        active: active.count ?? 0,
        eventRules: eventRules.count ?? 0,
        promotions: promos.count ?? 0,
      };
    },
  });

  return (
    <div>
      <h1 className="font-title text-3xl text-espresso">Dashboard</h1>
      <p className="text-muted-foreground mt-1">Welcome back to Brew & Berry.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-8">
        <Card icon={Layers} label="Categories" value={stats?.categories ?? "—"} />
        <Card icon={Coffee} label="Total Products" value={stats?.products ?? "—"} />
        <Card icon={Leaf} label="Active Items" value={stats?.active ?? "—"} />
        <Card icon={TrendingUp} label="Event Rules" value={stats?.eventRules ?? "—"} accent />
        <Card icon={Tag} label="Promotions" value={stats?.promotions ?? "—"} accent />
      </div>

      <div className="mt-10 rounded-2xl bg-gradient-to-br from-bamboo-soft/20 to-sand p-6 md:p-8 border">
        <ImageIcon className="h-6 w-6 text-primary" />
        <h2 className="font-heading text-2xl mt-3">Quick start</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc list-inside">
          <li>Customise the landing hero from <strong>Landing</strong>.</li>
          <li>Reorder and edit categories from <strong>Categories</strong>.</li>
          <li>Add prices, photos and descriptions to seeded items in <strong>Products</strong>.</li>
          <li>Adjust prices silently for events in <strong>Event Pricing</strong>.</li>
          <li>Run customer-facing discount campaigns in <strong>Promotions</strong>.</li>
        </ul>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent?: boolean }) {
  return (
    <div className={`rounded-2xl bg-card border p-5 ${accent ? "border-primary/20 bg-primary/5" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <p className={`font-heading text-3xl mt-2 ${accent ? "text-primary" : "text-espresso"}`}>{value}</p>
    </div>
  );
}
