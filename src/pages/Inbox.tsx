import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { offices, personas } from '../data/mockDb';
import { Ticket, TicketStatus } from '../types';
import { checkGmailConnection, fetchInboxEmails, GmailMessageMeta } from '../lib/gmailApi';
import AppLayout from '../components/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, AlertTriangle, Filter, Clock, Mail, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const STATUS_OPTIONS: { value: TicketStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'sent', label: 'Sent' },
];

const STATUS_LABEL: Record<TicketStatus, string> = {
  needs_review: 'Needs Review',
  approved: 'Approved',
  rejected: 'Rejected',
  assigned: 'Assigned',
  sent: 'Sent',
};

function StatusPill({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium status-${status}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function TicketCard({ ticket, isSelected, onClick }: { ticket: Ticket; isSelected: boolean; onClick: () => void }) {
  const office = offices.find(o => o.id === ticket.officeId);
  const persona = personas.find(p => p.id === ticket.personaId);
  const hasRisk = ticket.riskFlags.length > 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 border-b border-border transition-colors hover:bg-accent/60 ${
        isSelected ? 'bg-accent border-l-2 border-l-primary' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-semibold text-sm text-foreground truncate">{ticket.fromName}</span>
        <div className="flex items-center gap-1 shrink-0">
          {hasRisk && <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--risk-flag))]" />}
          <StatusPill status={ticket.status} />
        </div>
      </div>
      <p className="text-sm text-foreground/80 truncate mb-1.5">{ticket.subject}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {office && <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{office.name}</span>}
        {persona && <span className="text-xs text-muted-foreground">{persona.roleTitle}</span>}
        {ticket.tags.slice(0, 2).map(tag => (
          <span key={tag} className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded">{tag}</span>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        {formatDistanceToNow(new Date(ticket.receivedAt), { addSuffix: true })}
      </div>
    </button>
  );
}

/** Convert Gmail messages to Ticket format for display */
function gmailToTickets(emails: GmailMessageMeta[]): Ticket[] {
  return emails.map((email, i) => {
    const fromMatch = email.from?.match(/^(.+?)\s*<(.+?)>$/);
    const fromName = fromMatch ? fromMatch[1].replace(/"/g, '') : email.from || 'Unknown';
    const fromEmail = fromMatch ? fromMatch[2] : email.from || '';
    return {
      id: `gmail-${email.id}`,
      officeId: '',
      personaId: '',
      fromName,
      fromEmail,
      subject: email.subject,
      receivedAt: email.date ? new Date(email.date).toISOString() : new Date().toISOString(),
      status: 'needs_review' as TicketStatus,
      tags: [],
      riskFlags: [],
      threadMessages: [{
        id: email.id,
        ticketId: `gmail-${email.id}`,
        direction: 'inbound' as const,
        body: email.snippet,
        sentAt: email.date ? new Date(email.date).toISOString() : new Date().toISOString(),
      }],
    };
  });
}

export default function Inbox() {
  const navigate = useNavigate();
  const { tickets: mockTickets } = useApp();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Gmail state
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [gmailEmails, setGmailEmails] = useState<Ticket[]>([]);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  // Check Gmail connection on mount
  useEffect(() => {
    if (user) {
      checkGmailConnection()
        .then(res => {
          setGmailConnected(res.connected);
          if (res.connected) {
            loadGmailInbox();
          }
        })
        .catch(() => setGmailConnected(false));
    }
  }, [user]);

  const loadGmailInbox = async () => {
    setLoadingGmail(true);
    setGmailError(null);
    try {
      const emails = await fetchInboxEmails(30);
      setGmailEmails(gmailToTickets(emails));
    } catch (err: any) {
      setGmailError(err.message || 'Failed to load Gmail inbox');
    } finally {
      setLoadingGmail(false);
    }
  };

  // Use real Gmail emails if connected, otherwise fall back to mock
  const allTickets = gmailConnected && gmailEmails.length > 0 ? gmailEmails : mockTickets;

  const filtered = useMemo(() => {
    return allTickets.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (officeFilter !== 'all' && t.officeId !== officeFilter) return false;
      if (riskFilter && t.riskFlags.length === 0) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.fromName.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.fromEmail.toLowerCase().includes(q) ||
          t.tags.some(tag => tag.toLowerCase().includes(q));
      }
      return true;
    });
  }, [allTickets, statusFilter, officeFilter, riskFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    STATUS_OPTIONS.forEach(s => {
      c[s.value] = s.value === 'all' ? allTickets.length : allTickets.filter(t => t.status === s.value).length;
    });
    return c;
  }, [allTickets]);

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Left Filter Panel */}
        <div className="w-56 shrink-0 border-r border-border bg-card p-4 space-y-5 overflow-y-auto">
          {/* Gmail connection status */}
          {user && gmailConnected === false && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
              <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-primary" />
                Gmail not connected
              </p>
              <p className="text-[10px] text-muted-foreground">Connect Gmail to see your real inbox here.</p>
              <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => navigate('/connect-email')}>
                Connect Gmail
              </Button>
            </div>
          )}

          {gmailConnected && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--status-approved))]" />
              Live Gmail inbox
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Status
            </h3>
            <div className="space-y-0.5">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value as TicketStatus | 'all')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                    statusFilter === opt.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="text-xs opacity-70">{counts[opt.value]}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Office</h3>
            <div className="space-y-0.5">
              <button
                onClick={() => setOfficeFilter('all')}
                className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                  officeFilter === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >All Offices</button>
              {offices.map(o => (
                <button
                  key={o.id}
                  onClick={() => setOfficeFilter(o.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                    officeFilter === o.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'
                  }`}
                >
                  {o.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Risk Flags</h3>
            <button
              onClick={() => setRiskFilter(!riskFilter)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                riskFilter ? 'bg-[hsl(var(--risk-flag-bg))] text-[hsl(var(--risk-flag))]' : 'hover:bg-muted text-foreground'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Flagged Only
            </button>
          </div>
        </div>

        {/* Ticket List */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-border bg-card">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, subject, or tag…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs text-muted-foreground">{filtered.length} ticket{filtered.length !== 1 ? 's' : ''}</p>
              {loadingGmail && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading Gmail…
                </span>
              )}
              {gmailError && (
                <span className="text-xs text-destructive">{gmailError}</span>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No tickets match your filters</p>
              </div>
            ) : (
              filtered.map(ticket => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  isSelected={selectedId === ticket.id}
                  onClick={() => {
                    setSelectedId(ticket.id);
                    navigate(`/ticket/${ticket.id}`);
                  }}
                />
              ))
            )}
          </ScrollArea>
        </div>
      </div>
    </AppLayout>
  );
}
