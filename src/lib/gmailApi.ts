/**
 * Gmail API client — calls server-side Edge Function instead of Gmail directly.
 * All Gmail operations are proxied through the backend for token security.
 */

import { supabase } from "@/integrations/supabase/client";

export interface GmailMessageMeta {
  id: string;
  subject: string;
  snippet: string;
  date: string;
  to?: string;
}

async function callGmailProxy(action: string, googleAccessToken: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("gmail-proxy", {
    body: { action, googleAccessToken, ...params },
  });
  if (error) throw new Error(error.message || "Gmail proxy error");
  return data;
}

/** Fetch recent sent emails via server-side proxy */
export async function fetchSentEmails(googleAccessToken: string, maxResults = 50): Promise<GmailMessageMeta[]> {
  return callGmailProxy("fetch_sent", googleAccessToken, { maxResults });
}

/** Search sent mail by keywords via server-side proxy */
export async function searchGmailSent(googleAccessToken: string, keywords: string[]): Promise<GmailMessageMeta[]> {
  return callGmailProxy("search_sent", googleAccessToken, { keywords });
}

/** Send a reply via server-side proxy */
export async function sendGmailReply(
  googleAccessToken: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string
): Promise<any> {
  return callGmailProxy("send_reply", googleAccessToken, { to, subject, body, threadId });
}

/** Fetch inbox messages via server-side proxy */
export async function fetchInboxEmails(googleAccessToken: string, maxResults = 20): Promise<GmailMessageMeta[]> {
  return callGmailProxy("fetch_inbox", googleAccessToken, { maxResults });
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
