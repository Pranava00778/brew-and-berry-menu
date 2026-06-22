import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

function pathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length);
}

function bucketFromPublicUrl(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/public\/([^/]+)\//);
  return m ? m[1] : null;
}

export function ImageUpload({
  value,
  onChange,
  bucket,
  aspect = "video",
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  bucket: "products" | "categories";
  aspect?: "video" | "square";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      // delete previous if it was in our bucket
      if (value) {
        const oldBucket = bucketFromPublicUrl(value);
        const old = oldBucket ? pathFromPublicUrl(value, oldBucket) : null;
        if (oldBucket && old) await supabase.storage.from(oldBucket).remove([old]);
      }
      onChange(data.publicUrl);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const del = async () => {
    if (!value) return;
    if (!confirm("Delete this image?")) return;
    setBusy(true);
    try {
      const oldBucket = bucketFromPublicUrl(value);
      const old = oldBucket ? pathFromPublicUrl(value, oldBucket) : null;
      if (oldBucket && old) await supabase.storage.from(oldBucket).remove([old]);
      onChange(null);
      toast.success("Image deleted");
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!busy) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (busy) return;
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) {
      upload(f);
    } else if (f) {
      toast.error("Only image files are allowed");
    }
  };

  const aspectCls = aspect === "square" ? "aspect-square" : "aspect-video";

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !value && !busy && inputRef.current?.click()}
        className={`relative ${aspectCls} w-full overflow-hidden rounded-xl border transition-all duration-200 cursor-pointer ${
          isDragging
            ? "border-primary bg-primary/10 scale-[1.01]"
            : value
            ? "border-border hover:border-muted-foreground/50"
            : "border-dashed border-muted-foreground/30 bg-muted hover:border-muted-foreground/60 hover:bg-muted/70"
        }`}
      >
        {value ? (
          <div className="group relative h-full w-full">
            <img src={value} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-medium bg-black/60 px-3 py-1.5 rounded-full flex items-center gap-1">
                <Upload className="h-3.5 w-3.5" /> Drop to replace
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
            <div className="rounded-full bg-background p-2.5 shadow-sm border border-border">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                {isDragging ? "Drop your image here" : "Drag & drop image"}
              </p>
              <p className="text-[10px]">
                or <span className="text-primary hover:underline">browse files</span>
              </p>
            </div>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[1px]">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-[10px] font-medium text-muted-foreground">Uploading...</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" />
          {value ? "Reupload" : "Upload"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={del}>
            <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Delete
          </Button>
        )}
      </div>
    </div>
  );
}
