import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, MapPin, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/findit/page";
import { ItemStatusBadge, TypeBadge } from "@/components/findit/badges";
import { ItemImage } from "@/components/findit/item-image";
import { useFindIt } from "@/hooks/use-findit";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/items/$id")({
  head: () => ({
    meta: [
      { title: "Item details — FindIt" },
      { name: "description", content: "View item details and submit a claim on FindIt." },
      { property: "og:title", content: "Item details — FindIt" },
      { property: "og:description", content: "View item details and submit a claim on FindIt." },
    ],
  }),
  component: ItemDetail,
});

function ItemDetail() {
  const { id } = Route.useParams();
  const { items, claims, createClaim, currentUser } = useFindIt();
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const item = items.find((i) => i.id === id);
  if (!item)
    return (
      <Container>
        <div className="py-16"><EmptyState title="Item not found" description="It may have been removed." action={<Button asChild><Link to="/browse">Browse items</Link></Button>} /></div>
      </Container>
    );

  // Convert to string: the backend sends the user id as a number.
  const myId = currentUser ? String(currentUser.id) : null;
  const mine = myId ? claims.find((c) => c.itemId === id && c.claimantId === myId) : undefined;
  const own = myId !== null && item.reporterId === myId;

  const submit = async () => {
    if (busy) return;
    if (msg.trim().length < 10) return setErr("Describe proof of ownership (at least 10 characters).");
    setErr("");
    setBusy(true);
    try {
      await createClaim(item.id, msg.trim());
      setMsg("");
      toast.success("Claim submitted for review.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit your claim. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container>
      <Link to="/browse" className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to items</Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="card-surface overflow-hidden"><ItemImage item={item} className="aspect-[4/3] w-full" /></div>
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2"><TypeBadge type={item.type} /><ItemStatusBadge status={item.status} /></div>
          <div>
            <p className="text-sm font-semibold text-primary">{item.category}</p>
            <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{item.title}</h1>
            <p className="mt-4 text-muted-foreground">{item.description}</p>
          </div>
          <div className="card-surface grid gap-3 p-5 text-sm sm:grid-cols-3">
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{item.location}</span>
            <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{formatDate(item.date)}</span>
            <span className="flex items-center gap-2"><User className="h-4 w-4 text-primary" />{item.reporterName}</span>
          </div>
          <div className="card-surface p-5">
            {own ? (
              <p className="text-sm text-muted-foreground">You reported this item. Track claims in <Link to="/my-reports" className="font-semibold text-primary">My reports</Link>.</p>
            ) : mine ? (
              <p className="text-sm">Your claim is <strong>{mine.status.toLowerCase()}</strong>.</p>
            ) : item.status !== "OPEN" ? (
              <p className="text-sm text-muted-foreground">This item is no longer accepting claims.</p>
            ) : (
              <>
                <h2 className="font-semibold">{item.type === "FOUND" ? "Is this yours?" : "Have you found this?"}</h2>
                <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Describe identifying details…" className="field mt-3 h-24 py-3" />
                {err && <p className="mt-1 text-xs font-medium text-destructive">{err}</p>}
                <Button onClick={submit} disabled={busy} className="mt-3 w-full rounded-xl">{busy ? "Submitting…" : "Submit a claim"}</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}