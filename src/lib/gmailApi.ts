/**
 * Gmail API — primary: Supabase Edge Function `gmail-proxy` (see supabase/functions/gmail-proxy).
 * Optional: set VITE_GMAIL_TRANSPORT=fastapi and VITE_API_BASE_URL to use the FastAPI backend (e.g. local dev without deploying the function).
 */

import { supabase } from "@/integrations/supabase/client";

export interface GmailMessageMeta {
  id: string;
  threadId?: string;
  thread_id?: string;
  subject: string;
  snippet: string;
  date: string;
  from?: string;
  to?: string;
}

function debugLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  // #region agent log
  fetch("http://127.0.0.1:7329/ingest/2a726d77-02f4-4ef1-8b80-4290a5d06d6d", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "dfaa24" },
    body: JSON.stringify({
      sessionId: "dfaa24",
      runId: "pre-fix-client",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

function isFastApiTransport(): boolean {
  const t = import.meta.env.VITE_GMAIL_TRANSPORT;
  return t === "fastapi" || t === "api" || t === "1" || t === "true";
}

async function invokeEdge<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("gmail-proxy", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "Failed to reach Gmail Edge Function (deploy: supabase functions deploy gmail-proxy)");
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: string }).error;
    if (err) throw new Error(err);
  }
  return data as T;
}

