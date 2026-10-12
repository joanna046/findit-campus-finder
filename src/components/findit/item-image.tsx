import { Backpack, BookOpen, CreditCard, CupSoda, Headphones, KeyRound, Package, Shirt, Wallet } from "lucide-react";
import { resolveImageUrl } from "@/lib/api";
import type { Category, Item } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CATEGORY_ICON: Record<Category, typeof Wallet> = {
  "ID Card": CreditCard,
  Wallet: Wallet,
  Bag: Backpack,
  Keys: KeyRound,
  Electronics: Headphones,
  "Water Bottle": CupSoda,
  Books: BookOpen,
  Clothing: Shirt,
  Other: Package,
};

export function ItemImage({ item, className }: { item: Item; className?: string }) {
  const src = resolveImageUrl(item.imageUrl);
  if (src) {
    return <img src={src} alt={item.title} loading="lazy" className={cn("object-cover", className)} />;
  }
  const Icon = CATEGORY_ICON[item.category];
  return (
    <div className={cn("grid place-items-center bg-primary-soft", className)}>
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-card shadow-card">
        <Icon className="h-8 w-8 text-primary" strokeWidth={1.6} />
      </div>
    </div>
  );
}