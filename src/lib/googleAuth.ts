/**
 * Google Identity Services (GIS) OAuth wrapper.
 * Uses the implicit flow (token model) — no refresh tokens, no server-side secrets.
 * Scope: gmail.readonly — read-only access, no send/write capability.
 * Tokens expire after 1 hour and are stored in sessionStorage only.
 */

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'openid',
  'email',
  'profile',
].join(' ');

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
  'profile',
].join(' ');

const SESSION_TOKEN_KEY = 'cr_gtoken';
const SESSION_USER_KEY = 'cr_guser';

export interface GoogleOAuthSession {
  accessToken: string;
  expiresAt: number; // Unix ms timestamp
  userEmail: string;
  userName: string;
  userPicture?: string;
}

/** Light obfuscation — NOT encryption. Keeps casual exposure low. Never rely on this for security. */
function obfuscate(val: string): string {
  return btoa(
    val
      .split('')
      .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (42 + (i % 13))))
      .join('')
  );
}
function deobfuscate(val: string): string {
  return atob(val)
    .split('')
    .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (42 + (i % 13))))
    .join('');
}

export function storeSession(session: GoogleOAuthSession): void {
  sessionStorage.setItem(SESSION_TOKEN_KEY, obfuscate(JSON.stringify(session)));
}

export function loadSession(): GoogleOAuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!raw) return null;
    const session: GoogleOAuthSession = JSON.parse(deobfuscate(raw));
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_USER_KEY);
}

/** Load the Google Identity Services script once. */
let gisLoaded = false;
function loadGIS(): Promise<void> {
  if (gisLoaded || (window as any).google?.accounts) {
    gisLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => { gisLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

/** Fetch the authenticated user's profile using the access token. */
async function fetchGoogleProfile(accessToken: string): Promise<{ email: string; name: string; picture?: string }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Google profile');
  const data = await res.json();
  return { email: data.email || '', name: data.name || data.email || 'Google User', picture: data.picture };
}

/** Initiate Google OAuth implicit flow (popup). Resolves with a GoogleOAuthSession. */
export async function signInWithGoogle(): Promise<GoogleOAuthSession> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || (await import('./googleConfig')).GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Google Client ID is not configured');

  await loadGIS();

  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPES,
      callback: async (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        try {
          const profile = await fetchGoogleProfile(response.access_token);
          const session: GoogleOAuthSession = {
            accessToken: response.access_token,
            expiresAt: Date.now() + (response.expires_in ? Number(response.expires_in) * 1000 : 3600_000),
            userEmail: profile.email,
            userName: profile.name,
            userPicture: profile.picture,
          };
          storeSession(session);
          resolve(session);
        } catch (err) {
          reject(err);
        }
      },
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

/** Revoke the token on Google's server and clear local storage. */
export async function revokeGoogleToken(accessToken: string): Promise<void> {
  try {
    await loadGIS();
    (window as any).google?.accounts?.oauth2?.revoke(accessToken, () => {});
  } catch {
    // Silently fail — local clear still happens
  } finally {
    clearSession();
  }
}

export function getValidSession(): GoogleOAuthSession | null {
  return loadSession();
}
