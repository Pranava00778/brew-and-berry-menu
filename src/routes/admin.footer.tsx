import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/footer")({
  component: FooterAdmin,
});

type FooterLink = {
  id: string;
  label: string;
  url: string;
  display_order: number;
  active_status: boolean;
};

function FooterAdmin() {
  const qc = useQueryClient();
  const { data: links = [], isLoading } = useQuery({
    queryKey: ["admin", "footer_links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("footer_links")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as FooterLink[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "footer_links"] });
    qc.invalidateQueries({ queryKey: ["footer_links", "public"] });
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= links.length) return;
    const a = links[idx];
    const b = links[target];
    await Promise.all([
      supabase.from("footer_links").update({ display_order: b.display_order }).eq("id", a.id),
      supabase.from("footer_links").update({ display_order: a.display_order }).eq("id", b.id),
    ]);
    refresh();
  };

  const toggleActive = async (l: FooterLink) => {
    await supabase.from("footer_links").update({ active_status: !l.active_status }).eq("id", l.id);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this link?")) return;
    const { error } = await supabase.from("footer_links").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Link deleted");
    refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-espresso">Footer Links</h1>
          <p className="text-muted-foreground mt-1">Manage links shown in the public menu footer.</p>
        </div>
        <LinkDialog onSaved={refresh} nextOrder={(links.at(-1)?.display_order ?? 0) + 1}>
          <Button><Plus className="h-4 w-4 mr-1" /> New</Button>
        </LinkDialog>
      </div>

      <div className="mt-6 rounded-2xl border bg-card divide-y">
        {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && links.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No footer links yet.</div>
        )}
        {links.map((l, idx) => (
          <div key={l.id} className="flex items-center gap-3 p-4">
            <div className="flex flex-col">
              <button onClick={() => move(idx, -1)} disabled={idx === 0} className="disabled:opacity-30">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button onClick={() => move(idx, 1)} disabled={idx === links.length - 1} className="disabled:opacity-30">
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{l.label}</div>
              <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary truncate">
                {l.url} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Switch checked={l.active_status} onCheckedChange={() => toggleActive(l)} />
            <LinkDialog onSaved={refresh} link={l}>
              <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
            </LinkDialog>
            <Button variant="ghost" size="icon" onClick={() => remove(l.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkDialog({
  children,
  link,
  onSaved,
  nextOrder,
}: {
  children: React.ReactNode;
  link?: FooterLink;
  onSaved: () => void;
  nextOrder?: number;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(link?.label ?? "");
  const [url, setUrl] = useState(link?.url ?? "");
  const [active, setActive] = useState(link?.active_status ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!label.trim() || !url.trim()) {
      toast.error("Label and URL are required");
      return;
    }
    setSaving(true);
    const payload = { label: label.trim(), url: url.trim(), active_status: active };
    const { error } = link
      ? await supabase.from("footer_links").update(payload).eq("id", link.id)
      : await supabase.from("footer_links").insert({ ...payload, display_order: nextOrder ?? 1 });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(link ? "Link updated" : "Link added");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{link ? "Edit link" : "New footer link"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Instagram" />
          </div>
          <div>
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://instagram.com/yourcafe" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
