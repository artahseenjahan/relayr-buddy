
## Understanding the Request

The user is stuck on `/connect-email` because after login, the app forces a redirect there. They want:

1. **Remove the forced connect-email redirect** — login goes straight to `/inbox`. Gmail stays available optionally via Settings. (This is what "undo security measures" means — the OAuth requirement is blocking them.)

2. **Add remaining features** from prior conversation suggestions:
   - **Dashboard page** at `/dashboard` — ticket stats by status, office breakdown, pending drafts count, recent activity
   - **Routing Rules editor** in Settings — configure custom keyword → department routing rules that feed into Layer 3 intelligence

---

## Changes Needed

### Fix 1: Remove forced connect-email redirect (2 file changes)

**`src/App.tsx`** — Change login redirect from `/connect-email` to `/inbox` directly:
```
// Before (line 34):
<Navigate to={mailboxConnection?.status === 'connected' ? '/inbox' : '/connect-email'} replace />

// After:
<Navigate to="/inbox" replace />
```

**`src/context/AppContext.tsx`** — Same logic in login handler (line 26 in Login.tsx):
Login.tsx line 26 currently redirects to `/connect-email` if no mailboxConnection. Change it to always go to `/inbox`.

### Fix 2: Dashboard page (`/dashboard`)

New file: `src/pages/Dashboard.tsx`

Layout:
- Top row: 4 stat cards — Total Tickets, Needs Review, Approved/Sent, Risk Flagged
- Second row: Bar chart (recharts) — tickets by office
- Third row: Tickets by status breakdown (progress bars) + Recent decisions list (last 5)
- Uses existing `tickets`, `drafts`, `decisions` from `useApp()`
- Uses existing `recharts` (already installed)

### Fix 3: Routing Rules Editor in Settings

New file: `src/pages/SettingsRouting.tsx`

- List of routing rules: each rule = { id, keywords: string[], targetDepartment: string, reason: string }
- Add/edit/delete rules
- Pre-populated with 3 example rules based on existing Layer 3 routing patterns (Financial Aid, IT, Registrar)
- Rules stored in component state (in-memory, same as other settings)
- Connected to AppContext via new `routingRules` state

**`src/App.tsx`** — Add route `/settings/routing`
**`src/components/AppLayout.tsx`** — Add Dashboard to nav
**`src/pages/Settings.tsx`** — Add "Routing Rules" card linking to `/settings/routing`

---

## File Summary

| File | Action |
|------|--------|
| `src/pages/Login.tsx` | Remove connect-email redirect, always go to `/inbox` |
| `src/App.tsx` | Fix login redirect + add `/dashboard` + `/settings/routing` routes |
| `src/components/AppLayout.tsx` | Add Dashboard link to sidebar nav |
| `src/pages/Dashboard.tsx` | New — stats cards + office chart + recent activity |
| `src/pages/SettingsRouting.tsx` | New — routing rules CRUD editor |
| `src/pages/Settings.tsx` | Add Routing Rules card |
| `src/context/AppContext.tsx` | Add `routingRules` state + methods |
| `src/types/index.ts` | Add `RoutingRule` type |
