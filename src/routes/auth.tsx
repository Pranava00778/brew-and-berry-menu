import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Leaf, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Check if we are in a recovery flow (hash contains recovery/access token)
    const hash = window.location.hash;
    if (hash && (hash.includes("type=recovery") || hash.includes("access_token="))) {
      setMode("reset");
    } else {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) navigate({ to: "/admin" });
      });
    }
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
        toast.success("Check your email to confirm — or sign in if confirmation is disabled.");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Password updated successfully. You can now sign in.");
        setMode("login");
        setPassword("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        navigate({ to: "/admin" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      return toast.error("Please enter your email address first.");
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/auth",
      });
      if (error) throw error;
      toast.success("Password reset link sent to your email!");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sand to-background px-4">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border p-8 shadow-lg">
        <div className="flex items-center gap-2 text-primary mb-2">
          <Leaf className="h-5 w-5" />
          <span className="text-xs tracking-[0.3em] uppercase">Brew & Berry</span>
        </div>
        <h1 className="font-title text-3xl text-espresso">
          {mode === "login"
            ? "Admin sign in"
            : mode === "signup"
            ? "Create admin account"
            : "Reset password"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "reset"
            ? "Enter your new password below."
            : "Only the Super Admin can manage the menu."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode !== "reset" && (
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          )}
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">
                {mode === "reset" ? "New Password" : "Password"}
              </Label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-primary hover:underline bg-transparent border-0 cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative mt-1">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground bg-transparent border-0 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Reset Password"}
          </Button>
        </form>

        {mode !== "reset" && (
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="mt-4 w-full text-sm text-muted-foreground hover:text-primary transition-colors bg-transparent border-0 cursor-pointer"
          >
            {mode === "login" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        )}

        {mode === "reset" && (
          <button
            onClick={() => setMode("login")}
            className="mt-4 w-full text-sm text-muted-foreground hover:text-primary transition-colors bg-transparent border-0 cursor-pointer"
          >
            Back to sign in
          </button>
        )}

        {mode !== "reset" && (
          <p className="mt-6 text-xs text-muted-foreground text-center">
            After signing up, assign yourself the <code className="rounded bg-muted px-1">super_admin</code> role in Supabase to access the dashboard.
          </p>
        )}
      </div>
    </div>
  );
}
