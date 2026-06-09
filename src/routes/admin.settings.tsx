import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/settings")({
  component: Settings,
});

function Settings() {
  const { user } = useAuth();
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl text-espresso">Settings</h1>
      <p className="text-muted-foreground mt-1">Account & system info.</p>

      <div className="mt-6 rounded-2xl border bg-card p-6 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{user?.email}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">User ID</span><code className="text-xs">{user?.id}</code></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span>super_admin</span></div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Image uploads currently use external URLs. Paste any public image URL into the image fields.
      </p>
    </div>
  );
}
