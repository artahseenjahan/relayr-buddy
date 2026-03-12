
## CampusReply MVP — Implementation Plan

### Architecture Overview
- **Mock database**: In-memory data store with TypeScript interfaces matching the full data model
- **Mock AI**: Deterministic draft generator using persona/rulebook rules
- **React Router**: All routes as defined
- **State management**: React Context + hooks for global state (current user, school, office, persona)

---

### Phase 1: Data Layer & Seed Data
- Full TypeScript types for all entities (School, Office, OfficeRulebook, Persona, User, Ticket, Draft, Decision, etc.)
- Mock database module with all seed data:
  - 1 Public University (e.g., "Westbrook State University")
  - 4 Offices: Admissions, Registrar, Financial Aid, IT Help Desk
  - OfficeRulebook per office with realistic rules
  - 1–2 Personas per office
  - 8 realistic tickets per office (32 total)
  - 1 seed user linked to Admissions

---

### Phase 2: Auth & Onboarding Flow
- `/login` — email/password form, mock auth, redirect logic
- `/connect-email` — Gmail/Outlook mock OAuth buttons, sets MailboxConnection
- `/setup-school` — form with name, category dropdown, domain
- `/setup-office` — name, description, primary audience
- `/setup-rulebook` — dynamic list fields for all 6 rulebook sections
- `/setup-persona` — 4-section form (Role, Tone/Style, Boundaries, Language)

---

### Phase 3: Inbox Page (`/inbox`)
- 3-pane layout:
  - **Left**: Filters (Status, Office, Persona, Tags, Risk Flags) + Search bar
  - **Center**: Ticket list cards (fromName, subject, office, persona, tags, risk badge, status pill)
  - Clicking a ticket navigates to `/ticket/:id`

---

### Phase 4: Ticket Page (`/ticket/:id`)
- 3-pane layout:
  - **Left panel**: Metadata (office, persona, status, tags, risk flags), assign dropdown, internal note input
  - **Center**: Full email thread with regex-based sensitive data highlighting (SSN, DOB patterns, etc.)
  - **Right panel**: AI Draft editor (editable textarea, tone adjustment buttons: Shorten / More Formal / More Warm / Add Bullet List), evidence section (sources, examples, confidence score), escalation banner (yellow) when triggers matched
- **Sticky bottom bar**: Approve & Send | Edit & Send | Reject | Create Draft in Gmail/Outlook (all mock)

---

### Phase 5: Mock Draft Generation
- `generateDraft(ticket, office, rulebook, persona)` function:
  - Builds greeting → acknowledgement → answer → next steps → closing → signature
  - Injects `approvedPhrases`, `requiredDisclaimers`, `requiredLinks` based on topic matching
  - Respects `hardConstraints` (filters forbidden phrases)
  - Checks `escalationTriggers` → sets riskFlags if matched
  - Populates `sourcesUsed` (mock), `confidenceScore` (realistic random)
- Tone adjustment buttons call modifier functions on existing draft text

---

### Phase 6: Settings Page (`/settings`)
- Connected mailbox display with Disconnect button
- Delete all drafts & decisions button (with confirmation)
- Data retention toggle (mock)

---

### Design System
- Clean modern admin dashboard aesthetic
- Color palette: neutral grays + blue primary + amber for warnings/risk flags + green for approved/sent
- Status pills with distinct colors per status
- Risk flag badges in amber/red
- Sidebar navigation (collapsible) with icons for Inbox, Settings
- Responsive 3-pane layouts with proper scroll areas
