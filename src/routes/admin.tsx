import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Container, PageHeader } from "@/components/findit/page";
import { ClaimStatusBadge, TypeBadge } from "@/components/findit/badges";
import { useFindIt } from "@/hooks/use-findit";
import type { ItemStatus } from "@/lib/types";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — FindIt" },
      { name: "description", content: "Review reports and claims and update item status." },
      { property: "og:title", content: "Admin dashboard — FindIt" },
      { property: "og:description", content: "Review reports and claims and update item status." },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { items, claims, updateItemStatus, updateClaimStatus, deleteItem, resetData } = useFindIt();
  const pending = claims.filter((c) => c.status === "PENDING");
  return (
    <Container>
      <PageHeader eyebrow="Admin" title="Admin dashboard" description="Review claims and keep item statuses up to date."
        actions={<Button variant="outline" onClick={async () => { await resetData(); toast.success("Sample data restored."); }}>Reset sample data</Button>} />
      <h2 className="mb-3 text-lg font-semibold">Pending claims ({pending.length})</h2>
      <div className="card-surface divide-y divide-border">
        {pending.length === 0 && <p className="p-4 text-sm text-muted-foreground">No pending claims.</p>}
        {claims.map((c) => {
          const it = items.find((i) => i.id === c.itemId);
          return (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0"><p className="font-semibold">{c.claimantName} → {it?.title}</p><p className="text-xs text-muted-foreground">{c.message}</p></div>
              {c.status === "PENDING" ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateClaimStatus(c.id, "APPROVED")}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => updateClaimStatus(c.id, "REJECTED")}>Reject</Button>
                </div>
              ) : <ClaimStatusBadge status={c.status} />}
            </div>
          );
        })}
      </div>
      <h2 className="mb-3 mt-10 text-lg font-semibold">All reports ({items.length})</h2>
      <div className="card-surface divide-y divide-border">
        {items.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <Link to="/items/$id" params={{ id: i.id }} className="flex min-w-0 items-center gap-3"><TypeBadge type={i.type} /><span className="truncate font-semibold">{i.title}</span></Link>
            <div className="flex gap-2">
              <select className="field h-9 w-32" value={i.status} onChange={(e) => updateItemStatus(i.id, e.target.value as ItemStatus)} aria-label="Status">
                <option>OPEN</option><option>CLAIMED</option><option>RETURNED</option>
              </select>
              <Button size="sm" variant="ghost" onClick={() => deleteItem(i.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
