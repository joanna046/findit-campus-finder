import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import type { Item } from "@/lib/types";
import { TypeBadge } from "./badges";
import { ItemImage } from "./item-image";
import { formatDate } from "@/lib/format";

export function ItemCard({ item }: { item: Item }) {
  return (
    <Link
      to="/items/$id"
      params={{ id: item.id }}
      className="group card-surface flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <ItemImage item={item} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
        <TypeBadge type={item.type} className="absolute left-3 top-3 shadow-card" />
        {item.status !== "OPEN" && (
          <span className="absolute right-3 top-3 rounded-full bg-navy/85 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-navy-foreground">
            {item.status}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-semibold text-primary">{item.category}</p>
        <h3 className="line-clamp-1 text-base font-semibold">{item.title}</h3>
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{item.location}</span>
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(item.date)}</span>
        </div>
      </div>
    </Link>
  );
}
