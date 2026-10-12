import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Container, EmptyState, PageHeader } from "@/components/findit/page";
import { ItemCard } from "@/components/findit/item-card";
import { useFindIt } from "@/hooks/use-findit";
import { CATEGORIES, LOCATIONS, type ItemType } from "@/lib/types";

type Sort = "recent" | "oldest" | "az";
interface BrowseSearch {
  q?: string | undefined;
  category?: string | undefined;
  location?: string | undefined;
  status?: ItemType | undefined;
  sort?: Sort | undefined;
}

export const Route = createFileRoute("/browse")({
  validateSearch: (s: Record<string, unknown>): BrowseSearch => ({
    q: typeof s["q"] === "string" ? s["q"] : undefined,
    category: typeof s["category"] === "string" ? s["category"] : undefined,
    location: typeof s["location"] === "string" ? s["location"] : undefined,
    status: s["status"] === "LOST" || s["status"] === "FOUND" ? s["status"] : undefined,
    sort: s["sort"] === "oldest" || s["sort"] === "az" ? s["sort"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Browse lost & found items — FindIt" },
      { name: "description", content: "Search and filter every lost and found item reported on campus." },
      { property: "og:title", content: "Browse lost & found items — FindIt" },
      { property: "og:description", content: "Search and filter every lost and found item reported on campus." },
    ],
  }),
  component: Browse,
});

function Browse() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/browse" });
  const { items } = useFindIt();
  const set = (patch: Partial<BrowseSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const results = useMemo(() => {
    const q = (search.q ?? "").toLowerCase();
    const list = items.filter(
      (i) =>
        (!q || i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)) &&
        (!search.category || i.category === search.category) &&
        (!search.location || i.location === search.location) &&
        (!search.status || i.type === search.status),
    );
    const sort = search.sort ?? "recent";
    return list.sort((a, b) =>
      sort === "az" ? a.title.localeCompare(b.title) : sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt),
    );
  }, [items, search]);

  const active = !!(search.q || search.category || search.location || search.status);

  return (
    <Container>
      <PageHeader eyebrow="Browse" title="All reported items" description="Search by name or description and narrow down by category, location or status." />

      <div className="card-surface sticky top-20 z-30 p-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_repeat(4,auto)]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search.q ?? ""}
              onChange={(e) => set({ q: e.target.value || undefined })}
              placeholder="Search items…"
              className="field pl-9"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:contents">
            <select className="field lg:w-40" value={search.category ?? ""} onChange={(e) => set({ category: e.target.value || undefined })} aria-label="Category">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="field lg:w-44" value={search.location ?? ""} onChange={(e) => set({ location: e.target.value || undefined })} aria-label="Location">
              <option value="">All locations</option>
              {LOCATIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="field lg:w-32" value={search.status ?? ""} onChange={(e) => set({ status: (e.target.value || undefined) as ItemType | undefined })} aria-label="Status">
              <option value="">Lost & found</option>
              <option value="LOST">Lost</option>
              <option value="FOUND">Found</option>
            </select>
            <select className="field lg:w-36" value={search.sort ?? "recent"} onChange={(e) => set({ sort: e.target.value === "recent" ? undefined : (e.target.value as Sort) })} aria-label="Sort">
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest first</option>
              <option value="az">Name A–Z</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" />{results.length} item{results.length === 1 ? "" : "s"}</span>
        {active && (
          <button onClick={() => navigate({ search: {} })} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            <X className="h-4 w-4" /> Clear filters
          </button>
        )}
      </div>

      <div className="mt-4">
        {results.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((i) => <ItemCard key={i.id} item={i} />)}
          </div>
        ) : (
          <EmptyState
            title="No items match"
            description="Try a different search term or remove some filters."
            action={<Button variant="outline" onClick={() => navigate({ search: {} })}>Clear filters</Button>}
          />
        )}
      </div>
    </Container>
  );
}
