

## From Demo to Real Product: Google OAuth + Email + Persona

### Current State
- `VITE_GOOGLE_CLIENT_ID` is already configured and working
- Google OAuth flow exists (`googleAuth.ts`) with `gmail.readonly` scope
- Gmail API wrapper exists (`gmailApi.ts`) — fetches sent email snippets only
- Persona extraction from 30 emails already works (`personaExtractor.ts`)
- All data is in-memory mock data — nothing persists between sessions
- Users cannot actually send/reply to emails (read-only scope)
- No real backend — everything runs client-side in the browser

### What Needs to Change

#### 1. Enable Lovable Cloud Backend
Set up Supabase via Lovable Cloud to store users, personas, drafts, and decisions persistently. This gives us a real database, authentication, and Edge Functions without needing an external account.

**Database tables needed:**
- `profiles` — user identity (linked to Supabase Auth)
- `personas` — saved persona configurations per user
- `offices` / `schools` / `rulebooks` — org structure
- `tickets` — email threads pulled from Gmail
- `drafts` / `decisions` — AI-generated drafts and approval logs

#### 2. Replace Mock Login with Real Google Sign-In
- Remove the hardcoded email/password form on `/login`
- Add a "Sign in with Google" button that uses the existing `signInWithGoogle()` flow
- On success, create a Supabase Auth session (using Google as OAuth provider through Supabase, not the current client-side-only token)
- Keep a "Try Demo Mode" fallback for users without Google accounts

#### 3. Upgrade Gmail Scopes for Sending
- Add `gmail.send` scope alongside `gmail.readonly` so users can reply to emails
- Add `fetchInboxEmails()` function to pull real incoming messages (not just sent)
- Add `sendGmailReply()` function to send replies via Gmail API
- The human-in-the-loop approval flow stays — AI drafts, human approves, then send

#### 4. Persona Extraction from 30 Emails (Already Works)
The existing flow in `SetupPersona.tsx` already:
- Loads sent emails via Gmail API
- Lets user select up to 30 emails
- Extracts tone/style using `personaExtractor.ts`

What changes: the extracted persona gets **saved to Supabase** instead of only living in component state. This means it persists across sessions and is used by the draft generator every time.

#### 5. Security Fixes
- Move Google tokens to server-side (Edge Function handles token exchange, not the browser)
- Use Supabase Auth instead of sessionStorage for user sessions
- Add Row-Level Security (RLS) so users can only access their own data
- Remove the obfuscate/deobfuscate pattern (false sense of security)
- Validate all inputs server-side before Gmail API calls

### Implementation Order

**Step 1:** Enable Lovable Cloud — this creates the Supabase project automatically

**Step 2:** Create database schema (profiles, personas, tickets, drafts, decisions) with RLS policies

**Step 3:** Replace Login page — Google Sign-In via Supabase Auth (Google provider), keep demo fallback

**Step 4:** Create Edge Function for Gmail proxy — handles token refresh, inbox fetch, and email sending server-side (tokens never exposed to browser)

**Step 5:** Update Inbox to load real emails from Gmail (via Edge Function) and save as tickets in Supabase

**Step 6:** Update persona flow — save extracted persona to database, load it for draft generation

**Step 7:** Add reply capability — "Approve & Send" button actually sends via Gmail through the Edge Function

### What You Need to Do (One-Time Setup)

The `VITE_GOOGLE_CLIENT_ID` is already set. To enable sending emails, you will need to:
1. Go to Google Cloud Console → APIs & Services → OAuth consent screen
2. Add the `gmail.send` scope to your OAuth consent screen
3. If your app is in "Testing" mode, add test user emails
4. For production: submit for Google verification (required for sensitive scopes)

Everything else is handled by the code changes.

### Technical Summary

| Area | Current | After |
|------|---------|-------|
| Auth | Mock email/password | Google OAuth via Supabase Auth |
| Storage | In-memory, lost on refresh | Supabase PostgreSQL with RLS |
| Gmail Read | Client-side, readonly | Server-side Edge Function |
| Gmail Send | Not possible | Edge Function with gmail.send scope |
| Persona | Component state only | Persisted in database |
| Tokens | sessionStorage (browser) | Server-side, never exposed |
| Security | None (demo) | RLS, server-side validation, JWT |

