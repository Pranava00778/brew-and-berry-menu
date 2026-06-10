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
import { ImageUpload } from "@/components/ImageUpload";

export const Route = createFileRoute("/admin/categories")({
  component: CategoriesAdmin,
});

type Cat = { id: string; category_name: string; category_image: string | null; display_order: number; active_status: boolean };

function CategoriesAdmin() {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("display_order");
      return (data ?? []) as Cat[];
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = cats.findIndex((c) => c.id === active.id);
    const newIdx = cats.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(cats, oldIdx, newIdx);
    qc.setQueryData(["admin", "categories"], reordered);
    const updates = reordered.map((c, i) =>
      supabase.from("categories").update({ display_order: i + 1 }).eq("id", c.id)
    );
    await Promise.all(updates);
    qc.invalidateQueries({ queryKey: ["categories", "public"] });
    toast.success("Order saved");
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-espresso">Categories</h1>
          <p className="text-muted-foreground mt-1">Drag to reorder. Toggle to hide.</p>
        </div>
        <CategoryDialog onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "categories"] })}>
          <Button><Plus className="h-4 w-4 mr-1" /> New</Button>
        </CategoryDialog>
      </div>

      <div className="mt-6 rounded-2xl border bg-card divide-y">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={cats.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {cats.map((c) => <Row key={c.id} cat={c} onChanged={() => qc.invalidateQueries({ queryKey: ["admin", "categories"] })} />)}
          </SortableContext>
        </DndContext>
        {cats.length === 0 && <p className="p-6 text-muted-foreground text-sm">No categories yet.</p>}
      </div>
    </div>
  );
}

function Row({ cat, onChanged }: { cat: Cat; onChanged: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const toggle = async (v: boolean) => {
    await supabase.from("categories").update({ active_status: v }).eq("id", cat.id);
    onChanged();
  };
  const del = async () => {
    if (!confirm(`Delete "${cat.category_name}" and all its products?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", cat.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onChanged();
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-card">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none">
        <GripVertical className="h-5 w-5" />
      </button>
      {cat.category_image ? (
        <img src={cat.category_image} alt="" className="h-12 w-12 rounded-full object-cover" />
      ) : (
        <div className="h-12 w-12 rounded-full bg-secondary" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{cat.category_name}</p>
        <p className="text-xs text-muted-foreground">Order #{cat.display_order}</p>
      </div>
      <Switch checked={cat.active_status} onCheckedChange={toggle} />
      <CategoryDialog cat={cat} onSaved={onChanged}>
        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
      </CategoryDialog>
      <Button variant="ghost" size="icon" onClick={del}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}

function CategoryDialog({ children, cat, onSaved }: { children: React.ReactNode; cat?: Cat; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(cat?.category_name ?? "");
  const [image, setImage] = useState(cat?.category_image ?? "");

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    if (cat) {
      const { error } = await supabase.from("categories").update({ category_name: name, category_image: image || null }).eq("id", cat.id);
      if (error) return toast.error(error.message);
    } else {
      const { data: max } = await supabase.from("categories").select("display_order").order("display_order", { ascending: false }).limit(1).maybeSingle();
      const next = (max?.display_order ?? 0) + 1;
      const { error } = await supabase.from("categories").insert({ category_name: name, category_image: image || null, display_order: next });
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && cat) { setName(cat.category_name); setImage(cat.category_image ?? ""); } else if (o) { setName(""); setImage(""); } }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{cat ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Image</Label>
            <div className="mt-1"><ImageUpload value={image} onChange={(u) => setImage(u ?? "")} bucket="categories" aspect="video" /></div>
          </div>
          <Button onClick={save} className="w-full">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
