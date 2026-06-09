import { createServerFn } from "@tanstack/react-start";

export const ensureMenuImagesBucket = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin.storage.getBucket("menu-images");
  if (existing) return { ok: true, created: false };
  const { error } = await supabaseAdmin.storage.createBucket("menu-images", {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"],
  });
  if (error && !/already exists/i.test(error.message)) throw error;
  return { ok: true, created: true };
});
