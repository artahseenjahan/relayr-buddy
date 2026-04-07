import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

function getGoogleCreds() {
  return {
    clientId: Deno.env.get("VITE_GOOGLE_CLIENT_ID")!,
    clientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
  };
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Exchange authorization code for tokens and store in DB */
async function exchangeAndStore(code: string, redirectUri: string, userId: string) {
  const { clientId, clientSecret } = getGoogleCreds();
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
  const tokens = await res.json();

  // Fetch user email from Google
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = profileRes.ok ? await profileRes.json() : {};

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("google_tokens").upsert({
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    scopes: tokens.scope || "",
    email: profile.email || null,
  }, { onConflict: "user_id" });

  if (error) throw new Error(`Failed to store tokens: ${error.message}`);
  return { email: profile.email, connected: true };
}

/** Get a valid access token for a user, refreshing if needed */
async function getValidToken(userId: string): Promise<{ token: string; email: string }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("google_tokens")
    .select("access_token, refresh_token, expires_at, email")
    .eq("user_id", userId)
    .single();

  if (error || !data) throw new Error("Gmail not connected. Please connect your Gmail account first.");

  const expiresAt = new Date(data.expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) {
    return { token: data.access_token, email: data.email || "" };
  }

  // Token expired — refresh
  if (!data.refresh_token) throw new Error("Gmail session expired. Please reconnect your Gmail account.");

  const { clientId, clientSecret } = getGoogleCreds();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: data.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Token refresh failed. Please reconnect your Gmail account.");
  const refreshed = await res.json();

  await supabase.from("google_tokens").update({
    access_token: refreshed.access_token,
    expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
  }).eq("user_id", userId);

  return { token: refreshed.access_token, email: data.email || "" };
}

/** Check if user has Gmail connected */
async function checkConnection(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("google_tokens")
    .select("email, expires_at, scopes")
    .eq("user_id", userId)
    .single();
  if (!data) return { connected: false };
  return { connected: true, email: data.email, scopes: data.scopes };
}

/** Disconnect Gmail */
async function disconnectGmail(userId: string) {
  const supabase = getSupabaseAdmin();
  // Try to revoke token at Google first
  try {
    const { data } = await supabase.from("google_tokens").select("access_token").eq("user_id", userId).single();
    if (data?.access_token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${data.access_token}`, { method: "POST" });
    }
  } catch { /* ignore */ }
  await supabase.from("google_tokens").delete().eq("user_id", userId);
  return { disconnected: true };
}

// ─── Gmail API helpers ───

async function listMessageIds(token: string, maxResults: number, query: string, labelId?: string): Promise<string[]> {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (query) params.set("q", query);
  if (labelId) params.set("labelIds", labelId);
  const res = await fetch(`${GMAIL_BASE}/messages?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail list error: ${res.status}`);
  const data = await res.json();
  return (data.messages || []).map((m: { id: string }) => m.id);
}

async function fetchMessageMeta(token: string, messageId: string) {
  const res = await fetch(
    `${GMAIL_BASE}/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=From&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Gmail message fetch error: ${res.status}`);
  const data = await res.json();
  const headers: { name: string; value: string }[] = data.payload?.headers || [];
  const getH = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  return {
    id: messageId,
    threadId: data.threadId || "",
    subject: getH("Subject") || "(no subject)",
    snippet: data.snippet || "",
    date: getH("Date") || "",
    from: getH("From"),
    to: getH("To"),
  };
}

async function fetchMessages(token: string, maxResults: number, query: string, labelId?: string) {
  const ids = await listMessageIds(token, maxResults, query, labelId);
  const batchSize = 5;
  const results: any[] = [];
  for (let i = 0; i < Math.min(ids.length, maxResults); i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const fetched = await Promise.all(batch.map((id) => fetchMessageMeta(token, id).catch(() => null)));
    results.push(...fetched.filter(Boolean));
  }
  return results;
}

async function sendReply(token: string, to: string, subject: string, body: string, threadId?: string) {
  const rawSubject = subject.startsWith("Re: ") ? subject : `Re: ${subject}`;
  const message = [`To: ${to}`, `Subject: ${rawSubject}`, `Content-Type: text/plain; charset=utf-8`, "", body].join("\r\n");
  const encodedMessage = btoa(unescape(encodeURIComponent(message))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payload: any = { raw: encodedMessage };
  if (threadId) payload.threadId = threadId;
  const res = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send error: ${res.status} ${err}`);
  }
  return await res.json();
}

// ─── Main handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseAdmin();
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, ...params } = body;
    let result: any;

    switch (action) {
      case "exchange_and_store":
        result = await exchangeAndStore(params.code, params.redirectUri, user.id);
        break;

      case "check_connection":
        result = await checkConnection(user.id);
        break;

      case "disconnect":
        result = await disconnectGmail(user.id);
        break;

      case "fetch_sent": {
        const { token } = await getValidToken(user.id);
        result = await fetchMessages(token, params.maxResults || 50, "in:sent", "SENT");
        break;
      }

      case "search_sent": {
        const { token } = await getValidToken(user.id);
        const query = (params.keywords || []).slice(0, 5).join(" OR ");
        result = await fetchMessages(token, 8, `in:sent ${query}`, "SENT");
        break;
      }

      case "fetch_inbox": {
        const { token } = await getValidToken(user.id);
        result = await fetchMessages(token, params.maxResults || 20, "", "INBOX");
        break;
      }

      case "send_reply": {
        const { token } = await getValidToken(user.id);
        result = await sendReply(token, params.to, params.subject, params.body, params.threadId);
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
