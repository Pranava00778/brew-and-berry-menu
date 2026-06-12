import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { GripVertical, Plus, Pencil, Trash2 } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/admin/super-categories")({
  component: SuperCategoriesAdmin,
});

type Sup = { id: string; super_category_name: string; display_order: number; active_status: boolean };
type Cat = { id: string; category_name: string; super_category_id: string | null; display_order: number };

function SuperCategoriesAdmin() {
  const qc = useQueryClient();

  const { data: sups = [] } = useQuery({
    queryKey: ["admin", "super_categories"],
    queryFn: async () => {
      const { data } = await supabase.from("super_categories").select("*").order("display_order");
      return (data ?? []) as Sup[];
    },
  });

  const { data: cats = [] } = useQuery({
    queryKey: ["admin", "categories", "with-super"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id,category_name,super_category_id,display_order")
        .order("display_order");
      return (data ?? []) as Cat[];
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = sups.findIndex((s) => s.id === active.id);
    const newIdx = sups.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sups, oldIdx, newIdx);
    qc.setQueryData(["admin", "super_categories"], reordered);
    await Promise.all(
      reordered.map((s, i) => supabase.from("super_categories").update({ display_order: i + 1 }).eq("id", s.id))
    );
    qc.invalidateQueries({ queryKey: ["super_categories", "public"] });
    toast.success("Order saved");
  };

  const assign = async (categoryId: string, superId: string | null) => {
    const { error } = await supabase
      .from("categories")
      .update({ super_category_id: superId })
      .eq("id", categoryId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin", "categories", "with-super"] });
    qc.invalidateQueries({ queryKey: ["categories", "public"] });
    toast.success("Saved");
  };

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-espresso">Super Categories</h1>
            <p className="text-muted-foreground mt-1">Top-level groups (e.g. Beverage, Food). Drag to reorder.</p>
          </div>
          <SupDialog onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "super_categories"] })}>
            <Button><Plus className="h-4 w-4 mr-1" /> New</Button>
          </SupDialog>
        </div>

        <div className="mt-6 rounded-2xl border bg-card divide-y">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={sups.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {sups.map((s) => (
                <Row
                  key={s.id}
                  sup={s}
                  onChanged={() => qc.invalidateQueries({ queryKey: ["admin", "super_categories"] })}
                />
              ))}
            </SortableContext>
          </DndContext>
          {sups.length === 0 && <p className="p-6 text-muted-foreground text-sm">No super categories yet.</p>}
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl text-espresso">Assign secondary categories</h2>
        <p className="text-muted-foreground text-sm mt-1">Place each category under a super category.</p>
        <div className="mt-4 rounded-2xl border bg-card divide-y">
          {cats.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.category_name}</p>
              </div>
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={c.super_category_id ?? ""}
                onChange={(e) => assign(c.id, e.target.value || null)}
              >
                <option value="">— Unassigned —</option>
                {sups.map((s) => (
                  <option key={s.id} value={s.id}>{s.super_category_name}</option>
                ))}
              </select>
            </div>
          ))}
          {cats.length === 0 && <p className="p-6 text-muted-foreground text-sm">No categories yet.</p>}
        </div>
      </div>
    </div>
  );
}

function Row({ sup, onChanged }: { sup: Sup; onChanged: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sup.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const toggle = async (v: boolean) => {
    await supabase.from("super_categories").update({ active_status: v }).eq("id", sup.id);
    onChanged();
  };
  const del = async () => {
    if (!confirm(`Delete "${sup.super_category_name}"? Categories under it will become unassigned.`)) return;
    const { error } = await supabase.from("super_categories").delete().eq("id", sup.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onChanged();
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-card">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none">
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{sup.super_category_name}</p>
        <p className="text-xs text-muted-foreground">Order #{sup.display_order}</p>
      </div>
      <Switch checked={sup.active_status} onCheckedChange={toggle} />
      <SupDialog sup={sup} onSaved={onChanged}>
        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
      </SupDialog>
      <Button variant="ghost" size="icon" onClick={del}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}

function SupDialog({ children, sup, onSaved }: { children: React.ReactNode; sup?: Sup; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(sup?.super_category_name ?? "");

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    if (sup) {
      const { error } = await supabase
        .from("super_categories")
        .update({ super_category_name: name })
        .eq("id", sup.id);
      if (error) return toast.error(error.message);
    } else {
      const { data: max } = await supabase
        .from("super_categories")
        .select("display_order")
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const next = (max?.display_order ?? 0) + 1;
      const { error } = await supabase
        .from("super_categories")
        .insert({ super_category_name: name, display_order: next });
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setName(sup?.super_category_name ?? "");
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{sup ? "Edit super category" : "New super category"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Beverage" /></div>
          <Button onClick={save} className="w-full">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
