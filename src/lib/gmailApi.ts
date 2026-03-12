/**
 * Gmail REST API — thin wrapper using fetch.
 * PRIVACY CONTRACT:
 *  - Only snippet + metadata (subject, from, date) are fetched. Full body is never requested.
 *  - No email content is persisted anywhere — results are held in component state only.
 *  - Read-only scope (gmail.readonly).
 */

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface GmailMessageMeta {
  id: string;
  subject: string;
  snippet: string;       // ~100-char preview extracted by Gmail — not the full body
  date: string;
  to?: string;
}

/** Fetch list of sent message IDs (no content yet). */
async function listSentMessageIds(token: string, maxResults = 50, query = ''): Promise<string[]> {
  const q = encodeURIComponent(`in:sent ${query}`.trim());
  const res = await fetch(`${BASE}/messages?labelIds=SENT&maxResults=${maxResults}&q=${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail list error: ${res.status}`);
  const data = await res.json();
  return (data.messages || []).map((m: { id: string }) => m.id);
}

/** Fetch snippet + metadata for a single message. Full body is intentionally excluded. */
async function fetchMessageMeta(token: string, messageId: string): Promise<GmailMessageMeta> {
  const res = await fetch(
    `${BASE}/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Gmail message fetch error: ${res.status}`);
  const data = await res.json();

  const headers: { name: string; value: string }[] = data.payload?.headers || [];
  const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  return {
    id: messageId,
    subject: getHeader('Subject') || '(no subject)',
    snippet: data.snippet || '',
    date: getHeader('Date') || '',
    to: getHeader('To'),
  };
}

/**
 * Fetch recent sent emails — subject + snippet only.
 * Returns at most `maxResults` items after fetching individual snippets.
 */
export async function fetchSentEmails(token: string, maxResults = 50): Promise<GmailMessageMeta[]> {
  const ids = await listSentMessageIds(token, maxResults);
  // Fetch up to 30 in parallel (limit concurrency to avoid rate limits)
  const batchSize = 5;
  const results: GmailMessageMeta[] = [];
  for (let i = 0; i < Math.min(ids.length, 30); i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const fetched = await Promise.all(batch.map(id => fetchMessageMeta(token, id).catch(() => null)));
    results.push(...(fetched.filter(Boolean) as GmailMessageMeta[]));
  }
  return results;
}

/**
 * Search the user's sent mail for messages matching keywords from the current ticket.
 * Returns snippets to use as personalization context in draft generation.
 */
export async function searchGmailSent(token: string, keywords: string[]): Promise<GmailMessageMeta[]> {
  const query = keywords.slice(0, 5).join(' OR ');
  const ids = await listSentMessageIds(token, 8, query);
  const results = await Promise.all(ids.slice(0, 5).map(id => fetchMessageMeta(token, id).catch(() => null)));
  return results.filter(Boolean) as GmailMessageMeta[];
}

/**
 * Extract the most meaningful keywords from a ticket subject + latest message snippet.
 * Used to drive the Gmail sent-mail search.
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
