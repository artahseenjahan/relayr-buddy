
## What the user wants

Three interconnected backend-connected features, all using real Google OAuth (Gmail API):

1. **Google OAuth login** — replace the mock email+password login with real Google Sign-In via OAuth. Store only the OAuth access token (encrypted in sessionStorage, revocable from Google account). No full email bodies stored.

2. **Persona calibration from Gmail** — in the persona setup/settings, staff pick up to 25 of their own sent emails from Gmail. The system extracts tone/style signals (Layer 1 persona) from those emails. Only metadata + short snippets are processed, not full bodies.

3. **Contextual draft generation via Gmail search** — when generating a reply draft, extract keywords from the incoming ticket email, then search the user's Gmail (by label + keywords) for similar past emails they've sent. Use those matched examples to personalize the draft output (Layer 1 intelligence).

---

## Technical approach

### Authentication: Google OAuth (real)
- **No Supabase needed** — we use the Google Identity Services (GIS) implicit flow entirely client-side, which gives an `access_token` valid for 1 hour. This is sufficient for reading Gmail.
- Store only the `access_token` + `token_expiry` in sessionStorage (encrypted with a simple XOR+base64 obfuscation — production would use a backend). Never store refresh tokens client-side.
- New `src/lib/googleAuth.ts` — wraps GIS token flow, `signInWithGoogle()`, `getGoogleToken()`, `revokeGoogleToken()`.
- `ConnectEmail.tsx` — the "Connect Gmail" button triggers real OAuth popup. On success, store token + user info (name, email only). "Connect Outlook" stays mock.
- `AppContext.tsx` — add `googleToken`, `googleUser` state, `connectGoogle()`, `revokeGoogle()` methods.
- `types/index.ts` — add `GoogleOAuthSession` interface.
- Privacy note shown in UI: "Tokens are stored in-session only and can be revoked from your Google account at any time."

### Persona Calibration: Gmail Sent Email Picker
- New `src/lib/gmailApi.ts` — thin wrapper for Gmail REST API calls:
  - `fetchSentEmails(token, maxResults)` — hits `GET /gmail/v1/users/me/messages?labelIds=SENT&maxResults=50`
  - `fetchEmailSnippet(token, messageId)` — gets subject + snippet (not full body) from `GET /gmail/v1/users/me/messages/{id}?format=metadata,snippet`
- New `src/pages/SetupPersonaGmail.tsx` (or add a new step/tab in `SetupPersona.tsx`) — "Calibrate from Gmail" section:
  - Button "Load my recent sent emails" → calls `fetchSentEmails()`
  - Shows a list of up to 50 sent emails (subject + snippet only, ~1 line)
  - Staff check up to 25 to include
  - Button "Extract Persona" → calls `extractPersonaFromEmails(selectedEmails)` in a new `src/lib/personaExtractor.ts`
  - Extracted signals: dominant tone (formal/warm/concise), avg sentence length, common opening/closing phrases, salutation style
  - Shows extracted results as a preview with "Apply to Persona" button
  - Populates `toneDefault`, `approvedPhrases`, `safeLanguageTemplates` automatically

- `src/lib/personaExtractor.ts` — heuristic NLP (no external API):
  - Regex + word frequency analysis on snippets
  - Detects: formality signals (Dear/Hi/Hello ratio), closing phrases, avg word count
  - Returns `ExtractedPersonaProfile { toneDefault, approvedPhrases[], safeLanguageTemplates[], styleSummary }`

### Draft Generation: Gmail Keyword Search
- In `src/lib/gmailApi.ts`:
  - `searchGmailSent(token, query)` — `GET /gmail/v1/users/me/messages?q=in:sent+{keywords}&maxResults=5`
  - `fetchEmailSnippet(token, messageId)` — same as above, snippet only
- In `src/lib/draftGenerator.ts`:
  - `generateDraft()` accepts optional `gmailExamples?: string[]` (snippets from matched emails)
  - When provided, weave in phrases/opening patterns from matched examples
  - `sourcesUsed` in Draft now includes "Gmail: [subject snippet]" entries
- In `src/pages/TicketDetail.tsx`:
  - "Generate Draft" button: if `googleToken` is available in context, first calls `searchGmailSent()` with extracted keywords from the ticket
  - Shows a small "Personalizing from your Gmail history…" spinner step before draft appears
  - If no token → falls back to current mock generation (graceful degradation)

### Privacy & Token Management
- `Settings.tsx` — add a "Google Account" card showing:
  - Connected Google account name + email
  - "Revoke Access" button → calls `revokeGoogleToken()` + clears sessionStorage
  - Note: "Token valid for 1 hour · No email content is stored · Revoke at: myaccount.google.com/permissions"
- Never log or persist full email bodies anywhere

---

## Files to create/modify

**New files:**
- `src/lib/googleAuth.ts` — GIS OAuth wrapper
- `src/lib/gmailApi.ts` — Gmail REST API calls (snippets only)
- `src/lib/personaExtractor.ts` — heuristic tone extractor from email snippets

**Modified files:**
- `src/types/index.ts` — add `GoogleOAuthSession`
- `src/context/AppContext.tsx` — add Google token state + methods
- `src/pages/ConnectEmail.tsx` — real Google OAuth button
- `src/pages/SetupPersona.tsx` — add "Calibrate from Gmail" section
- `src/pages/TicketDetail.tsx` — Gmail-powered draft generation with keyword search
- `src/lib/draftGenerator.ts` — accept `gmailExamples` param
- `src/pages/Settings.tsx` — Google account + revoke card

---

## Google OAuth scope required
`https://www.googleapis.com/auth/gmail.readonly` — read-only, no send/write access.

The OAuth Client ID will need to be added. Since it's a publishable client ID (safe to embed in frontend), it goes directly in the codebase as `VITE_GOOGLE_CLIENT_ID`.

The user will need to create a Google Cloud OAuth 2.0 Client ID with:
- Authorized JavaScript origins: their Lovable preview URL + published URL
- Authorized redirect URIs: same origins (GIS implicit flow uses postMessage, not redirects)

---

## Graceful degradation
All Gmail features degrade gracefully: if no Google token is present, the app functions exactly as before (mock data, mock drafts). The Gmail features are additive enhancements, not hard dependencies.
