import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AppLayout from '../components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Mail, Trash2, ShieldCheck, CheckCircle2, XCircle, Settings as SettingsIcon, BookOpen, ArrowRight, LogOut, Clock, ExternalLink, GitMerge } from 'lucide-react';
import { format, formatDistanceToNowStrict } from 'date-fns';

export default function Settings() {
  const navigate = useNavigate();
  const { mailboxConnection, disconnectMailbox, clearAllDraftsAndDecisions, drafts, decisions, googleSession, revokeGoogle } = useApp();
  const [dataRetention, setDataRetention] = useState(true);
  const [cleared, setCleared] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const handleClear = () => {
    clearAllDraftsAndDecisions();
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await revokeGoogle();
    } finally {
      setRevoking(false);
    }
  };

  const tokenExpiry = googleSession
    ? new Date(googleSession.expiresAt)
    : null;
  const tokenValid = tokenExpiry && tokenExpiry > new Date();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-primary" /> Settings
        </h2>

        {/* Google Account */}
        {googleSession ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <path fill="#4285F4" d="M12 4.993c1.659 0 3.167.622 4.32 1.641l2.734-2.734C17.326 2.492 14.836 1.5 12 1.5 7.826 1.5 4.227 3.879 2.44 7.345l3.132 2.444A6.977 6.977 0 0 1 12 4.993z"/>
                  <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 0 4.94 12c0 .82.1 1.617.326 2.235v2.824l3.285-2.566A6.978 6.978 0 0 0 12 15.007c1.316 0 2.568-.368 3.59-.984l3.285 2.566v-2.824A7.077 7.077 0 0 0 19.06 12a7.077 7.077 0 0 0-.326-2.235l-3.132 2.445A6.98 6.98 0 0 0 12 13.216a6.98 6.98 0 0 0-3.602-1.006L5.266 9.765z"/>
                  <path fill="#FBBC05" d="M4.94 12c0-.82.1-1.617.326-2.235L2.44 7.345A10.458 10.458 0 0 0 1.5 12c0 1.668.388 3.25 1.073 4.655l3.132-2.444A6.978 6.978 0 0 1 4.94 12z"/>
                  <path fill="#34A853" d="M12 19.007a6.978 6.978 0 0 1-3.449-.907L5.266 20.666C7.063 21.867 9.45 22.5 12 22.5c2.836 0 5.326-.992 7.054-2.625l-3.132-2.444A6.977 6.977 0 0 1 12 19.007z"/>
                </svg>
                Google Account
              </CardTitle>
              <CardDescription>Gmail integration for persona calibration and personalised drafts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {googleSession.userPicture ? (
                  <img src={googleSession.userPicture} alt="avatar" className="w-9 h-9 rounded-full border border-border" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                    {googleSession.userName?.[0] || 'G'}
                  </div>
                )}
                <div>
                  <div className="font-medium text-sm">{googleSession.userName}</div>
                  <div className="text-xs text-muted-foreground">{googleSession.userEmail}</div>
                </div>
                {tokenValid ? (
                  <span className="ml-auto text-[10px] bg-[hsl(var(--status-approved))]/15 text-[hsl(var(--status-approved))] px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="ml-auto text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
                    Expired
                  </span>
                )}
              </div>

              {tokenExpiry && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {tokenValid
                    ? `Token expires in ${formatDistanceToNowStrict(tokenExpiry)}`
                    : `Token expired ${formatDistanceToNowStrict(tokenExpiry)} ago`
                  } · Read-only · No email content stored
                </div>
              )}

              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={revoking} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                      <LogOut className="w-3.5 h-3.5" />
                      {revoking ? 'Revoking…' : 'Revoke Access'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke Google Access?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will revoke Relayr's access to your Gmail and clear the stored token. Draft personalisation and persona calibration from Gmail will no longer be available until you reconnect.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Revoke Access
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Manage at Google Account
                </a>
              </div>

              <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                <span>Token stored in-session only (expires 1 hour). No email content or full bodies are ever stored. Gmail access is read-only — Relayr cannot send emails on your behalf.</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <path fill="#4285F4" d="M12 4.993c1.659 0 3.167.622 4.32 1.641l2.734-2.734C17.326 2.492 14.836 1.5 12 1.5 7.826 1.5 4.227 3.879 2.44 7.345l3.132 2.444A6.977 6.977 0 0 1 12 4.993z"/>
                  <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 0 4.94 12c0 .82.1 1.617.326 2.235v2.824l3.285-2.566A6.978 6.978 0 0 0 12 15.007c1.316 0 2.568-.368 3.59-.984l3.285 2.566v-2.824A7.077 7.077 0 0 0 19.06 12a7.077 7.077 0 0 0-.326-2.235l-3.132 2.445A6.98 6.98 0 0 0 12 13.216a6.98 6.98 0 0 0-3.602-1.006L5.266 9.765z"/>
                  <path fill="#FBBC05" d="M4.94 12c0-.82.1-1.617.326-2.235L2.44 7.345A10.458 10.458 0 0 0 1.5 12c0 1.668.388 3.25 1.073 4.655l3.132-2.444A6.978 6.978 0 0 1 4.94 12z"/>
                  <path fill="#34A853" d="M12 19.007a6.978 6.978 0 0 1-3.449-.907L5.266 20.666C7.063 21.867 9.45 22.5 12 22.5c2.836 0 5.326-.992 7.054-2.625l-3.132-2.444A6.977 6.977 0 0 1 12 19.007z"/>
                </svg>
                Google Account
              </CardTitle>
              <CardDescription>Connect Gmail to personalise AI drafts using your sent mail history</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/connect-email')}>
                <Mail className="w-3.5 h-3.5" /> Connect Google Account
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Connected Mailbox */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-primary" /> Connected Mailbox
            </CardTitle>
            <CardDescription>Manage your email provider connection</CardDescription>
          </CardHeader>
          <CardContent>
            {mailboxConnection ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {mailboxConnection.status === 'connected' ? (
                    <CheckCircle2 className="w-5 h-5 text-[hsl(var(--status-approved))]" />
                  ) : (
                    <XCircle className="w-5 h-5 text-[hsl(var(--status-rejected))]" />
                  )}
                  <div>
                    <div className="font-medium text-sm capitalize">
                      {mailboxConnection.provider === 'gmail' ? 'Google Gmail' : 'Microsoft Outlook'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Status: <span className={mailboxConnection.status === 'connected'
                        ? 'text-[hsl(var(--status-approved))]'
                        : 'text-[hsl(var(--status-rejected))]'
                      }>{mailboxConnection.status}</span>
                      {mailboxConnection.status === 'connected' && (
                        <span> · Last synced {format(new Date(mailboxConnection.lastSyncAt), 'MMM d, h:mm a')}</span>
                      )}
                    </div>
                  </div>
                </div>
                {mailboxConnection.status === 'connected' && (
                  <Button variant="outline" size="sm" onClick={disconnectMailbox} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    Disconnect
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No mailbox connected. <a href="/connect-email" className="text-primary hover:underline">Connect now →</a></div>
            )}
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trash2 className="w-4 h-4 text-primary" /> Data Management
            </CardTitle>
            <CardDescription>Manage stored drafts and decision history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Drafts & Decisions</div>
                <div className="text-xs text-muted-foreground">
                  {drafts.length} draft{drafts.length !== 1 ? 's' : ''} · {decisions.length} decision{decisions.length !== 1 ? 's' : ''} stored
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Drafts & Decisions?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {drafts.length} drafts and {decisions.length} decision records. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            {cleared && (
              <div className="text-xs text-[hsl(var(--status-approved))] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> All drafts and decisions have been deleted.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Routing Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitMerge className="w-4 h-4 text-primary" /> Routing Rules
            </CardTitle>
            <CardDescription>Configure keyword-based rules that auto-suggest routing to the right department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Define which keywords trigger routing suggestions to Financial Aid, Registrar, IT, and other offices via the Layer 3 intelligence engine.
              </p>
              <Button variant="outline" size="sm" className="ml-4 shrink-0 gap-1.5" onClick={() => navigate('/settings/routing')}>
                Manage <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rulebook */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="w-4 h-4 text-primary" /> Rulebook & Responsibility Layers
            </CardTitle>
            <CardDescription>Upload and manage institutional policy documents for AI grounding</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Upload PDF or DOCX rulebooks and the AI will extract responsibilities, constraints, and role boundaries across all three intelligence layers.
              </p>
              <Button variant="outline" size="sm" className="ml-4 shrink-0 gap-1.5" onClick={() => navigate('/settings/rulebook')}>
                Manage <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-4 h-4 text-primary" /> Privacy & Retention
            </CardTitle>
            <CardDescription>Control how your data is stored and handled</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="retention" className="font-medium">Data Retention</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Keep draft history and decision logs for audit purposes
                </p>
              </div>
              <Switch
                id="retention"
                checked={dataRetention}
                onCheckedChange={setDataRetention}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded-md">
              🔒 CampusReply never auto-sends emails. All drafts require human approval before sending.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
