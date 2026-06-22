import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Tag, Trash2, Edit2, Calendar } from "lucide-react";
import type { Promotion } from "@/lib/pricing";

export const Route = createFileRoute("/admin/promotions")({
  component: PromotionsAdmin,
});

type SuperCat = { id: string; super_category_name: string };
type Cat = { id: string; category_name: string; super_category_id: string | null };
type Prod = { id: string; product_name: string; category_id: string };

const DAYS = [
  { value: 0, label: "Su" },
  { value: 1, label: "Mo" },
  { value: 2, label: "Tu" },
  { value: 3, label: "We" },
  { value: 4, label: "Th" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
];

function PromotionsAdmin() {
  const qc = useQueryClient();

  const { data: promotions = [] } = useQuery({
    queryKey: ["admin", "promotions"],
    queryFn: async () => {
      const { data } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Promotion[];
    },
  });

  const { data: superCats = [] } = useQuery({
    queryKey: ["admin", "super_categories", "lite"],
    queryFn: async () => {
      const { data } = await supabase.from("super_categories").select("id, super_category_name").order("display_order");
      return (data ?? []) as SuperCat[];
    },
  });

  const { data: cats = [] } = useQuery({
    queryKey: ["admin", "categories", "lite"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, category_name, super_category_id").order("display_order");
      return (data ?? []) as Cat[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin", "products", "lite"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, product_name, category_id").order("product_name");
      return (data ?? []) as Prod[];
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-title text-3xl text-espresso">Promotions</h1>
          <p className="text-muted-foreground mt-1">Manage public discount campaigns and offers.</p>
        </div>
        <PromoDialog
          superCats={superCats}
          cats={cats}
          products={products}
          onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "promotions"] })}
        >
          <Button><Plus className="h-4 w-4 mr-2" /> New Promotion</Button>
        </PromoDialog>
      </div>

      <div className="mt-8 space-y-4">
        {promotions.map((p) => (
          <PromoCard
            key={p.id}
            promo={p}
            superCats={superCats}
            cats={cats}
            products={products}
            onChanged={() => qc.invalidateQueries({ queryKey: ["admin", "promotions"] })}
          />
        ))}
        {promotions.length === 0 && (
          <p className="text-muted-foreground text-sm p-4 border rounded-xl text-center bg-card">No promotions created yet.</p>
        )}
      </div>
    </div>
  );
}

