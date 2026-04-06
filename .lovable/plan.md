

## Fix: Add VITE_GOOGLE_CLIENT_ID to Frontend

### Problem
The persona calibration flow calls `signInWithGoogle()` in `googleAuth.ts`, which reads `import.meta.env.VITE_GOOGLE_CLIENT_ID`. This variable is **not in the `.env` file**, so it's always `undefined`, causing the "VITE_GOOGLE_CLIENT_ID is not set" error.

The value exists in the backend secrets vault (for Edge Functions), but the frontend `.env` is a separate file that Vite reads at build time.

### Why This Is Safe
The Google Client ID is a **public key** — it appears in every OAuth URL your users see. Google designed it to be exposed to browsers. The **Client Secret** (which IS private) is already safely stored server-side only.

### What I Will Do

1. **Ask you for the Google Client ID value** — I need you to share the Client ID string (the one ending in `.apps.googleusercontent.com`) so I can add it to the `.env` file. Since the `.env` is auto-managed, I will instead hardcode it directly in `googleAuth.ts` and `ConnectEmail.tsx` as a fallback constant.

   Alternatively, the cleaner approach: **add it as a constant in a shared config file** that both `googleAuth.ts` and `ConnectEmail.tsx` import from.

2. **No other code changes needed** — once the Client ID is available to the frontend, the existing `signInWithGoogle()` → `fetchSentEmails()` → persona extraction pipeline will work end-to-end.

### What You Need To Do
Share your Google Client ID (the value, not the secret). It looks like: `123456789-xxxxx.apps.googleusercontent.com`

