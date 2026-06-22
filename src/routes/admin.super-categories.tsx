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

type SuperCat = {
  id: string;
  super_category_name: string;
  display_order: number;
  active_status: boolean;
};

function SuperCategoriesAdmin() {
  const qc = useQueryClient();
  const { data: superCats = [] } = useQuery({
    queryKey: ["admin", "super_categories"],
    queryFn: async () => {
      const { data } = await supabase.from("super_categories").select("*").order("display_order");
      return (data ?? []) as SuperCat[];
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = superCats.findIndex((sc) => sc.id === active.id);
    const newIdx = superCats.findIndex((sc) => sc.id === over.id);
    const reordered = arrayMove(superCats, oldIdx, newIdx);
    qc.setQueryData(["admin", "super_categories"], reordered);
    const updates = reordered.map((sc, i) =>
      supabase.from("super_categories").update({ display_order: i + 1 }).eq("id", sc.id)
    );
    await Promise.all(updates);
    qc.invalidateQueries({ queryKey: ["super_categories", "public"] });
    toast.success("Order saved");
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-title text-3xl text-espresso">Super Categories</h1>
          <p className="text-muted-foreground mt-1">Drag to reorder. Toggle to hide.</p>
        </div>
        <SuperCategoryDialog onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "super_categories"] })}>
          <Button><Plus className="h-4 w-4 mr-1" /> New</Button>
        </SuperCategoryDialog>
      </div>

      <div className="mt-6 rounded-2xl border bg-card divide-y overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={superCats.map((sc) => sc.id)} strategy={verticalListSortingStrategy}>
            {superCats.map((sc) => (
              <Row
                key={sc.id}
                superCat={sc}
                onChanged={() => qc.invalidateQueries({ queryKey: ["admin", "super_categories"] })}
              />
            ))}
          </SortableContext>
        </DndContext>
        {superCats.length === 0 && <p className="p-6 text-muted-foreground text-sm">No super categories yet.</p>}
      </div>
    </div>
  );
}

function Row({ superCat, onChanged }: { superCat: SuperCat; onChanged: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: superCat.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const toggle = async (v: boolean) => {
    await supabase.from("super_categories").update({ active_status: v }).eq("id", superCat.id);
    onChanged();
  };

  const del = async () => {
    if (!confirm(`Delete "${superCat.super_category_name}"? Categories in it will be unassigned.`)) return;
    const { error } = await supabase.from("super_categories").delete().eq("id", superCat.id);
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
        <p className="font-medium truncate">{superCat.super_category_name}</p>
        <p className="text-xs text-muted-foreground">Order #{superCat.display_order}</p>
      </div>
      <Switch checked={superCat.active_status} onCheckedChange={toggle} />
      <SuperCategoryDialog superCat={superCat} onSaved={onChanged}>
        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
      </SuperCategoryDialog>
      <Button variant="ghost" size="icon" onClick={del}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}

function SuperCategoryDialog({
  children,
  superCat,
  onSaved,
}: {
  children: React.ReactNode;
  superCat?: SuperCat;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(superCat?.super_category_name ?? "");

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    if (superCat) {
      const { error } = await supabase
        .from("super_categories")
        .update({ super_category_name: name })
        .eq("id", superCat.id);
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
        if (o && superCat) {
          setName(superCat.super_category_name);
        } else if (o) {
          setName("");
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{superCat ? "Edit super category" : "New super category"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button onClick={save} className="w-full">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
