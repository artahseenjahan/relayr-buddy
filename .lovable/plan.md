
## Feature: Calendar Availability & Appointment Scheduling

### What the user wants
A new settings page (after Rulebook in the sidebar) where staff can:
1. Connect their **Google Calendar** or **Microsoft Outlook Calendar** via OAuth
2. See their availability at a glance
3. When composing a reply in a ticket, an AI suggestion surfaces available meeting slots from the connected calendar and inserts them into the draft email

---

### Scope & Architecture Decisions

**Calendar OAuth:**
- Google Calendar: reuse the existing GIS implicit flow in `googleAuth.ts` — add `calendar.readonly` scope (read-only, same privacy model)
- Microsoft: would require MSAL + Azure App Registration (out of scope for now — show a "Coming soon" placeholder for Outlook)
- No calendar events are persisted to storage — read-only at time of use, same model as Gmail

**Availability detection:**
- Call Google Calendar's FreeBusy API (`/calendar/v3/freeBusy`) with the access token to find free slots over the next 7 days, business hours only (9am–5pm, Mon–Fri)
- No need to read event titles/details — just busy/free blocks, preserving privacy

**Suggested slots in ticket drafts:**
- In `TicketDetail.tsx`, add a "Suggest Slots" button in the Draft tab
- Calls the FreeBusy API, computes 3–5 free 30-min slots, and inserts a formatted block into the draft body

---

### Files to create / modify

| File | Action |
|------|--------|
| `src/lib/calendarApi.ts` | New — Google Calendar FreeBusy API wrapper, find free slots |
| `src/pages/SettingsCalendar.tsx` | New — full page: connect Google Calendar, availability preview, Outlook placeholder |
| `src/App.tsx` | Add route `/settings/calendar` |
| `src/components/AppLayout.tsx` | Add "Calendar" nav link (after Rulebook), update header title |
| `src/pages/TicketDetail.tsx` | Add "Suggest Slots" button in the Draft tab, insert slots into draft |
| `src/types/index.ts` | Add `CalendarConnection` type |
| `src/context/AppContext.tsx` | Add `calendarConnected` state flag + `connectCalendar` / `disconnectCalendar` methods |

---

### New `src/lib/calendarApi.ts`

```ts
// Uses existing Google access token (extended with calendar.readonly scope)
// getFreeBusySlots(token, days=7): returns array of { start, end } free 30-min slots
// Uses POST /calendar/v3/freeBusy — never reads event titles
// Filters: Mon-Fri, 9am-5pm local time only
// Returns max 10 slots
```

---

### New `src/pages/SettingsCalendar.tsx`

Layout (3 sections):
1. **Google Calendar** card — "Connect Google Calendar" button (reuses `signInWithGoogle` with extended scopes), shows connected state with user email + "Disconnect" button
2. **Availability Preview** — 7-day grid showing today through next 7 working days, each day shows free slots as green chips (fetched on demand)
3. **Microsoft Outlook** card — "Coming soon" badge, brief note

**Scopes note:** The existing `signInWithGoogle` will need to include `https://www.googleapis.com/auth/calendar.readonly` added to the SCOPES list in `googleAuth.ts`. Since it's an implicit flow, the user re-consents once when clicking "Connect Calendar."

---

### TicketDetail changes

In the **Draft** tab, after the existing "Generate" / "Regenerate" buttons, add a small "Insert Available Slots" button (calendar icon). Clicking it:
1. Checks if `calendarConnected` in context
2. If not, shows a small inline prompt linking to `/settings/calendar`
3. If yes, calls `getFreeBusySlots`, formats 3–5 slots, and appends a block to the draft body:
   ```
   I'm available at the following times (EST):
   • Tuesday, Mar 18 at 10:00 AM
   • Tuesday, Mar 18 at 2:00 PM
   • Wednesday, Mar 19 at 11:00 AM
   Please reply with your preferred time and I'll send a calendar invite.
   ```

---

### Sidebar nav order (after change)

```
Dashboard
Inbox
Settings
Rulebook          ← existing
Routing Rules     ← existing
Calendar          ← new (Calendar icon from lucide)
```

---

### Summary of scope

- Read-only Google Calendar access (FreeBusy only — no event titles read)
- Microsoft Outlook shown as "Coming soon"
- Availability preview on the settings page
- One-click slot insertion into ticket draft email body
- No new backend / Supabase needed — all client-side using existing OAuth token model
