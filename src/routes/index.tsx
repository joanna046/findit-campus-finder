import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, PackageSearch, Search, Sparkles, Handshake } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/findit/page";
import { ItemCard } from "@/components/findit/item-card";
import { CATEGORY_ICON } from "@/components/findit/item-image";
import { useFindIt } from "@/hooks/use-findit";
import { CATEGORIES } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FindIt — Smart Lost & Found for Campus" },
      { name: "description", content: "Report, search and reclaim lost items across campus. Track lost, found and returned items in one place." },
      { property: "og:title", content: "FindIt — Smart Lost & Found for Campus" },
      { property: "og:description", content: "Report, search and reclaim lost items across campus." },
    ],
  }),
  component: Home,
});

function Home() {
  const { items } = useFindIt();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const lost = items.filter((i) => i.type === "LOST" && i.status !== "RETURNED").length;
  const found = items.filter((i) => i.type === "FOUND" && i.status !== "RETURNED").length;
  const returned = items.filter((i) => i.status === "RETURNED").length;
  const recent = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate({ to: "/browse", search: { q: q.trim() || undefined } });
  };

  const stats = [
    { label: "Lost items", value: lost, icon: PackageSearch, tone: "bg-lost-soft text-lost", status: "LOST" as const },
    { label: "Found items", value: found, icon: Sparkles, tone: "bg-found-soft text-found", status: "FOUND" as const },
    { label: "Returned to owners", value: returned, icon: Handshake, tone: "bg-primary-soft text-primary", status: undefined },
  ];

  return (
    <>
      <section className="bg-hero border-b border-border/60">
        <Container>
          <div className="mx-auto max-w-3xl py-16 text-center sm:py-24">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-card">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Welcome back, Joanna
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] sm:text-6xl">
              Lost something on campus?<br />
              <span className="text-primary">Let's find it.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Search reported items, post what you've lost or found, and get it back to its owner — fast.
            </p>
            <form onSubmit={submit} className="mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-lift">
              <Search className="ml-3 h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search wallets, ID cards, keys…"
                className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <Button type="submit" className="h-11 rounded-xl px-5">Search</Button>
            </form>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {CATEGORIES.slice(0, 6).map((c) => {
                const Icon = CATEGORY_ICON[c];
                return (
                  <Link key={c} to="/browse" search={{ category: c }} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                    <Icon className="h-3.5 w-3.5" />{c}
                  </Link>
                );
              })}
            </div>
          </div>
        </Container>
      </section>

      <Container>
        <div className="-mt-10 grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <Link key={s.label} to="/browse" search={{ status: s.status }} className="card-surface flex items-center gap-4 p-5 transition-shadow hover:shadow-lift">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${s.tone}`}><s.icon className="h-6 w-6" /></span>
              <div>
                <p className="font-display text-3xl font-bold">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-16 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Recently reported</h2>
            <p className="mt-1 text-sm text-muted-foreground">The latest items posted by the campus community.</p>
          </div>
          <Link to="/browse" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {recent.map((i) => <ItemCard key={i.id} item={i} />)}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-3xl bg-navy p-8 text-navy-foreground sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-2xl font-bold">Found something that isn't yours?</h2>
            <p className="mt-2 text-navy-foreground/70">Post it in under a minute and help a classmate out.</p>
          </div>
          <Button asChild size="lg" className="rounded-xl">
            <Link to="/report">Report an item <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </Container>
    </>
  );
}
