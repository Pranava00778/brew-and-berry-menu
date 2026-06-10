import { createServerFn } from "@tanstack/react-start";

const BUCKETS = ["products", "categories"] as const;

export const ensureMenuImagesBucket = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results: Record<string, boolean> = {};
  for (const name of BUCKETS) {
    const { data: existing } = await supabaseAdmin.storage.getBucket(name);
    if (existing) {
      results[name] = false;
      continue;
    }
    const { error } = await supabaseAdmin.storage.createBucket(name, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"],
    });
    if (error && !/already exists/i.test(error.message)) throw error;
    results[name] = true;
  }
  return { ok: true, created: results };
});
