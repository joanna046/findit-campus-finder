/**
 * FindIt API service layer.
 * Connects the React frontend to the Python FastAPI backend.
 */

import type {
  AuthResponse,
  Claim,
  ClaimStatus,
  Item,
  ItemStatus,
  LoginCredentials,
  NewItem,
  RegisterCredentials,
  User,
} from "./types";

import { SAMPLE_CLAIMS, SAMPLE_ITEMS } from "./sample-data";

export const API_BASE_URL =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ??
  "http://localhost:8000";

const TOKEN_KEY = "findit:auth_token";
const USER_KEY = "findit:auth_user";
const MOCK_STORAGE_KEY = "findit:v1";

// -----------------------------------------------------------------------------
// Token and session storage
// -----------------------------------------------------------------------------

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;

  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Storage unavailable.
  }
}

export function getCachedUser(): User | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: User | null): void {
  if (typeof window === "undefined") return;

  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    // Storage unavailable.
  }
}

// -----------------------------------------------------------------------------
// HTTP client
// -----------------------------------------------------------------------------

export async function http<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = getAuthToken();

  if (
    init?.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    setAuthToken(null);
    setCachedUser(null);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const body = await response.json();

      if (body?.detail) {
        message =
          typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
      }
    } catch {
      // Response was not JSON.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

// -----------------------------------------------------------------------------
// Image upload
// -----------------------------------------------------------------------------

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Uploads the real image file to POST /api/upload.
 * Returns the short path from the server, e.g. "/uploads/abc123.jpg".
 * That path (not the image data) is what gets saved in MySQL.
 */
export async function uploadImage(file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Unsupported image format. Please use JPEG, PNG, WebP or GIF.");
  }

  const formData = new FormData();
  formData.append("file", file);

  // http() skips the JSON Content-Type for FormData, adds the auth token,
  // and turns server errors into readable messages.
  const data = await http<{ url: string; filename: string }>("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!data.url) {
    throw new Error("The server did not return an image path.");
  }

  return data.url;
}

/**
 * Turns a stored path like "/uploads/abc.jpg" into a full URL the browser can
 * load. Other values (sample-data images, full https:// URLs) pass through.
 */
export function resolveImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("/uploads/")) return `${API_BASE_URL}${url}`;
  return url;
}

// -----------------------------------------------------------------------------
// Authentication
// -----------------------------------------------------------------------------

export async function register(
  credentials: RegisterCredentials
): Promise<AuthResponse> {
  const data = await http<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  setAuthToken(data.access_token);
  setCachedUser(data.user);

  return data;
}

export async function login(
  credentials: LoginCredentials
): Promise<AuthResponse> {
  const data = await http<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  setAuthToken(data.access_token);
  setCachedUser(data.user);

  return data;
}

export async function fetchMe(): Promise<User | null> {
  if (!getAuthToken()) return null;

  try {
    const user = await http<User>("/api/auth/me");
    setCachedUser(user);
    return user;
  } catch {
    setAuthToken(null);
    setCachedUser(null);
    return null;
  }
}

export function logout(): void {
  setAuthToken(null);
  setCachedUser(null);
}

// -----------------------------------------------------------------------------
// Items and claims data
// -----------------------------------------------------------------------------

export interface DB {
  items: Item[];
  claims: Claim[];
}

function loadLocalFallback(): DB {
  if (typeof window === "undefined") {
    return {
      items: SAMPLE_ITEMS,
      claims: SAMPLE_CLAIMS,
    };
  }

  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);

    if (raw) {
      return JSON.parse(raw) as DB;
    }
  } catch {
    // Ignore invalid cached data.
  }

  return {
    items: SAMPLE_ITEMS,
    claims: SAMPLE_CLAIMS,
  };
}

function saveLocalFallback(db: DB): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage unavailable or quota exceeded.
  }
}

export async function fetchAll(): Promise<DB> {
  const items = await http<Item[]>("/api/items");

  let claims: Claim[] = [];

  if (getAuthToken()) {
    try {
      claims = await http<Claim[]>("/api/claims");
    } catch (error) {
      console.error("Failed to load claims:", error);
    }
  }

  const result: DB = { items, claims };

  saveLocalFallback(result);

  return result;
}

// -----------------------------------------------------------------------------
// Item CRUD
// -----------------------------------------------------------------------------

export async function createItem(input: NewItem): Promise<Item> {
  // input.imageUrl is already a short "/uploads/..." path (or undefined),
  // because report.tsx uploads the file before calling this.
  return http<Item>("/api/items", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateItemStatus(
  id: string,
  status: ItemStatus
): Promise<void> {
  await http(`/api/items/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deleteItem(id: string): Promise<void> {
  await http(`/api/items/${id}`, {
    method: "DELETE",
  });
}

// -----------------------------------------------------------------------------
// Claims CRUD
// -----------------------------------------------------------------------------

export async function createClaim(
  itemId: string,
  message: string
): Promise<Claim> {
  return http<Claim>(`/api/items/${itemId}/claims`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export async function updateClaimStatus(
  id: string,
  status: ClaimStatus
): Promise<void> {
  await http(`/api/claims/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// -----------------------------------------------------------------------------
// Local demo data reset
// -----------------------------------------------------------------------------

export async function resetData(): Promise<void> {
  saveLocalFallback({
    items: SAMPLE_ITEMS,
    claims: SAMPLE_CLAIMS,
  });
}