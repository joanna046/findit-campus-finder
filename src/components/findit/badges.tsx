import { cn } from "@/lib/utils";
import type { ClaimStatus, ItemStatus, ItemType } from "@/lib/types";

const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider";

export function TypeBadge({ type, className }: { type: ItemType; className?: string }) {
  return (
    <span className={cn(base, type === "LOST" ? "bg-lost-soft text-lost" : "bg-found-soft text-found", className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", type === "LOST" ? "bg-lost" : "bg-found")} />
      {type}
    </span>
  );
}

const itemStatusStyle: Record<ItemStatus, string> = {
  OPEN: "bg-primary-soft text-accent-foreground",
  CLAIMED: "bg-warning-soft text-warning",
  RETURNED: "bg-found-soft text-found",
};
export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return <span className={cn(base, itemStatusStyle[status])}>{status}</span>;
}

const claimStyle: Record<ClaimStatus, string> = {
  PENDING: "bg-warning-soft text-warning",
  APPROVED: "bg-found-soft text-found",
  REJECTED: "bg-lost-soft text-lost",
};
export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <span className={cn(base, claimStyle[status])}>{status}</span>;
}
