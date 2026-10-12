// Domain models — mirror the planned Spring Boot DTOs / MySQL tables.

export type ItemType = "LOST" | "FOUND";
export type ItemStatus = "OPEN" | "CLAIMED" | "RETURNED";
export type ClaimStatus = "PENDING" | "APPROVED" | "REJECTED";

export const CATEGORIES = [
  "ID Card",
  "Wallet",
  "Bag",
  "Keys",
  "Electronics",
  "Water Bottle",
  "Books",
  "Clothing",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const LOCATIONS = [
  "Central Library",
  "Main Cafeteria",
  "Engineering Block",
  "Science Block",
  "Sports Complex",
  "Auditorium",
  "Hostel A",
  "Parking Lot",
  "Admin Building",
] as const;
export type Location = (typeof LOCATIONS)[number];

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  description: string;
  category: Category;
  location: Location;
  date: string; // ISO date (yyyy-mm-dd)
  imageUrl?: string | undefined;
  status: ItemStatus;
  reporterId: string;
  reporterName: string;
  createdAt: string; // ISO datetime
}

export interface Claim {
  id: string;
  itemId: string;
  claimantId: string;
  claimantName: string;
  message: string;
  status: ClaimStatus;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "ADMIN";
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export type NewItem = Omit<Item, "id" | "status" | "reporterId" | "reporterName" | "createdAt">;
