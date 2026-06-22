import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";

export const Route = createFileRoute("/admin/landing")({
  component: LandingAdmin,
});

function LandingAdmin() {
  const [row, setRow] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("landing_settings").select("*").limit(1).maybeSingle().then(({ data }) => setRow(data));
  }, []);

  if (!row) return <p className="text-muted-foreground">Loading…</p>;

  const update = (patch: any) => setRow({ ...row, ...patch });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("landing_settings").update({
      title: row.title,
      subtitle: row.subtitle,
      cta_text: row.cta_text,
      cover_image: row.cover_image,
      overlay_opacity: row.overlay_opacity,
    }).eq("id", row.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Landing updated");
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl text-espresso">Landing content</h1>
      <p className="text-muted-foreground mt-1">Changes appear instantly on the menu.</p>

      <div className="mt-8 space-y-5">
        <div>
          <Label>Title</Label>
          <Input value={row.title} onChange={(e) => update({ title: e.target.value })} />
        </div>
        <div>
          <Label>Subtitle</Label>
          <Textarea value={row.subtitle} onChange={(e) => update({ subtitle: e.target.value })} rows={2} />
        </div>
        <div>
          <Label>CTA text</Label>
          <Input value={row.cta_text} onChange={(e) => update({ cta_text: e.target.value })} />
        </div>
        <div>
          <Label>Cover image</Label>
          <div className="mt-1">
            <ImageUpload
              value={row.cover_image}
              onChange={(url) => update({ cover_image: url })}
              bucket="products"
              aspect="video"
            />
          </div>
        </div>
        <div>
          <Label>Hero overlay opacity ({row.overlay_opacity})</Label>
          <Slider value={[row.overlay_opacity]} min={0} max={1} step={0.05}
            onValueChange={(v) => update({ overlay_opacity: v[0] })} />
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
