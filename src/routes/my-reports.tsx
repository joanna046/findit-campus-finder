import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, EmptyState, PageHeader } from "@/components/findit/page";
import { ClaimStatusBadge, ItemStatusBadge, TypeBadge } from "@/components/findit/badges";
import { useFindIt } from "@/hooks/use-findit";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/my-reports")({
  head: () => ({
    meta: [
      { title: "My reports — FindIt" },
      { name: "description", content: "Your reported items and claim statuses." },
      { property: "og:title", content: "My reports — FindIt" },
      { property: "og:description", content: "Your reported items and claim statuses." },
    ],
  }),
  component: MyReports,
});

function MyReports() {
  const { items, claims, currentUser } = useFindIt();

  // The backend sends the user id as a number but reporterId/claimantId as strings,
  // so convert to a string before comparing.
  const myId = currentUser ? String(currentUser.id) : null;
  const mine = myId ? items.filter((i) => i.reporterId === myId) : [];
  const myClaims = myId ? claims.filter((c) => c.claimantId === myId) : [];

  return (
    <Container>
      <PageHeader eyebrow="Dashboard" title="My reports" description="Items you've reported and claims you've made." />
      <h2 className="mb-3 text-lg font-semibold">Reported items ({mine.length})</h2>
      {mine.length ? (
        <div className="card-surface divide-y divide-border">
          {mine.map((i) => (
            <Link key={i.id} to="/items/$id" params={{ id: i.id }} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/50">
              <div className="min-w-0"><p className="truncate font-semibold">{i.title}</p><p className="text-xs text-muted-foreground">{i.location} · {formatDate(i.date)} · {claims.filter((c) => c.itemId === i.id).length} claims</p></div>
              <div className="flex gap-2"><TypeBadge type={i.type} /><ItemStatusBadge status={i.status} /></div>
            </Link>
          ))}
        </div>
      ) : <EmptyState title="No reports yet" description={myId ? "Items you report will appear here." : "Sign in to see the items you've reported."} />}
      <h2 className="mb-3 mt-10 text-lg font-semibold">My claims ({myClaims.length})</h2>
      <div className="card-surface divide-y divide-border">
        {myClaims.map((c) => {
          const it = items.find((i) => i.id === c.itemId);
          return (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0"><p className="truncate font-semibold">{it?.title ?? "Removed item"}</p><p className="text-xs text-muted-foreground">{c.message}</p></div>
              <ClaimStatusBadge status={c.status} />
            </div>
          );
        })}
      </div>
    </Container>
  );
}