function PromoCard({
  promo, superCats, cats, products, onChanged
}: {
  promo: Promotion;
  superCats: SuperCat[];
  cats: Cat[];
  products: Prod[];
  onChanged: () => void;
}) {
  const toggle = async (v: boolean) => {
    await supabase.from("promotions").update({ is_active: v }).eq("id", promo.id);
    onChanged();
  };

  const del = async () => {
    if (!confirm(`Delete promotion "${promo.title}"?`)) return;
    await supabase.from("promotions").delete().eq("id", promo.id);
    onChanged();
  };

  const getScopeName = (p: Promotion) => {
    if (p.scope === "global") return "Entire Menu";
    if (p.scope === "super_category") return superCats.find((s) => s.id === p.scope_id)?.super_category_name ?? "Unknown";
    if (p.scope === "category") return cats.find((c) => c.id === p.scope_id)?.category_name ?? "Unknown";
    if (p.scope === "product") return products.find((prod) => prod.id === p.scope_id)?.product_name ?? "Unknown";
    return p.scope;
  };

  return (
    <div className={`p-4 border rounded-xl bg-card flex flex-col md:flex-row md:items-center gap-4 transition-opacity ${promo.is_active ? "" : "opacity-60"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <h3 className="font-bold truncate">{promo.title}</h3>
          {promo.show_banner && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold uppercase">Strip Visible</span>}
        </div>
        {promo.subtitle && <p className="text-sm text-muted-foreground mt-1">{promo.subtitle}</p>}
        <div className="flex flex-wrap gap-2 mt-2 text-xs font-medium">
          <span className="bg-secondary px-2 py-1 rounded">
            {promo.discount_type === "percentage" ? `${promo.discount_value}% OFF` : `₹${promo.discount_value} OFF`}
          </span>
          <span className="bg-secondary px-2 py-1 rounded">Scope: {getScopeName(promo)}</span>
          {promo.starts_at && promo.ends_at && (
            <span className="bg-secondary px-2 py-1 rounded flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(promo.starts_at).toLocaleDateString()} - {new Date(promo.ends_at).toLocaleDateString()}
            </span>
          )}
          {promo.days_of_week && promo.days_of_week.length > 0 && (
            <span className="bg-secondary px-2 py-1 rounded text-accent font-semibold">
              Days: {promo.days_of_week.map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={promo.is_active} onCheckedChange={toggle} />
        <PromoDialog
          promo={promo}
          superCats={superCats}
          cats={cats}
          products={products}
          onSaved={onChanged}
        >
          <Button variant="ghost" size="icon"><Edit2 className="h-4 w-4" /></Button>
        </PromoDialog>
        <Button variant="ghost" size="icon" onClick={del}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
    </div>
  );
}

function PromoDialog({
  children, promo, superCats, cats, products, onSaved
}: {
  children: React.ReactNode;
  promo?: Promotion;
  superCats: SuperCat[];
  cats: Cat[];
  products: Prod[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const defaultForm = () => ({
    title: promo?.title ?? "",
    subtitle: promo?.subtitle ?? "",
    discount_type: promo?.discount_type ?? "percentage",
    discount_value: String(promo?.discount_value ?? 10),
    scope: promo?.scope ?? "global",
    scope_id: promo?.scope_id ?? "",
    starts_at: promo?.starts_at ? promo.starts_at.slice(0, 16) : new Date().toISOString().slice(0, 16),
    ends_at: promo?.ends_at ? promo.ends_at.slice(0, 16) : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
    show_banner: promo?.show_banner ?? true,
    is_active: promo?.is_active ?? true,
    days_of_week: promo?.days_of_week ?? [] as number[],
  });

  const [form, setForm] = useState(defaultForm);

  const update = (k: string, v: any) => setForm({ ...form, [k]: v });

  const save = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (form.scope !== "global" && !form.scope_id) return toast.error("Select a scope target");

    const payload = {
      title: form.title,
      subtitle: form.subtitle || null,
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value) || 0,
      scope: form.scope,
      scope_id: form.scope === "global" ? null : form.scope_id,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      show_banner: form.show_banner,
      is_active: form.is_active,
      days_of_week: form.days_of_week.length > 0 ? form.days_of_week : null,
    };

    if (promo) {
      const { error } = await supabase.from("promotions").update(payload).eq("id", promo.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("promotions").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    setOpen(false);
    onSaved();
  };

  const scopeOptions = useMemo(() => {
    if (form.scope === "super_category") return superCats.map((s) => ({ value: s.id, label: s.super_category_name }));
    if (form.scope === "category") return cats.map((c) => ({ value: c.id, label: c.category_name }));
    if (form.scope === "product") return products.map((p) => ({ value: p.id, label: p.product_name }));
    return [];
  }, [form.scope, superCats, cats, products]);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm(defaultForm()); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{promo ? "Edit Promotion" : "New Promotion"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Promotion Title</Label>
            <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Happy Hour" />
          </div>
          <div className="space-y-2">
            <Label>Subtitle (Optional)</Label>
            <Input value={form.subtitle} onChange={(e) => update("subtitle", e.target.value)} placeholder="e.g. Flat 20% off all beverages" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Discount Type</Label>
              <Select value={form.discount_type} onValueChange={(v) => update("discount_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="flat">Flat Amount (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Discount Value</Label>
              <Input type="number" value={form.discount_value} onChange={(e) => update("discount_value", e.target.value)} />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select value={form.scope} onValueChange={(v) => { update("scope", v); update("scope_id", ""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Entire Menu</SelectItem>
                <SelectItem value="super_category">Super Category</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="product">Product</SelectItem>
              </SelectContent>
            </Select>
            {form.scope !== "global" && (
              <Select value={form.scope_id} onValueChange={(v) => update("scope_id", v)}>
                <SelectTrigger><SelectValue placeholder={`Select ${form.scope.replace("_", " ")}`} /></SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Active Days of the Week</Label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((day) => {
                const isSelected = form.days_of_week.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => {
                      const next = isSelected
                        ? form.days_of_week.filter((d) => d !== day.value)
                        : [...form.days_of_week, day.value];
                      update("days_of_week", next);
                    }}
                    className={`h-9 w-9 rounded-full text-xs font-semibold border flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">If no days are selected, the promotion will apply every day.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input type="datetime-local" value={form.starts_at} onChange={(e) => update("starts_at", e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="datetime-local" value={form.ends_at} onChange={(e) => update("ends_at", e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-secondary/50 mt-4">
            <div>
              <p className="font-medium text-sm">Show Announcement Strip</p>
              <p className="text-xs text-muted-foreground">Display at the top of the menu</p>
            </div>
            <Switch checked={form.show_banner} onCheckedChange={(v) => update("show_banner", v)} />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg bg-secondary/50">
            <div>
              <p className="font-medium text-sm">Active</p>
              <p className="text-xs text-muted-foreground">Enable this promotion immediately</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => update("is_active", v)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
