import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Leaf, Home, Image as ImageIcon, Layers, Coffee, Settings as SettingsIcon, LogOut, LayoutDashboard, Link2 } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/landing", label: "Landing", icon: ImageIcon },
  { to: "/admin/categories", label: "Categories", icon: Layers },
  { to: "/admin/products", label: "Products", icon: Coffee },
  { to: "/admin/footer", label: "Footer Links", icon: Link2 },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });


  if (loading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="text-center max-w-sm">
          <Leaf className="mx-auto h-8 w-8 text-primary" />
          <h1 className="font-display text-2xl mt-3">Sign in required</h1>
          <p className="text-muted-foreground text-sm mt-2">Please sign in to access the admin dashboard.</p>
          <Button className="mt-5" onClick={() => navigate({ to: "/auth" })}>Go to sign in</Button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="text-center max-w-md rounded-2xl bg-card border p-8">
          <Leaf className="mx-auto h-8 w-8 text-primary" />
          <h1 className="font-display text-2xl mt-3">Not authorized</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Your account ({user.email}) doesn't have the <code className="rounded bg-muted px-1">super_admin</code> role.
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            In Supabase, run:
            <code className="block mt-2 rounded bg-muted px-3 py-2 text-left">
              insert into user_roles (user_id, role) values ('{user.id}', 'super_admin');
            </code>
          </p>
          <Button variant="outline" className="mt-5" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden md:flex w-64 flex-col border-r border-border bg-card px-4 py-6">
        <Link to="/" className="flex items-center gap-2 text-primary mb-8 px-2">
          <Leaf className="h-5 w-5" />
          <span className="font-display text-lg">Brew & Berry</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 pt-4 border-t">
          <Link to="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary px-3 py-2">
            <Home className="h-3.5 w-3.5" /> View public menu
          </Link>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-card px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-primary">
          <Leaf className="h-4 w-4" />
          <span className="font-display">Brew & Berry</span>
        </Link>
        <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
      </header>

      <div className="md:hidden sticky top-[57px] z-20 bg-card border-b overflow-x-auto no-scrollbar">
        <nav className="flex gap-1 px-2 py-2 min-w-max">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs whitespace-nowrap ${active ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                <Icon className="h-3.5 w-3.5" />{n.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="md:pl-64 p-4 md:p-8 md:pl-12 max-w-6xl">
        <Outlet />
      </main>
    </div>
  );
}
