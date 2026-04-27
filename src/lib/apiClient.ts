import { supabase } from "@/integrations/supabase/client";

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

function apiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!raw || raw === "proxy") {
    return "";
  }
  return raw.replace(/\/$/, "");
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { ...(await authHeaders()), ...(init?.headers as Record<string, string> | undefined) };
  const response = await fetch(`${apiBase()}${path}`, { ...init, headers });
  if (!response.ok) {
    const text = await response.text();
    try {
      const body = JSON.parse(text) as { detail?: unknown };
      if (body.detail != null) {
        throw new Error(typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail));
      }
    } catch {
      throw new Error(text || `Request failed (${response.status})`);
    }
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}
