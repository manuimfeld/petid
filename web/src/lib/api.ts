export const API_URL = import.meta.env.PUBLIC_API_URL || "http://127.0.0.1:4000";

export interface PublicPet {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  address: string;
  googlePlaceId: string | null;
  latitude: string | null;
  longitude: string | null;
  whatsapp: string;
  status: "active" | "lost" | "disabled";
  lostAt: string | null;
  recoveredAt: string | null;
}

export interface OwnedPet extends PublicPet {
  ownerId: string;
  imageKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PublicQrResponse =
  | { state: "available"; id: string }
  | { state: "disabled" }
  | { state: "activated"; pet: PublicPet };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T | null }> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
    });
    const data = (await response.json().catch(() => null)) as T | null;
    return { status: response.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

export function forwardedCookies(request: Request): HeadersInit {
  const cookie = request.headers.get("cookie");
  return cookie ? { cookie } : {};
}
