import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Mail, CheckCircle2, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { exchangeAndStoreTokens, checkGmailConnection } from '../lib/gmailApi';
import { GOOGLE_CLIENT_ID } from '../lib/googleConfig';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'openid',
  'email',
  'profile',
].join(' ');

export default function ConnectEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'exchanging' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

  // Check if already connected
  useEffect(() => {
    if (user) {
      checkGmailConnection().then(res => {
        if (res.connected) {
          setStatus('connected');
          setConnectedEmail(res.email || null);
        }
      }).catch(() => {});
    }
  }, [user]);

  // Handle OAuth callback with code
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && status === 'idle') {
      setStatus('exchanging');
      const redirectUri = `${window.location.origin}/connect-email`;
      exchangeAndStoreTokens(code, redirectUri)
        .then((res) => {
          setStatus('connected');
          setConnectedEmail(res.email || null);
          // Clean URL
          window.history.replaceState({}, '', '/connect-email');
          setTimeout(() => navigate('/inbox'), 1200);
        })
        .catch((err) => {
          setError(err.message || 'Failed to connect Gmail');
          setStatus('error');
          window.history.replaceState({}, '', '/connect-email');
        });
    }
  }, [searchParams, status, navigate]);

  const handleConnect = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'your-client-id-here') {
      setError('Google Client ID is not configured. Please contact the administrator.');
      return;
    }
    const redirectUri = `${window.location.origin}/connect-email`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const handleSkip = () => navigate('/inbox');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(220,20%,97%)] to-[hsl(221,83%,96%)]">
      <div className="w-full max-w-lg px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Connect Your Gmail</h1>
          <p className="text-muted-foreground mt-1">Link your Gmail to enable real inbox viewing, AI draft replies, and persona calibration</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Gmail Connection
            </CardTitle>
            <CardDescription>
              Relayr reads your inbox and sent mail to power AI drafts. Emails can be sent only with your explicit approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {status === 'connected' && (
              <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-[hsl(var(--status-approved))]/30 bg-[hsl(var(--status-approved))]/5">
                <CheckCircle2 className="w-6 h-6 text-[hsl(var(--status-approved))]" />
                <div>
                  <div className="font-semibold text-sm text-foreground">Gmail Connected!</div>
                  {connectedEmail && <div className="text-xs text-muted-foreground">{connectedEmail}</div>}
                </div>
              </div>
            )}

            {status === 'exchanging' && (
              <div className="flex items-center gap-3 p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <div className="text-sm text-foreground">Connecting your Gmail account…</div>
              </div>
            )}

            {(status === 'idle' || status === 'error') && (
              <button
                onClick={handleConnect}
                className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted">
                  <svg viewBox="0 0 24 24" className="w-6 h-6">
                    <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 0 4.94 12c0 .82.1 1.617.326 2.235v2.824l3.285-2.566A6.978 6.978 0 0 0 12 15.007c1.316 0 2.568-.368 3.59-.984l3.285 2.566v-2.824A7.077 7.077 0 0 0 19.06 12a7.077 7.077 0 0 0-.326-2.235l-3.132 2.445A6.98 6.98 0 0 0 12 13.216a6.98 6.98 0 0 0-3.602-1.006L5.266 9.765z"/>
                    <path fill="#4285F4" d="M12 4.993c1.659 0 3.167.622 4.32 1.641l2.734-2.734C17.326 2.492 14.836 1.5 12 1.5 7.826 1.5 4.227 3.879 2.44 7.345l3.132 2.444A6.977 6.977 0 0 1 12 4.993z"/>
                    <path fill="#FBBC05" d="M4.94 12c0-.82.1-1.617.326-2.235L2.44 7.345A10.458 10.458 0 0 0 1.5 12c0 1.668.388 3.25 1.073 4.655l3.132-2.444A6.978 6.978 0 0 1 4.94 12z"/>
                    <path fill="#34A853" d="M12 19.007a6.978 6.978 0 0 1-3.449-.907L5.266 20.666C7.063 21.867 9.45 22.5 12 22.5c2.836 0 5.326-.992 7.054-2.625l-3.132-2.444A6.977 6.977 0 0 1 12 19.007z"/>
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-foreground">Connect Google Gmail</div>
                  <div className="text-xs text-muted-foreground">Read inbox + sent mail · Send replies with approval · Persona calibration</div>
                </div>
              </button>
            )}

            {/* Privacy note */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 shrink-0 text-primary mt-0.5" />
              <div>
                <span className="font-medium text-foreground">Privacy guarantee:</span> Tokens are stored server-side and encrypted. No email content is permanently stored. Access can be revoked at any time from Settings or{' '}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  myaccount.google.com/permissions
                </a>.
              </div>
            </div>

            <button
              onClick={handleSkip}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
            >
              Skip for now and use demo mode →
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
