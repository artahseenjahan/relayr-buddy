import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Mail, CheckCircle2 } from 'lucide-react';

export default function ConnectEmail() {
  const navigate = useNavigate();
  const { connectMailbox } = useApp();
  const [connecting, setConnecting] = useState<'gmail' | 'outlook' | null>(null);
  const [connected, setConnected] = useState<'gmail' | 'outlook' | null>(null);

  const handleConnect = async (provider: 'gmail' | 'outlook') => {
    setConnecting(provider);
    await new Promise(r => setTimeout(r, 1500));
    connectMailbox(provider);
    setConnected(provider);
    setConnecting(null);
    setTimeout(() => navigate('/inbox'), 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(220,20%,97%)] to-[hsl(221,83%,96%)]">
      <div className="w-full max-w-lg px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Connect Your Mailbox</h1>
          <p className="text-muted-foreground mt-1">Link an office email account to start reviewing tickets</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Select Email Provider
            </CardTitle>
            <CardDescription>
              CampusReply will read incoming emails and help you draft replies. No emails are sent without your approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(['gmail', 'outlook'] as const).map(provider => (
              <button
                key={provider}
                onClick={() => !connected && handleConnect(provider)}
                disabled={!!connected || !!connecting}
                className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted">
                  {provider === 'gmail' ? (
                    <svg viewBox="0 0 24 24" className="w-6 h-6">
                      <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 0 4.94 12c0 .82.1 1.617.326 2.235v2.824l3.285-2.566A6.978 6.978 0 0 0 12 15.007c1.316 0 2.568-.368 3.59-.984l3.285 2.566v-2.824A7.077 7.077 0 0 0 19.06 12a7.077 7.077 0 0 0-.326-2.235l-3.132 2.445A6.98 6.98 0 0 0 12 13.216a6.98 6.98 0 0 0-3.602-1.006L5.266 9.765z"/>
                      <path fill="#4285F4" d="M12 4.993c1.659 0 3.167.622 4.32 1.641l2.734-2.734C17.326 2.492 14.836 1.5 12 1.5 7.826 1.5 4.227 3.879 2.44 7.345l3.132 2.444A6.977 6.977 0 0 1 12 4.993z"/>
                      <path fill="#FBBC05" d="M4.94 12c0-.82.1-1.617.326-2.235L2.44 7.345A10.458 10.458 0 0 0 1.5 12c0 1.668.388 3.25 1.073 4.655l3.132-2.444A6.978 6.978 0 0 1 4.94 12z"/>
                      <path fill="#34A853" d="M12 19.007a6.978 6.978 0 0 1-3.449-.907L5.266 20.666C7.063 21.867 9.45 22.5 12 22.5c2.836 0 5.326-.992 7.054-2.625l-3.132-2.444A6.977 6.977 0 0 1 12 19.007z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#0078D4">
                      <path d="M2 6.5L12 2l10 4.5V18L12 22 2 18V6.5z"/>
                      <path fill="white" d="M12 2L2 6.5v11.5l10 4 10-4V6.5L12 2zm0 2.19L20 8v8.5L12 20 4 16.5V8l8-3.81z"/>
                    </svg>
                  )}
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-foreground capitalize">
                    {provider === 'gmail' ? 'Google Gmail' : 'Microsoft Outlook'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {provider === 'gmail' ? 'Connect your Gmail account via OAuth' : 'Connect your Outlook/Exchange account'}
                  </div>
                </div>
                {connected === provider ? (
                  <CheckCircle2 className="w-5 h-5 text-[hsl(var(--status-approved))]" />
                ) : connecting === provider ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : null}
              </button>
            ))}

            <p className="text-xs text-muted-foreground text-center pt-2">
              🔒 Mock OAuth — no real credentials are collected in this demo
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
