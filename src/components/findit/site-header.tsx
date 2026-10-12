import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, Menu, Plus, Search, Shield, User as UserIcon, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFindIt } from "@/hooks/use-findit";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy text-navy-foreground">
        <Search className="h-4 w-4" strokeWidth={2.5} />
      </span>
      <span className="font-display text-lg font-bold">
        Find<span className="text-primary">It</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { currentUser, login, register, logout } = useFindIt();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");

    if (!email || !email.includes("@")) {
      setErr("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (authMode === "register" && name.trim().length < 2) {
      setErr("Please enter your full name.");
      return;
    }

    setBusy(true);
    try {
      if (authMode === "login") {
        await login({ email: email.trim(), password });
        toast.success("Welcome back!");
      } else {
        await register({ name: name.trim(), email: email.trim(), password });
        toast.success("Account created successfully!");
      }
      setAuthOpen(false);
      setName("");
      setEmail("");
      setPassword("");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Authentication failed.";
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const initials = currentUser
    ? currentUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "";

  const navItems = [
    { to: "/" as const, label: "Home" },
    { to: "/browse" as const, label: "Browse" },
    { to: "/my-reports" as const, label: "My reports" },
    ...(currentUser?.role === "ADMIN" ? [{ to: "/admin" as const, label: "Admin" }] : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-secondary data-[status=active]:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild className="hidden rounded-xl sm:inline-flex">
              <Link to="/report">
                <Plus className="h-4 w-4" />
                Report item
              </Link>
            </Button>

            {currentUser ? (
              <div className="flex items-center gap-2">
                <div
                  className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-xs font-bold text-accent-foreground"
                  title={`${currentUser.name} (${currentUser.role})`}
                >
                  {initials}
                </div>
                <div className="hidden flex-col sm:flex">
                  <span className="text-xs font-semibold leading-tight">{currentUser.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    {currentUser.role === "ADMIN" && <Shield className="h-2.5 w-2.5 text-primary" />}
                    {currentUser.role}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    logout();
                    toast.info("Signed out.");
                  }}
                  title="Sign out"
                  className="h-8 px-2 text-xs"
                >
                  <LogOut className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAuthMode("login");
                  setErr("");
                  setAuthOpen(true);
                }}
                className="rounded-xl text-xs font-semibold"
              >
                <LogIn className="mr-1.5 h-3.5 w-3.5" />
                Sign in
              </Button>
            )}

            <button
              className="rounded-lg p-2 md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-border bg-background px-4 py-3 md:hidden">
            {[...navItems, { to: "/report" as const, label: "Report item" }].map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMenuOpen(false)}
                activeOptions={{ exact: n.to === "/" }}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium data-[status=active]:bg-secondary"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* Authentication Dialog */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {authMode === "login" ? "Sign in to FindIt" : "Create your student account"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAuthSubmit} className="space-y-4 pt-2">
            {err && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive">
                {err}
              </div>
            )}

            {authMode === "register" && (
              <div>
                <label className="text-xs font-semibold">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="field mt-1.5"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold">Campus Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@campus.edu"
                className="field mt-1.5"
              />
            </div>

            <div>
              <label className="text-xs font-semibold">Password (min 8 characters)</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="field mt-1.5"
              />
            </div>

            <Button type="submit" disabled={busy} className="w-full rounded-xl">
              {busy ? "Please wait…" : authMode === "login" ? "Sign In" : "Register"}
            </Button>

            <div className="text-center text-xs text-muted-foreground pt-2">
              {authMode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("register");
                      setErr("");
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Register here
                  </button>
                </>
              ) : (
                <>
                  Already registered?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setErr("");
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <Logo />
        <p>Campus Lost & Found · Helping things find their way home.</p>
      </div>
    </footer>
  );
}
