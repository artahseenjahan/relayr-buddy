/**
 * Gmail API client — all operations go through the server-side Edge Function.
 * No client-side Google tokens needed — the edge function reads tokens from the database.
 */

import { supabase } from "@/integrations/supabase/client";

export interface GmailMessageMeta {
  id: string;
  threadId?: string;
  subject: string;
  snippet: string;
  date: string;
  from?: string;
  to?: string;
}

async function callGmailProxy(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("gmail-proxy", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message || "Gmail proxy error");
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Exchange OAuth code and store tokens server-side */
export async function exchangeAndStoreTokens(code: string, redirectUri: string) {
  return callGmailProxy("exchange_and_store", { code, redirectUri });
}

/** Check if current user has Gmail connected */
export async function checkGmailConnection(): Promise<{ connected: boolean; email?: string }> {
  return callGmailProxy("check_connection");
}

/** Disconnect Gmail */
export async function disconnectGmail() {
  return callGmailProxy("disconnect");
}

/** Fetch recent sent emails via server-side proxy */
export async function fetchSentEmails(maxResults = 50): Promise<GmailMessageMeta[]> {
  return callGmailProxy("fetch_sent", { maxResults });
}

/** Search sent mail by keywords via server-side proxy */
export async function searchGmailSent(keywords: string[]): Promise<GmailMessageMeta[]> {
  return callGmailProxy("search_sent", { keywords });
}

/** Send a reply via server-side proxy */
export async function sendGmailReply(
  to: string,
  subject: string,
  body: string,
  threadId?: string
): Promise<any> {
  return callGmailProxy("send_reply", { to, subject, body, threadId });
}

/** Fetch inbox messages via server-side proxy */
export async function fetchInboxEmails(maxResults = 20): Promise<GmailMessageMeta[]> {
  return callGmailProxy("fetch_inbox", { maxResults });
}

/**
 * Extract the most meaningful keywords from a ticket subject + latest message snippet.
 */
export function extractTicketKeywords(subject: string, body?: string): string[] {
  const STOP_WORDS = new Set([
    'the','and','for','that','this','with','from','your','have','are','not','can',
    'was','will','would','could','should','been','also','but','its','our','they',
    'their','about','what','how','when','please','dear','thank','regards','hello',
    'good','hope','you','me','my','am','an','as','at','be','by','do','if','in',
    'is','it','no','of','on','or','so','to','up','us','we',
  ]);
  const text = `${subject} ${body || ''}`.toLowerCase();
  const words = text.match(/\b[a-z]{4,}\b/g) || [];
  const freq: Record<string, number> = {};
  words.forEach(w => { if (!STOP_WORDS.has(w)) freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}
