import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Exchange authorization code for tokens server-side */
async function exchangeCode(code: string, redirectUri: string) {
  const clientId = Deno.env.get("VITE_GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return await res.json();
}

/** Refresh an expired access token */
async function refreshAccessToken(refreshToken: string) {
  const clientId = Deno.env.get("VITE_GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  return await res.json();
}

/** List sent message IDs */
async function listSentIds(token: string, maxResults: number, query: string): Promise<string[]> {
  const q = encodeURIComponent(`in:sent ${query}`.trim());
  const res = await fetch(`${GMAIL_BASE}/messages?labelIds=SENT&maxResults=${maxResults}&q=${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail list error: ${res.status}`);
  const data = await res.json();
  return (data.messages || []).map((m: { id: string }) => m.id);
}

/** Fetch snippet + metadata for a single message */
async function fetchMessageMeta(token: string, messageId: string) {
  const res = await fetch(
    `${GMAIL_BASE}/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Gmail message fetch error: ${res.status}`);
  const data = await res.json();
  const headers: { name: string; value: string }[] = data.payload?.headers || [];
  const getH = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  return {
    id: messageId,
    subject: getH("Subject") || "(no subject)",
    snippet: data.snippet || "",
    date: getH("Date") || "",
    to: getH("To"),
  };
}

/** Fetch recent sent emails */
async function fetchSentEmails(token: string, maxResults = 50) {
  const ids = await listSentIds(token, maxResults, "");
  const batchSize = 5;
  const results: any[] = [];
  for (let i = 0; i < Math.min(ids.length, 30); i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const fetched = await Promise.all(batch.map((id) => fetchMessageMeta(token, id).catch(() => null)));
    results.push(...fetched.filter(Boolean));
  }
  return results;
}

/** Search sent mail by keywords */
async function searchSentMail(token: string, keywords: string[]) {
  const query = keywords.slice(0, 5).join(" OR ");
  const ids = await listSentIds(token, 8, query);
  const results = await Promise.all(ids.slice(0, 5).map((id) => fetchMessageMeta(token, id).catch(() => null)));
  return results.filter(Boolean);
}

/** Send a reply via Gmail */
async function sendReply(token: string, to: string, subject: string, body: string, threadId?: string) {
  const rawSubject = subject.startsWith("Re: ") ? subject : `Re: ${subject}`;
  const message = [
    `To: ${to}`,
    `Subject: ${rawSubject}`,
    `Content-Type: text/plain; charset=utf-8`,
    "",
    body,
  ].join("\r\n");

  const encodedMessage = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const payload: any = { raw: encodedMessage };
  if (threadId) payload.threadId = threadId;

  const res = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send error: ${res.status} ${err}`);
  }
  return await res.json();
}

/** Fetch inbox messages */
async function fetchInbox(token: string, maxResults = 20) {
  const res = await fetch(`${GMAIL_BASE}/messages?labelIds=INBOX&maxResults=${maxResults}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail inbox error: ${res.status}`);
  const data = await res.json();
  const ids = (data.messages || []).map((m: { id: string }) => m.id);
  
  const batchSize = 5;
  const results: any[] = [];
  for (let i = 0; i < Math.min(ids.length, 20); i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const fetched = await Promise.all(batch.map((id: string) => fetchMessageMeta(token, id).catch(() => null)));
    results.push(...fetched.filter(Boolean));
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify JWT from Supabase Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user's JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, googleAccessToken, ...params } = body;

    if (!googleAccessToken) {
      return new Response(JSON.stringify({ error: "Missing Google access token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;

    switch (action) {
      case "exchange_code":
        result = await exchangeCode(params.code, params.redirectUri);
        break;
      case "refresh_token":
        result = await refreshAccessToken(params.refreshToken);
        break;
      case "fetch_sent":
        result = await fetchSentEmails(googleAccessToken, params.maxResults || 50);
        break;
      case "search_sent":
        result = await searchSentMail(googleAccessToken, params.keywords || []);
        break;
      case "send_reply":
        result = await sendReply(googleAccessToken, params.to, params.subject, params.body, params.threadId);
        break;
      case "fetch_inbox":
        result = await fetchInbox(googleAccessToken, params.maxResults || 20);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
