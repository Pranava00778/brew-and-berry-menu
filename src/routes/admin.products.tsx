import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { GripVertical, Plus, Pencil, Trash2, Search } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/admin/products")({
  component: ProductsAdmin,
});

type Cat = { id: string; category_name: string };
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

function ProductsAdmin() {
  const qc = useQueryClient();
  const [filterCat, setFilterCat] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data: cats = [] } = useQuery({
    queryKey: ["admin", "categories", "lite"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, category_name").order("display_order");
      return (data ?? []) as Cat[];
    },
  });

  const effectiveCat = filterCat || cats[0]?.id;

  const { data: products = [] } = useQuery({
    queryKey: ["admin", "products", effectiveCat],
    enabled: !!effectiveCat,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("category_id", effectiveCat!).order("display_order");
      return (data ?? []) as Product[];
    },
  });

  const filtered = useMemo(
    () => products.filter((p) => p.product_name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    if (search) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = products.findIndex((p) => p.id === active.id);
    const newIdx = products.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(products, oldIdx, newIdx);
    qc.setQueryData(["admin", "products", effectiveCat], reordered);
    await Promise.all(reordered.map((p, i) =>
      supabase.from("products").update({ display_order: i + 1 }).eq("id", p.id)
    ));
    qc.invalidateQueries({ queryKey: ["products", "public"] });
    toast.success("Order saved");
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-espresso">Products</h1>
          <p className="text-muted-foreground mt-1">Drag to reorder within a category.</p>
        </div>
        <ProductDialog cats={cats} defaultCategoryId={effectiveCat} onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "products"] })}>
          <Button><Plus className="h-4 w-4 mr-1" /> New product</Button>
        </ProductDialog>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Select value={effectiveCat ?? ""} onValueChange={setFilterCat}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.category_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9" />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-card divide-y">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={filtered.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {filtered.map((p) => (
              <ProdRow key={p.id} product={p} cats={cats}
                onChanged={() => qc.invalidateQueries({ queryKey: ["admin", "products"] })} />
            ))}
          </SortableContext>
        </DndContext>
        {filtered.length === 0 && <p className="p-6 text-muted-foreground text-sm">No products match.</p>}
      </div>
    </div>
  );
}

function ProdRow({ product, cats, onChanged }: { product: Product; cats: Cat[]; onChanged: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const toggle = async (v: boolean) => {
    await supabase.from("products").update({ active_status: v }).eq("id", product.id);
    onChanged();
  };
  const del = async () => {
    if (!confirm(`Delete "${product.product_name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onChanged();
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-card">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none">
        <GripVertical className="h-5 w-5" />
      </button>
      {product.product_image ? (
        <img src={product.product_image} alt="" className="h-12 w-12 rounded-lg object-cover" />
      ) : (
        <div className="h-12 w-12 rounded-lg bg-secondary" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{product.product_name}</p>
        <p className="text-xs text-muted-foreground">₹{Number(product.price).toFixed(0)} · order #{product.display_order}</p>
      </div>
      <Switch checked={product.active_status} onCheckedChange={toggle} />
      <ProductDialog cats={cats} product={product} onSaved={onChanged}>
        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
      </ProductDialog>
      <Button variant="ghost" size="icon" onClick={del}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}

function ProductDialog({
  children, cats, product, defaultCategoryId, onSaved,
}: { children: React.ReactNode; cats: Cat[]; product?: Product; defaultCategoryId?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    product_name: product?.product_name ?? "",
    product_description: product?.product_description ?? "",
    product_image: product?.product_image ?? "",
    category_id: product?.category_id ?? defaultCategoryId ?? "",
    price: String(product?.price ?? 0),
    allergen_warning: product?.allergen_warning ?? "",
    serving_size: product?.serving_size ?? "",
  }));
  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  const save = async () => {
    if (!form.product_name.trim()) return toast.error("Name required");
    if (!form.category_id) return toast.error("Category required");
    const payload = {
      product_name: form.product_name,
      product_description: form.product_description || null,
      product_image: form.product_image || null,
      category_id: form.category_id,
      price: Number(form.price) || 0,
      allergen_warning: form.allergen_warning || null,
      serving_size: form.serving_size || null,
    };
    if (product) {
      const { error } = await supabase.from("products").update(payload).eq("id", product.id);
      if (error) return toast.error(error.message);
    } else {
      const { data: max } = await supabase.from("products").select("display_order").eq("category_id", form.category_id).order("display_order", { ascending: false }).limit(1).maybeSingle();
      const next = (max?.display_order ?? 0) + 1;
      const { error } = await supabase.from("products").insert({ ...payload, display_order: next });
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) {
        setForm({
          product_name: product?.product_name ?? "",
          product_description: product?.product_description ?? "",
          product_image: product?.product_image ?? "",
          category_id: product?.category_id ?? defaultCategoryId ?? "",
          price: String(product?.price ?? 0),
          allergen_warning: product?.allergen_warning ?? "",
          serving_size: product?.serving_size ?? "",
        });
      }
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={form.product_name} onChange={(e) => update("product_name", e.target.value)} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={form.product_description} onChange={(e) => update("product_description", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={(v) => update("category_id", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.category_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Price (₹)</Label><Input type="number" min="0" step="1" value={form.price} onChange={(e) => update("price", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Serving size</Label><Input value={form.serving_size} onChange={(e) => update("serving_size", e.target.value)} /></div>
            <div><Label>Allergen warning</Label><Input value={form.allergen_warning} onChange={(e) => update("allergen_warning", e.target.value)} /></div>
          </div>
          <div>
            <Label>Image URL</Label>
            <Input value={form.product_image} placeholder="https://…" onChange={(e) => update("product_image", e.target.value)} />
            {form.product_image && <img src={form.product_image} alt="" className="mt-2 h-32 w-full rounded-lg object-cover" />}
          </div>
          <Button onClick={save} className="w-full">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
