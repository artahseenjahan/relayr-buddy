import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AppLayout from '../components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calendar, CheckCircle2, Loader2, AlertCircle, Unlink,
  Clock, ChevronRight, RefreshCw, Lock, Info,
} from 'lucide-react';
import { getFreeBusySlots, formatSlotForEmail, CalendarSlot } from '../lib/calendarApi';
import { format, isToday, isTomorrow } from 'date-fns';

function groupSlotsByDay(slots: CalendarSlot[]): Map<string, CalendarSlot[]> {
  const map = new Map<string, CalendarSlot[]>();
  slots.forEach(slot => {
    const key = format(slot.start, 'yyyy-MM-dd');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(slot);
  });
  return map;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEEE, MMM d');
}

export default function SettingsCalendar() {
  const navigate = useNavigate();
  const { calendarConnection, connectCalendar, disconnectCalendar, googleSession } = useApp();

  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [slotsFetched, setSlotsFetched] = useState(false);

  const isConnected = calendarConnection?.status === 'connected';

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      await connectCalendar();
    } catch (err: any) {
      setConnectError(err?.message || 'Failed to connect Google Calendar.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectCalendar();
    setSlots([]);
    setSlotsFetched(false);
  };

  const handleLoadAvailability = async () => {
    if (!calendarConnection || !googleSession) return;
    setLoadingSlots(true);
    setSlotError(null);
    try {
      const result = await getFreeBusySlots(googleSession.accessToken);
      setSlots(result);
      setSlotsFetched(true);
    } catch (err: any) {
      setSlotError(err?.message || 'Failed to fetch availability.');
    } finally {
      setLoadingSlots(false);
    }
  };

  const grouped = groupSlotsByDay(slots);

  return (
    <AppLayout>
      <ScrollArea className="h-full">
        <div className="max-w-2xl mx-auto p-6 space-y-6">

          {/* Header */}
          <div>
            <h2 className="text-base font-semibold text-foreground">Calendar Integration</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Connect your calendar to automatically suggest available meeting slots when replying to emails.
            </p>
          </div>

          {/* Google Calendar Card */}
          <div className="border border-border rounded-xl bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">Google Calendar</div>
                <div className="text-xs text-muted-foreground">Read-only · FreeBusy access only</div>
              </div>
              {isConnected && (
                <Badge variant="outline" className="gap-1 text-xs border-primary/30 text-primary bg-primary/5">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </Badge>
              )}
            </div>

            <div className="p-5 space-y-4">
              {isConnected ? (
                <>
                  {/* Connected state */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground">{calendarConnection.userEmail}</div>
                      <div className="text-xs text-muted-foreground">
                        Connected {format(new Date(calendarConnection.connectedAt), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDisconnect}
                      className="text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Unlink className="w-3.5 h-3.5" /> Disconnect
                    </Button>
                  </div>

                  {/* Load availability */}
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadAvailability}
                      disabled={loadingSlots}
                      className="gap-1.5 text-xs"
                    >
                      {loadingSlots
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading availability…</>
                        : slotsFetched
                        ? <><RefreshCw className="w-3.5 h-3.5" /> Refresh availability</>
                        : <><Clock className="w-3.5 h-3.5" /> Preview my availability</>
                      }
                    </Button>
                    {slotError && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {slotError}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Connect your Google Calendar to let CampusReply detect your free slots and suggest meeting times directly inside email drafts. Only busy/free status is read — no event titles or details are accessed.
                  </p>
                  {connectError && (
                    <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {connectError}
                    </div>
                  )}
                  <Button onClick={handleConnect} disabled={connecting} size="sm" className="gap-1.5">
                    {connecting
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting…</>
                      : <><Calendar className="w-3.5 h-3.5" /> Connect Google Calendar</>
                    }
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Availability Preview */}
          {isConnected && slotsFetched && (
            <div className="border border-border rounded-xl bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">Your Availability (Next 7 Days)</span>
                <span className="text-xs text-muted-foreground ml-auto">Mon–Fri · 9 AM – 5 PM</span>
              </div>
              <div className="p-5">
                {slots.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No free slots found in the next 7 business days.</p>
                    <p className="text-xs mt-1 opacity-70">Your calendar appears fully booked during business hours.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.from(grouped.entries()).map(([dateKey, daySlots]) => (
                      <div key={dateKey}>
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          {dayLabel(dateKey)}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {daySlots.map((slot, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary font-medium"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                              {format(slot.start, 'h:mm a')}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground pt-1">
                      {slots.length} free 30-min slot{slots.length !== 1 ? 's' : ''} found · event titles not read
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Microsoft Outlook — Coming Soon */}
          <div className="border border-border rounded-xl bg-card overflow-hidden opacity-70">
            <div className="px-5 py-4 border-b border-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <Calendar className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Microsoft Outlook Calendar
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Coming soon</Badge>
                </div>
                <div className="text-xs text-muted-foreground">Read-only · FreeBusy access via Microsoft Graph</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Outlook Calendar integration via Microsoft Graph API is coming soon. This will support institutions using Office 365 and Microsoft 365.
              </p>
              <Button variant="outline" size="sm" disabled className="mt-3 text-xs gap-1.5 opacity-50">
                <Calendar className="w-3.5 h-3.5" /> Connect Outlook Calendar
              </Button>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted border border-border text-xs text-muted-foreground">
            <Lock className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="space-y-1">
              <div className="font-medium text-foreground">Privacy & Data Handling</div>
              <p>Calendar data is accessed read-only using your existing Google session token. Only busy/free status is read — no event titles, attendees, or descriptions are accessed or stored. Availability is fetched on-demand and never persisted.</p>
            </div>
          </div>

          {/* How it works in tickets */}
          {isConnected && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-border text-xs text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
              <div className="space-y-1">
                <div className="font-medium text-foreground">Using availability in ticket replies</div>
                <p>When composing a reply in any ticket, click the <strong className="text-foreground">Insert Available Slots</strong> button in the Draft tab. CampusReply will fetch your next free slots and append a formatted availability block to the email draft.</p>
                <button
                  onClick={() => navigate('/inbox')}
                  className="mt-1 text-primary hover:underline font-medium"
                >
                  Go to Inbox →
                </button>
              </div>
            </div>
          )}

        </div>
      </ScrollArea>
    </AppLayout>
  );
}