function apiBase(): string {
  if (!isFastApiTransport()) return "";
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  // Empty / missing: same-origin requests to /api/* — Vite dev server proxies to FastAPI (see vite.config.ts).
  // Set VITE_API_BASE_URL only for production builds or when not using the proxy.
  if (!raw || raw === "proxy") {
    if (import.meta.env.PROD) {
      throw new Error(
        "Set VITE_API_BASE_URL to your API origin for production builds (Vite dev proxy only applies in development).",
      );
    }
    return "";
  }
  return raw.replace(/\/$/, "");
}

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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { ...(await authHeaders()), ...(init?.headers as Record<string, string>) };
  let res: Response;
  debugLog("H13", "src/lib/gmailApi.ts:apiFetch:entry", "apiFetch start", {
    path,
    hasAuth: Boolean(headers.Authorization),
    method: init?.method ?? "GET",
  });
  try {
    res = await fetch(`${apiBase()}${path}`, { ...init, headers });
  } catch (e) {
    debugLog("H14", "src/lib/gmailApi.ts:apiFetch:network_exception", "apiFetch network error", {
      path,
      errorType: e instanceof Error ? e.name : typeof e,
      error: e instanceof Error ? e.message : String(e),
    });
    const base = apiBase();
    const hint =
      "Start the API: cd backend && uvicorn app.main:app --reload --port 8000. " +
      "With the Vite proxy, leave VITE_API_BASE_URL empty so requests go to /api on this dev server.";
    if (e instanceof TypeError) {
      throw new Error(
        `Network error${base ? ` calling ${base}` : " (same-origin /api)"}: ${e.message}. ${hint}`,
      );
    }
    throw e;
  }
  debugLog("H15", "src/lib/gmailApi.ts:apiFetch:response", "apiFetch response received", {
    path,
    status: res.status,
    ok: res.ok,
  });
  if (!res.ok) {
    const text = await res.text();
    let detail = text || res.statusText;
    try {
      const body = JSON.parse(text) as { detail?: unknown };
      if (body?.detail != null) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      /* keep text */
    }
    debugLog("H16", "src/lib/gmailApi.ts:apiFetch:error_payload", "apiFetch non-ok response payload", {
      path,
      status: res.status,
      detail,
    });
    throw new Error(detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Exchange OAuth code and store tokens server-side */
export async function exchangeAndStoreTokens(code: string, redirectUri: string) {
  if (isFastApiTransport()) {
    return apiFetch<{ email?: string; connected?: boolean }>("/api/email/connect", {
      method: "POST",
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });
  }
  return invokeEdge<{ email?: string; connected?: boolean }>("exchange_and_store", { code, redirectUri });
}

/** Check if current user has Gmail connected */
export async function checkGmailConnection(): Promise<{ connected: boolean; email?: string }> {
  if (isFastApiTransport()) {
    try {
      return await apiFetch("/api/email/status");
    } catch (e) {
      debugLog(
        "H21",
        "src/lib/gmailApi.ts:checkGmailConnection:fallback",
        "status endpoint failed, returning disconnected fallback",
        { error: e instanceof Error ? e.message : String(e) },
      );
      return { connected: false };
    }
  }
  return invokeEdge("check_connection");
}

/** Disconnect Gmail */
export async function disconnectGmail() {
  if (isFastApiTransport()) {
    return apiFetch<{ disconnected: boolean }>("/api/email/disconnect", { method: "DELETE" });
  }
  return invokeEdge<{ disconnected: boolean }>("disconnect");
}

/** Fetch recent sent emails */
export async function fetchSentEmails(maxResults = 50): Promise<GmailMessageMeta[]> {
  if (isFastApiTransport()) {
    const q = new URLSearchParams({ max_results: String(maxResults) });
    return apiFetch(`/api/email/sent?${q}`);
  }
  return invokeEdge("fetch_sent", { maxResults });
}

/** Search sent mail by keywords */
export async function searchGmailSent(keywords: string[]): Promise<GmailMessageMeta[]> {
  if (isFastApiTransport()) {
    const q = new URLSearchParams({ max_results: "8", keywords: keywords.slice(0, 5).join(",") });
    return apiFetch(`/api/email/sent?${q}`);
  }
  return invokeEdge("search_sent", { keywords });
}

/** Send a reply */
export async function sendGmailReply(
  to: string,
  subject: string,
  body: string,
  threadId?: string
): Promise<Record<string, unknown>> {
  if (isFastApiTransport()) {
    return apiFetch("/api/email/send", {
      method: "POST",
      body: JSON.stringify({ to, subject, body, thread_id: threadId ?? null }),
    });
  }
  return invokeEdge("send_reply", { to, subject, body, threadId });
}

/** Fetch inbox messages */
export async function fetchInboxEmails(maxResults = 20): Promise<GmailMessageMeta[]> {
  if (isFastApiTransport()) {
    const q = new URLSearchParams({ max_results: String(maxResults) });
    return apiFetch(`/api/email/inbox?${q}`);
  }
  return invokeEdge("fetch_inbox", { maxResults });
}

export async function fetchMessageDetail(messageId: string): Promise<Record<string, unknown>> {
  if (isFastApiTransport()) {
    return apiFetch(`/api/email/messages/${messageId}`);
  }
  throw new Error("Message detail is only available with FastAPI transport.");
}

export async function fetchThreadDetail(threadId: string): Promise<Record<string, unknown>> {
  if (isFastApiTransport()) {
    return apiFetch(`/api/email/threads/${threadId}`);
  }
  throw new Error("Thread detail is only available with FastAPI transport.");
}

/**
 * Extract the most meaningful keywords from a ticket subject + latest message snippet.
 */
export function extractTicketKeywords(subject: string, body?: string): string[] {
  const STOP_WORDS = new Set([
    "the",
    "and",
    "for",
    "that",
    "this",
    "with",
    "from",
    "your",
    "have",
    "are",
    "not",
    "can",
    "was",
    "will",
    "would",
    "could",
    "should",
    "been",
    "also",
    "but",
    "its",
    "our",
    "they",
    "their",
    "about",
    "what",
    "how",
    "when",
    "please",
    "dear",
    "thank",
    "regards",
    "hello",
    "good",
    "hope",
    "you",
    "me",
    "my",
    "am",
    "an",
    "as",
    "at",
    "be",
    "by",
    "do",
    "if",
    "in",
    "is",
    "it",
    "no",
    "of",
    "on",
    "or",
    "so",
    "to",
    "up",
    "us",
    "we",
  ]);
  const text = `${subject} ${body || ""}`.toLowerCase();
  const words = text.match(/\b[a-z]{4,}\b/g) || [];
  const freq: Record<string, number> = {};
  words.forEach((w) => {
    if (!STOP_WORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}
