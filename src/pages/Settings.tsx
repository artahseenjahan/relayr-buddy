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
import { Mail, Trash2, ShieldCheck, CheckCircle2, XCircle, Settings as SettingsIcon, BookOpen, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export default function Settings() {
  const { mailboxConnection, disconnectMailbox, clearAllDraftsAndDecisions, drafts, decisions } = useApp();
  const [dataRetention, setDataRetention] = useState(true);
  const [cleared, setCleared] = useState(false);

  const handleClear = () => {
    clearAllDraftsAndDecisions();
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-primary" /> Settings
        </h2>

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
