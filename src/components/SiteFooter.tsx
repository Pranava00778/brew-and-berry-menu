import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type FooterLink = {
  id: string;
  label: string;
  url: string;
  display_order: number;
  active_status: boolean;
};

export function SiteFooter() {
  const { data: links } = useQuery({
    queryKey: ["footer_links", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("footer_links")
        .select("*")
        .eq("active_status", true)
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as FooterLink[];
    },
  });

  return (
    <footer className="border-t border-border bg-card mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Brew & Berry
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 justify-center">
          {(links ?? []).map((l) => (
            <a
              key={l.id}
              href={l.url}
              target={l.url.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
