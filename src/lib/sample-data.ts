import type { Claim, Item, User } from "./types";
import wallet from "@/assets/wallet.jpg";
import backpack from "@/assets/backpack.jpg";
import earbuds from "@/assets/earbuds.jpg";
import bottle from "@/assets/bottle.jpg";

export const CURRENT_USER: User = {
  id: "u1",
  name: "Joanna Saji",
  email: "joanna.saji@campus.edu",
  role: "ADMIN",
};

const d = (daysAgo: number) => {
  const t = new Date(Date.UTC(2026, 9, 12) - daysAgo * 86400000);
  return t.toISOString();
};

export const SAMPLE_ITEMS: Item[] = [
  { id: "i1", type: "LOST", title: "Black leather wallet", description: "Bifold wallet with a small embossed crest. Contains student ID and a metro card.", category: "Wallet", location: "Central Library", date: d(0).slice(0, 10), imageUrl: wallet, status: "OPEN", reporterId: "u1", reporterName: "Joanna Saji", createdAt: d(0) },
  { id: "i2", type: "FOUND", title: "AirPods Pro with case", description: "White earbuds case found on a table near the coffee counter. Case has a small scratch on the lid.", category: "Electronics", location: "Main Cafeteria", date: d(1).slice(0, 10), imageUrl: earbuds, status: "OPEN", reporterId: "u2", reporterName: "Rahul Menon", createdAt: d(1) },
  { id: "i3", type: "FOUND", title: "Navy blue backpack", description: "Navy backpack with a front zip pocket, left on a bench outside the quad. Contains a calculus notebook.", category: "Bag", location: "Engineering Block", date: d(1).slice(0, 10), imageUrl: backpack, status: "CLAIMED", reporterId: "u3", reporterName: "Aisha Khan", createdAt: d(1.5) },
  { id: "i4", type: "LOST", title: "Teal steel water bottle", description: "Hydropeak insulated bottle, teal matte finish. Left on the bleachers after practice.", category: "Water Bottle", location: "Sports Complex", date: d(2).slice(0, 10), imageUrl: bottle, status: "OPEN", reporterId: "u4", reporterName: "Daniel Thomas", createdAt: d(2) },
  { id: "i5", type: "FOUND", title: "Student ID card — Priya N.", description: "College ID card on a red lanyard, Computer Science dept. Found in Lab 3.", category: "ID Card", location: "Science Block", date: d(3).slice(0, 10), status: "RETURNED", reporterId: "u2", reporterName: "Rahul Menon", createdAt: d(3) },
  { id: "i6", type: "LOST", title: "Bike keys with blue tag", description: "Two keys on a ring with a blue plastic tag labelled 'R-14'.", category: "Keys", location: "Parking Lot", date: d(3).slice(0, 10), status: "OPEN", reporterId: "u1", reporterName: "Joanna Saji", createdAt: d(3.2) },
  { id: "i7", type: "FOUND", title: "Grey hoodie (size M)", description: "Plain grey hoodie left on a seat in row F after the cultural fest.", category: "Clothing", location: "Auditorium", date: d(4).slice(0, 10), status: "OPEN", reporterId: "u5", reporterName: "Meera Pillai", createdAt: d(4) },
  { id: "i8", type: "LOST", title: "Data Structures textbook", description: "Cormen 'Introduction to Algorithms', 3rd edition, name written on first page.", category: "Books", location: "Central Library", date: d(5).slice(0, 10), status: "OPEN", reporterId: "u6", reporterName: "Arjun Das", createdAt: d(5) },
  { id: "i9", type: "FOUND", title: "Sony wired earphones", description: "Black in-ear earphones with a tangled cable, found near the hostel common room.", category: "Electronics", location: "Hostel A", date: d(6).slice(0, 10), status: "RETURNED", reporterId: "u1", reporterName: "Joanna Saji", createdAt: d(6) },
  { id: "i10", type: "LOST", title: "Hostel room key", description: "Single brass key with a white tag 'A-212'.", category: "Keys", location: "Hostel A", date: d(7).slice(0, 10), status: "RETURNED", reporterId: "u7", reporterName: "Sneha R.", createdAt: d(7) },
  { id: "i11", type: "FOUND", title: "Casio scientific calculator", description: "fx-991EX found in Exam Hall 2 after the mid-sem paper.", category: "Electronics", location: "Admin Building", date: d(8).slice(0, 10), status: "OPEN", reporterId: "u3", reporterName: "Aisha Khan", createdAt: d(8) },
  { id: "i12", type: "LOST", title: "Brown card holder", description: "Slim card holder with two bank cards and a library card.", category: "Wallet", location: "Main Cafeteria", date: d(9).slice(0, 10), status: "OPEN", reporterId: "u8", reporterName: "Kevin Joseph", createdAt: d(9) },
];

export const SAMPLE_CLAIMS: Claim[] = [
  { id: "c1", itemId: "i3", claimantId: "u1", claimantName: "Joanna Saji", message: "That's my backpack — the notebook has my name on the inside cover.", status: "PENDING", createdAt: d(1) },
  { id: "c2", itemId: "i5", claimantId: "u9", claimantName: "Priya Nair", message: "This is my ID card, roll number CS22B041.", status: "APPROVED", createdAt: d(2.5) },
  { id: "c3", itemId: "i2", claimantId: "u10", claimantName: "Vikram S.", message: "I think these are mine, lost them at lunch.", status: "PENDING", createdAt: d(0.5) },
  { id: "c4", itemId: "i7", claimantId: "u1", claimantName: "Joanna Saji", message: "I left a grey hoodie at the fest.", status: "REJECTED", createdAt: d(3) },
];
