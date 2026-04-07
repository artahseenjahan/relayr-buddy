

## Build Real Gmail Backend: Inbox + Persona Calibration

### Problem
There are two disconnected systems right now:
1. **Login** uses Lovable Cloud Google OAuth (redirect-based, Supabase session) — works correctly
2. **Gmail access** uses a separate GIS popup flow (`googleAuth.ts`) — blocked in preview, doesn't share tokens with login, and stores tokens client-side

The Inbox page shows only mock data from `mockDb.ts`. The persona calibration panel requires `googleSession` from the popup flow, which is null after a normal Google login.

### Solution: Server-Side Token Storage + Unified Flow

Replace the dual-auth system with a single flow where Gmail tokens are obtained via authorization code exchange and stored securely server-side.

```text
User Flow:
Login (Google) → Connect Gmail (consent for gmail scopes) → Tokens stored in DB
                                                              ↓
                              Edge Function uses stored tokens for all Gmail ops
                                                              ↓
                              Inbox fetches real emails  /  Persona reads sent mail
```

### Steps

**1. Database: Add `google_tokens` table**
- Columns: `user_id`, `access_token` (encrypted), `refresh_token` (encrypted), `expires_at`, `scopes`, `email`
- RLS: users can only read/update their own row
- The edge function uses service role to read/write tokens

**2. Update Gmail Proxy Edge Function**
- New action: `exchange_and_store` — exchanges authorization code, stores tokens in `google_tokens` table
- New action: `check_connection` — returns whether user has valid Gmail tokens
- All existing actions (`fetch_sent`, `fetch_inbox`, `send_reply`, etc.) now read the access token from the database instead of requiring it from the client
- Auto-refresh expired tokens using stored refresh token

**3. Create Connect Gmail Page (redirect-based, not popup)**
- Replace the GIS popup flow with a standard OAuth redirect flow
- User clicks "Connect Gmail" → redirected to Google consent screen with `gmail.readonly gmail.send` scopes → redirected back with authorization code → code sent to edge function → tokens stored
- This works in both preview and published environments (no popup blocking)
- Route: `/connect-gmail` (replaces current `/connect-email`)

**4. Update Inbox to Show Real Emails**
- Fetch real Gmail inbox messages via the edge function (no client-side token needed)
- Convert Gmail messages to the existing `Ticket` format
- Show a "Connect Gmail" prompt if no tokens are stored
- Keep mock data as fallback for demo mode

**5. Update Persona Calibration**
- Remove dependency on `googleSession` from AppContext
- Call the edge function directly (it reads tokens from DB)
- The "Load My 30 Sent Emails" button works without any popup

**6. Clean Up**
- Remove `googleAuth.ts` GIS popup flow (no longer needed)
- Remove `googleSession` from AppContext
- Update Settings page to show Gmail connection status from DB
- Keep Lovable Cloud Google OAuth for login (unchanged)

### What Changes

| Area | Current | After |
|------|---------|-------|
| Gmail tokens | Client-side sessionStorage | Server-side database |
| Gmail consent | Popup (blocked in iframe) | Redirect (works everywhere) |
| Inbox | Mock data only | Real Gmail inbox |
| Persona emails | Requires separate popup auth | Uses stored server tokens |
| Token refresh | Not possible (no refresh token) | Automatic via edge function |

### Files Modified/Created
- **New migration**: `google_tokens` table
- **Modified**: `supabase/functions/gmail-proxy/index.ts` — token storage + auto-refresh
- **New**: `/connect-gmail` page with redirect OAuth flow
- **Modified**: `src/pages/Inbox.tsx` — fetch real emails
- **Modified**: `src/pages/SetupPersona.tsx` — remove googleSession dependency
- **Modified**: `src/context/AppContext.tsx` — remove googleSession
- **Removed**: `src/lib/googleAuth.ts` (GIS popup flow)
- **Modified**: `src/pages/Settings.tsx` — Gmail connection status from DB

