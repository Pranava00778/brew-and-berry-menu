import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, Archive, TrendingUp, AlertTriangle, Calendar, Percent, DollarSign } from "lucide-react";

export const Route = createFileRoute("/admin/event-pricing")({
  component: EventPricingAdmin,
});

type EventRule = {
  id: string;
  name: string;
  description: string | null;
  adjustment_type: string;
  adjustment_value: number;
  scope: string;
  scope_id: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  is_archived: boolean;
  created_at: string;
};

type SuperCat = { id: string; super_category_name: string };
type Cat = { id: string; category_name: string; super_category_id: string | null };
type Prod = { id: string; product_name: string; category_id: string };

function EventPricingAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("active");

  const { data: rules = [] } = useQuery({
    queryKey: ["admin", "event_pricing_rules"],
    queryFn: async () => {
      const { data } = await supabase.from("event_pricing_rules").select("*").order("created_at", { ascending: false });
      return (data ?? []) as EventRule[];
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

  const now = new Date();
  const filtered = useMemo(() => {
    return {
      active: rules.filter((r) => !r.is_archived && r.is_active && new Date(r.starts_at) <= now && new Date(r.ends_at) >= now),
      scheduled: rules.filter((r) => !r.is_archived && r.is_active && new Date(r.starts_at) > now),
      inactive: rules.filter((r) => !r.is_archived && !r.is_active),
      archived: rules.filter((r) => r.is_archived),
    };
  }, [rules, now]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["admin", "event_pricing_rules"] });
    qc.invalidateQueries({ queryKey: ["event_pricing_rules", "active"] });
  };

  const getScopeName = (rule: EventRule) => {
    if (rule.scope === "global") return "Entire Menu";
    if (rule.scope === "super_category") return superCats.find((s) => s.id === rule.scope_id)?.super_category_name ?? "Unknown";
    if (rule.scope === "category") return cats.find((c) => c.id === rule.scope_id)?.category_name ?? "Unknown";
    if (rule.scope === "product") return products.find((p) => p.id === rule.scope_id)?.product_name ?? "Unknown";
    return rule.scope;
  };

  const tabData: Record<string, EventRule[]> = filtered;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-title text-3xl text-espresso">Event Pricing</h1>
          <p className="text-muted-foreground mt-1">Silently adjust prices during events. Customers will not see these changes.</p>
        </div>
        <RuleDialog superCats={superCats} cats={cats} products={products} onSaved={refreshAll}>
          <Button><Plus className="h-4 w-4 mr-1" /> New Rule</Button>
        </RuleDialog>
      </div>

      {/* Warning banner */}
      {filtered.active.length > 0 && (
        <div className="mt-4 rounded-xl border border-gold/30 bg-gold/5 p-4 flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-gold shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm text-espresso">{filtered.active.length} active event rule{filtered.active.length > 1 ? "s" : ""} affecting prices right now</p>
            <p className="text-xs text-muted-foreground mt-0.5">Customers see adjusted prices without any indication of the markup.</p>
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="active">Active ({filtered.active.length})</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({filtered.scheduled.length})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({filtered.inactive.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({filtered.archived.length})</TabsTrigger>
        </TabsList>

        {(["active", "scheduled", "inactive", "archived"] as const).map((t) => (
          <TabsContent key={t} value={t}>
            <div className="grid gap-4 mt-4">
              {(tabData[t] ?? []).map((rule) => (
                <RuleCard key={rule.id} rule={rule} scopeName={getScopeName(rule)} superCats={superCats} cats={cats} products={products} onChanged={refreshAll} />
              ))}
              {(tabData[t] ?? []).length === 0 && (
                <p className="text-center text-muted-foreground py-12 text-sm">No {t} rules.</p>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function RuleCard({
  rule, scopeName, superCats, cats, products, onChanged,
}: {
  rule: EventRule; scopeName: string;
  superCats: SuperCat[]; cats: Cat[]; products: Prod[];
  onChanged: () => void;
}) {
  const { user } = useAuth();

  const archive = async () => {
    await supabase.from("event_pricing_rules").update({ is_archived: true }).eq("id", rule.id);
    if (user) {
      await supabase.from("pricing_audit_log").insert({
        user_id: user.id, action: "archived", entity_type: "event_rule", entity_id: rule.id,
        old_values: { is_archived: false }, new_values: { is_archived: true },
      });
    }
    toast.success("Archived");
    onChanged();
  };

  const del = async () => {
    if (!confirm(`Delete "${rule.name}"?`)) return;
    await supabase.from("event_pricing_rules").delete().eq("id", rule.id);
    if (user) {
      await supabase.from("pricing_audit_log").insert({
        user_id: user.id, action: "deleted", entity_type: "event_rule", entity_id: rule.id,
        old_values: rule as unknown as Record<string, unknown>, new_values: null,
      });
    }
    toast.success("Deleted");
    onChanged();
  };

  const duplicate = async () => {
    const { id, created_at, ...rest } = rule;
    await supabase.from("event_pricing_rules").insert({ ...rest, name: `${rule.name} (Copy)`, is_active: false });
    toast.success("Duplicated");
    onChanged();
  };

  const toggle = async (active: boolean) => {
    await supabase.from("event_pricing_rules").update({ is_active: active }).eq("id", rule.id);
    if (user) {
      await supabase.from("pricing_audit_log").insert({
        user_id: user.id, action: active ? "activated" : "deactivated", entity_type: "event_rule", entity_id: rule.id,
        old_values: { is_active: !active }, new_values: { is_active: active },
      });
    }
    toast.success(active ? "Activated" : "Deactivated");
    onChanged();
  };

  const isLive = rule.is_active && !rule.is_archived && new Date(rule.starts_at) <= new Date() && new Date(rule.ends_at) >= new Date();

  return (
    <div className={`rounded-2xl border bg-card p-5 transition-all ${isLive ? "border-gold/40 shadow-md ring-1 ring-gold/20" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-heading text-lg text-espresso">{rule.name}</h3>
            {isLive && (
              <span className="text-[10px] font-bold uppercase tracking-widest bg-gold/15 text-gold px-2 py-0.5 rounded-full">Live</span>
            )}
          </div>
          {rule.description && <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>}
        </div>
        <Switch checked={rule.is_active} onCheckedChange={toggle} />
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Adjustment</p>
          <p className="font-semibold text-espresso mt-0.5 flex items-center gap-1">
            {rule.adjustment_type === "percentage" ? <Percent className="h-3.5 w-3.5" /> : <span className="text-xs">₹</span>}
            +{rule.adjustment_value}{rule.adjustment_type === "percentage" ? "%" : ""}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Scope</p>
          <p className="font-medium text-espresso mt-0.5 truncate">{scopeName}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Starts</p>
          <p className="font-medium text-espresso mt-0.5">{new Date(rule.starts_at).toLocaleDateString()}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Ends</p>
          <p className="font-medium text-espresso mt-0.5">{new Date(rule.ends_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 flex-wrap">
        <RuleDialog rule={rule} superCats={superCats} cats={cats} products={products} onSaved={onChanged}>
          <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button>
        </RuleDialog>
        <Button variant="outline" size="sm" onClick={duplicate}><Copy className="h-3.5 w-3.5 mr-1" /> Duplicate</Button>
        {!rule.is_archived && (
          <Button variant="outline" size="sm" onClick={archive}><Archive className="h-3.5 w-3.5 mr-1" /> Archive</Button>
        )}
        <Button variant="ghost" size="sm" onClick={del}><Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" /> Delete</Button>
      </div>
    </div>
  );
}

function RuleDialog({
  children, rule, superCats, cats, products, onSaved,
}: {
  children: React.ReactNode;
  rule?: EventRule;
  superCats: SuperCat[];
  cats: Cat[];
  products: Prod[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const defaultForm = () => ({
    name: rule?.name ?? "",
    description: rule?.description ?? "",
    adjustment_type: rule?.adjustment_type ?? "percentage",
    adjustment_value: String(rule?.adjustment_value ?? 10),
    scope: rule?.scope ?? "global",
    scope_id: rule?.scope_id ?? "",
    starts_at: rule?.starts_at ? rule.starts_at.slice(0, 16) : new Date().toISOString().slice(0, 16),
    ends_at: rule?.ends_at ? rule.ends_at.slice(0, 16) : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
    is_active: rule?.is_active ?? false,
  });
  const [form, setForm] = useState(defaultForm);
  const u = (k: string, v: any) => setForm({ ...form, [k]: v });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    if (Number(form.adjustment_value) <= 0) return toast.error("Adjustment value must be positive");
    if (form.scope !== "global" && !form.scope_id) return toast.error("Select a scope target");

    const payload = {
      name: form.name,
      description: form.description || null,
      adjustment_type: form.adjustment_type,
      adjustment_value: Number(form.adjustment_value),
      scope: form.scope,
      scope_id: form.scope === "global" ? null : form.scope_id,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      is_active: form.is_active,
    };

    // Validate: warn if > 50%
    if (form.adjustment_type === "percentage" && Number(form.adjustment_value) > 50) {
      if (!confirm(`Adjustment of ${form.adjustment_value}% exceeds 50%. Continue?`)) return;
    }

    if (rule) {
      const { error } = await supabase.from("event_pricing_rules").update(payload).eq("id", rule.id);
      if (error) return toast.error(error.message);
      if (user) {
        await supabase.from("pricing_audit_log").insert({
          user_id: user.id, action: "updated", entity_type: "event_rule", entity_id: rule.id,
          old_values: rule as unknown as Record<string, unknown>,
          new_values: payload as unknown as Record<string, unknown>,
        });
      }
    } else {
      const { data, error } = await supabase.from("event_pricing_rules").insert(payload).select("id").single();
      if (error) return toast.error(error.message);
      if (user && data) {
        await supabase.from("pricing_audit_log").insert({
          user_id: user.id, action: "created", entity_type: "event_rule", entity_id: data.id,
          old_values: null, new_values: payload as unknown as Record<string, unknown>,
        });
      }
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{rule ? "Edit Event Rule" : "New Event Rule"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Rule Name</Label><Input value={form.name} onChange={(e) => u("name", e.target.value)} placeholder="e.g. DJ Night Markup" /></div>
          <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => u("description", e.target.value)} placeholder="Optional notes" /></div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Adjustment Type</Label>
              <Select value={form.adjustment_type} onValueChange={(v) => u("adjustment_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="flat">Flat Amount (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input type="number" min="0" step="1" value={form.adjustment_value} onChange={(e) => u("adjustment_value", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Scope</Label>
            <Select value={form.scope} onValueChange={(v) => { u("scope", v); u("scope_id", ""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Entire Menu</SelectItem>
                <SelectItem value="super_category">Super Category</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="product">Product</SelectItem>
              </SelectContent>
            </Select>
            {form.scope !== "global" && (
              <Select value={form.scope_id} onValueChange={(v) => u("scope_id", v)}>
                <SelectTrigger><SelectValue placeholder={`Select ${form.scope.replace("_", " ")}`} /></SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input type="datetime-local" value={form.starts_at} onChange={(e) => u("starts_at", e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="datetime-local" value={form.ends_at} onChange={(e) => u("ends_at", e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label htmlFor="rule-active" className="text-sm font-medium">Activate immediately</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Rule will apply to prices when active and within date range</p>
            </div>
            <Switch id="rule-active" checked={form.is_active} onCheckedChange={(v) => u("is_active", v)} />
          </div>

          {form.adjustment_type === "percentage" && Number(form.adjustment_value) > 50 && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>This adjustment exceeds 50%. Customers may notice significant price changes.</span>
            </div>
          )}

          <Button onClick={save} className="w-full">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
