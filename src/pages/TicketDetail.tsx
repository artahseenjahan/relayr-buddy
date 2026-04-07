import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { offices, personas, getRulebookByOfficeId } from '../data/mockDb';
import { generateDraft, shortenDraft, makeMoreFormal, makeMoreWarm, addBulletList } from '../lib/draftGenerator';
import { buildIntelligenceReport, IntelligenceReport } from '../lib/intelligenceEngine';
import { searchGmailSent, extractTicketKeywords, checkGmailConnection } from '../lib/gmailApi';
import { getFreeBusySlots, buildAvailabilityText } from '../lib/calendarApi';
import { Decision } from '../types';
import AppLayout from '../components/AppLayout';
import IntelligencePanel from '../components/IntelligencePanel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle, Sparkles, CheckCircle2, X, Edit3, Mail, ArrowLeft,
  Tag, Flag, MessageSquare, BookOpen, BarChart2, Brain, RefreshCw,
  ArrowRightCircle, RotateCcw, History, CalendarDays, Loader2
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const SENSITIVE_PATTERNS = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, label: 'SSN' },
  { pattern: /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g, label: 'DOB' },
  { pattern: /\b[A-Z]{1,2}\d{6,8}\b/g, label: 'ID' },
  { pattern: /\b\d{16}\b/g, label: 'Card#' },
];

function highlightSensitive(text: string): React.ReactNode[] {
  const allMatches: { start: number; end: number; label: string }[] = [];
  SENSITIVE_PATTERNS.forEach(({ pattern, label }) => {
    const re = new RegExp(pattern.source, pattern.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      allMatches.push({ start: m.index, end: m.index + m[0].length, label });
    }
  });
  allMatches.sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let pos = 0, key = 0;
  allMatches.forEach(({ start, end, label }) => {
    if (start > pos) parts.push(<span key={key++}>{text.slice(pos, start)}</span>);
    parts.push(
      <mark key={key++} className="bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-foreground))] rounded px-0.5 cursor-help" title={`Sensitive: ${label}`}>
        {text.slice(start, end)}
      </mark>
    );
    pos = end;
  });
  if (pos < text.length) parts.push(<span key={key++}>{text.slice(pos)}</span>);
  return parts.length > 0 ? parts : [<span key={0}>{text}</span>];
}

const STATUS_LABEL: Record<string, string> = {
  needs_review: 'Needs Review', approved: 'Approved', rejected: 'Rejected',
  assigned: 'Assigned', sent: 'Sent',
};

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tickets, updateTicket, saveDraft, getDraftForTicket, saveDecision, currentUser, calendarConnection } = useApp();
  const { user: authUser } = useAuth();

  const ticket = tickets.find(t => t.id === id);
  const existingDraft = getDraftForTicket(id || '');
  const office = ticket ? offices.find(o => o.id === ticket.officeId) : null;
  const persona = ticket ? personas.find(p => p.id === ticket.personaId) : null;
  const rulebook = ticket ? getRulebookByOfficeId(ticket.officeId) : null;

  const [draftBody, setDraftBody] = useState(existingDraft?.body || '');
  const [draft, setDraft] = useState(existingDraft || null);
  const [generating, setGenerating] = useState(false);
  const [gmailSearching, setGmailSearching] = useState(false);
  const [note, setNote] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [intelligenceReport, setIntelligenceReport] = useState<IntelligenceReport | null>(null);
  const [rightTab, setRightTab] = useState<'draft' | 'intelligence'>('draft');

  const [insertingSlots, setInsertingSlots] = useState(false);
  const [slotInsertError, setSlotInsertError] = useState<string | null>(null);

  // Rejection feedback state
  const [showRejectFeedback, setShowRejectFeedback] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  if (!ticket) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Ticket not found.</div>
      </AppLayout>
    );
  }

  const hasEscalation = ticket.riskFlags.includes('Needs Human Attention');

  const handleGenerate = async () => {
    if (!office || !rulebook || !persona) return;
    setGenerating(true);

    let gmailExamples: string[] = [];

    // Layer 1: search Gmail history for similar past responses
    if (authUser) {
      setGmailSearching(true);
      try {
        const latestMsg = ticket.threadMessages[ticket.threadMessages.length - 1];
        const keywords = extractTicketKeywords(ticket.subject, latestMsg?.body);
        const matches = await searchGmailSent(keywords);
        gmailExamples = matches.map(m => m.snippet).filter(Boolean);
      } catch {
        // Gmail search failure is non-fatal — fall back to standard generation
      }
      setGmailSearching(false);
    }

    await new Promise(r => setTimeout(r, 800));
    const newDraft = generateDraft(ticket, office, rulebook, persona, gmailExamples);
    const report = buildIntelligenceReport(ticket, office, rulebook, persona);
    saveDraft(newDraft);
    setDraft(newDraft);
    setDraftBody(newDraft.body);
    setIntelligenceReport(report);
    setRightTab('draft');
    if (newDraft.body.includes('flagged for additional review') && !ticket.riskFlags.includes('Needs Human Attention')) {
      updateTicket(ticket.id, { riskFlags: [...ticket.riskFlags, 'Needs Human Attention'] });
    }
    setGenerating(false);
  };

  const handleRegenerate = async () => {
    if (!office || !rulebook || !persona) return;
    setRegenerating(true);
    await new Promise(r => setTimeout(r, 1600));
    // Incorporate feedback by modifying tone based on rejection reason
    const newDraft = generateDraft(ticket, office, rulebook, persona);
    let improvedBody = newDraft.body;
    if (rejectReason.toLowerCase().includes('formal') || rejectReason.toLowerCase().includes('professional')) {
      improvedBody = makeMoreFormal(improvedBody);
    }
    if (rejectReason.toLowerCase().includes('warm') || rejectReason.toLowerCase().includes('friendly') || rejectReason.toLowerCase().includes('tone')) {
      improvedBody = makeMoreWarm(improvedBody);
    }
    if (rejectReason.toLowerCase().includes('short') || rejectReason.toLowerCase().includes('concise') || rejectReason.toLowerCase().includes('brief')) {
      improvedBody = shortenDraft(improvedBody);
    }
    if (rejectReason.toLowerCase().includes('bullet') || rejectReason.toLowerCase().includes('list')) {
      improvedBody = addBulletList(improvedBody);
    }
    const updatedDraft = { ...newDraft, body: improvedBody, version: (draft?.version || 1) + 1 };
    saveDraft(updatedDraft);
    setDraft(updatedDraft);
    setDraftBody(updatedDraft.body);
    const report = buildIntelligenceReport(ticket, office, rulebook, persona);
    setIntelligenceReport(report);
    setShowRejectFeedback(false);
    setRejectReason('');
    setRegenerating(false);
  };

  const applyToneModifier = (fn: (body: string) => string) => setDraftBody(prev => fn(prev));

  const handleInsertSlots = async () => {
    setInsertingSlots(true);
    setSlotInsertError(null);
    try {
      
      const slots = await getFreeBusySlots("");
      if (slots.length === 0) {
        setSlotInsertError('No free slots found in the next 7 business days.');
        return;
      }
      const block = buildAvailabilityText(slots);
      setDraftBody(prev => prev ? `${prev}\n\n${block}` : block);
    } catch (err: any) {
      setSlotInsertError(err?.message || 'Failed to fetch availability.');
    } finally {
      setInsertingSlots(false);
    }
  };

  const handleDecision = (action: Decision['action']) => {
    if (action === 'reject') {
      setShowRejectFeedback(true);
      return;
    }
    const decision: Decision = {
      id: `decision-${Date.now()}`,
      ticketId: ticket.id,
      action,
      decidedByUserId: currentUser?.id || 'user-1',
      decidedAt: new Date().toISOString(),
      notes: note,
    };
    saveDecision(decision);
    const statusMap: Record<Decision['action'], string> = {
      approve_send: 'sent', edit_send: 'sent', reject: 'rejected', assign: 'assigned',
    };
    updateTicket(ticket.id, { status: statusMap[action] as any });
    navigate('/inbox');
  };

  const confirmReject = () => {
    const decision: Decision = {
      id: `decision-${Date.now()}`,
      ticketId: ticket.id,
      action: 'reject',
      decidedByUserId: currentUser?.id || 'user-1',
      decidedAt: new Date().toISOString(),
      notes: rejectReason,
    };
    saveDecision(decision);
    updateTicket(ticket.id, { status: 'rejected' });
    navigate('/inbox');
  };

  const hasRoutingAlert = intelligenceReport && intelligenceReport.layer3.routingDecision !== 'handle';

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Top Bar */}
        <div className="px-4 py-2 border-b border-border bg-card shrink-0 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/inbox')} className="gap-1 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Inbox
          </Button>
          <span className="text-muted-foreground">•</span>
          <span className="text-sm font-medium truncate flex-1">{ticket.subject}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium status-${ticket.status}`}>
            {STATUS_LABEL[ticket.status]}
          </span>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* LEFT: Metadata */}
          <div className="w-56 shrink-0 border-r border-border bg-card p-4 overflow-y-auto space-y-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Office</div>
              <div className="text-sm font-medium">{office?.name}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Persona</div>
              <div className="text-sm">{persona?.roleTitle}</div>
              <div className="text-xs text-muted-foreground">Authority Level {persona?.authorityLevel}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">From</div>
              <div className="text-sm font-medium">{ticket.fromName}</div>
              <div className="text-xs text-muted-foreground break-all">{ticket.fromEmail}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Received</div>
              <div className="text-xs">{format(new Date(ticket.receivedAt), 'MMM d, yyyy h:mm a')}</div>
            </div>
            {ticket.tags.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Tags
                </div>
                <div className="flex flex-wrap gap-1">
                  {ticket.tags.map(tag => (
                    <span key={tag} className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            {ticket.riskFlags.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <Flag className="w-3 h-3 text-[hsl(var(--risk-flag))]" /> Risk Flags
                </div>
                {ticket.riskFlags.map(flag => (
                  <div key={flag} className="text-xs bg-[hsl(var(--risk-flag-bg))] text-[hsl(var(--risk-flag))] px-2 py-1 rounded flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {flag}
                  </div>
                ))}
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Assign To</div>
              <Input value={assignedTo} onChange={e => setAssignedTo(e.target.value)} placeholder="Staff name…" className="text-xs h-8" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Internal Note
              </div>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note…" rows={3} className="text-xs" />
            </div>

            {/* Routing action shortcut */}
            {hasRoutingAlert && (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <div className="text-xs font-semibold flex items-center gap-1 text-[hsl(var(--warning-foreground))]">
                  <ArrowRightCircle className="w-3.5 h-3.5" />
                  {intelligenceReport!.layer3.routingDecision === 'escalate' ? 'Escalate To' : 'Route To'}
                </div>
                <div className="text-xs text-muted-foreground">{intelligenceReport!.layer3.suggestedDepartment}</div>
                <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1"
                  onClick={() => {
                    setAssignedTo(intelligenceReport!.layer3.suggestedDepartment || '');
                    setNote(intelligenceReport!.layer3.routingNote || '');
                  }}>
                  <ArrowRightCircle className="w-3 h-3" /> Apply Routing
                </Button>
              </div>
            )}
          </div>

          {/* CENTER: Email Thread */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-border">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-2xl">
                {ticket.threadMessages.map(msg => (
                  <div key={msg.id} className={`rounded-lg p-4 border ${
                    msg.direction === 'inbound' ? 'bg-card border-border' : 'bg-accent border-primary/20 ml-8'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          msg.direction === 'inbound' ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
                        }`}>
                          {msg.direction === 'inbound' ? ticket.fromName[0] : (office?.name[0] || 'O')}
                        </div>
                        <span className="text-xs font-medium">
                          {msg.direction === 'inbound' ? ticket.fromName : office?.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(msg.sentAt), { addSuffix: true })}
                        </span>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        msg.direction === 'inbound' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                      }`}>
                        {msg.direction === 'inbound' ? 'Received' : 'Sent'}
                      </span>
                    </div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      {highlightSensitive(msg.body)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* RIGHT: AI Draft + Intelligence */}
          <div className="w-96 shrink-0 flex flex-col bg-card">
            <Tabs value={rightTab} onValueChange={v => setRightTab(v as any)} className="flex flex-col h-full">
              <div className="px-3 pt-3 shrink-0">
                <TabsList className="w-full grid grid-cols-2 h-8">
                  <TabsTrigger value="draft" className="text-xs gap-1.5">
                    <Sparkles className="w-3 h-3" /> AI Draft
                  </TabsTrigger>
                  <TabsTrigger value="intelligence" className="text-xs gap-1.5 relative">
                    <Brain className="w-3 h-3" /> Intelligence
                    {intelligenceReport && intelligenceReport.layer3.routingDecision !== 'handle' && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive" />
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* DRAFT TAB */}
              <TabsContent value="draft" className="flex-1 flex flex-col mt-0 min-h-0">
                {hasEscalation && (
                  <div className="mx-3 mt-3 p-2.5 rounded-lg bg-[hsl(var(--warning-bg))] border border-[hsl(var(--warning))/30] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-[hsl(var(--warning-foreground))]">Needs Human Attention</div>
                      <div className="text-xs text-[hsl(var(--warning-foreground))]/80">Escalation triggers matched. Review carefully.</div>
                    </div>
                  </div>
                )}

                <div className="p-3 border-b border-border space-y-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <Button onClick={handleGenerate} disabled={generating || gmailSearching} size="sm" className="flex-1 gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      {gmailSearching ? 'Searching Gmail history…' : generating ? 'Generating…' : draft ? 'Regenerate Draft' : 'Generate Draft'}
                    </Button>
                    {draft && (
                      <span className="text-xs text-muted-foreground ml-2">
                        v{draft.version} · {Math.round(draft.confidenceScore * 100)}%
                      </span>
                    )}
                  </div>
                  {authUser && (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-0.5">
                      <History className="w-3 h-3 text-primary" />
                      Gmail history active — draft will be personalised from your sent mail
                    </div>
                  )}
                  {/* Insert Available Slots */}
                  {calendarConnection?.status === 'connected' && (
                    <div className="space-y-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleInsertSlots}
                        disabled={insertingSlots}
                        className="w-full gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
                      >
                        {insertingSlots
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Fetching slots…</>
                          : <><CalendarDays className="w-3 h-3" /> Insert Available Slots</>
                        }
                      </Button>
                      {slotInsertError && (
                        <p className="text-[10px] text-destructive px-1">{slotInsertError}</p>
                      )}
                    </div>
                  )}
                  {!calendarConnection || calendarConnection.status !== 'connected' ? (
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-0.5">
                      <CalendarDays className="w-3 h-3" />
                      <a href="/settings/calendar" className="hover:underline text-primary">Connect Calendar</a>
                      {' '}to suggest available meeting slots
                    </div>
                  ) : null}
                  {draftBody && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        ['Shorten', () => applyToneModifier(shortenDraft)],
                        ['More Formal', () => applyToneModifier(makeMoreFormal)],
                        ['More Warm', () => applyToneModifier(makeMoreWarm)],
                        ['Add Bullets', () => applyToneModifier(addBulletList)],
                      ].map(([label, fn]) => (
                        <Button key={label as string} variant="outline" size="sm" onClick={fn as () => void} className="text-xs h-7">
                          {label as string}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <ScrollArea className="flex-1 p-3">
                  {draftBody ? (
                    <Textarea
                      value={draftBody}
                      onChange={e => setDraftBody(e.target.value)}
                      className="text-xs leading-relaxed resize-none min-h-48 font-mono"
                      rows={18}
                    />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Click "Generate Draft" to create an AI-powered reply grounded in your office's rulebook and persona</p>
                      <p className="text-xs mt-2 text-muted-foreground/60">Switch to Intelligence tab after generating to see the three-layer analysis</p>
                    </div>
                  )}

                  {draft && (
                    <div className="mt-4 space-y-3">
                      <div className="p-3 rounded-lg bg-muted space-y-2">
                        <div className="text-xs font-semibold flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> Sources Used
                        </div>
                        {draft.sourcesUsed.map((s, i) => (
                          <div key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block shrink-0" /> {s}
                          </div>
                        ))}
                      </div>
                      <div className="p-3 rounded-lg bg-muted space-y-2">
                        <div className="text-xs font-semibold flex items-center gap-1">
                          <BarChart2 className="w-3 h-3" /> Confidence Score
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${draft.confidenceScore * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold">{Math.round(draft.confidenceScore * 100)}%</span>
                        </div>
                        {draft.exampleEmailsUsed.map((e, i) => (
                          <div key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block shrink-0" /> {e}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* INTELLIGENCE TAB */}
              <TabsContent value="intelligence" className="flex-1 min-h-0 mt-0">
                <ScrollArea className="h-full p-3">
                  {intelligenceReport ? (
                    <IntelligencePanel report={intelligenceReport} />
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <Brain className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-xs font-medium">No intelligence report yet</p>
                      <p className="text-xs mt-1 opacity-70">Generate a draft first to see the Three-Layer Intelligence analysis</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 gap-1.5 text-xs"
                        onClick={() => setRightTab('draft')}
                      >
                        <Sparkles className="w-3 h-3" /> Go to Draft tab
                      </Button>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Rejection Feedback Modal */}
        {showRejectFeedback && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-semibold">Reject & Improve</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Provide feedback on why this draft doesn't meet expectations. The AI will use your feedback to regenerate an improved version.
              </p>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">What needs improvement?</label>
                <Textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="e.g. Too informal, needs to be more concise, add bullet points for next steps, missing the disclaimer about FERPA…"
                  rows={4}
                  className="text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['Too informal', 'Too long', 'Missing disclaimer', 'Wrong tone', 'Needs bullet points', 'Too formal'].map(hint => (
                  <button
                    key={hint}
                    onClick={() => setRejectReason(prev => prev ? `${prev}, ${hint}` : hint)}
                    className="text-[10px] px-2 py-1 rounded-full bg-muted hover:bg-accent border border-border transition-colors"
                  >
                    + {hint}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex-1 gap-1.5"
                  size="sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
                  {regenerating ? 'Regenerating…' : 'Regenerate with Feedback'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={confirmReject}
                  className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <X className="w-3.5 h-3.5" /> Reject & Close
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRejectFeedback(false)}
                >
                  Cancel
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Human edits incorporated into learning — your corrections improve future drafts.
              </p>
            </div>
          </div>
        )}

        {/* Sticky Bottom Action Bar */}
        <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex items-center gap-2 flex-wrap">
          <Button onClick={() => handleDecision('approve_send')} disabled={!draftBody} className="gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Approve & Send
          </Button>
          <Button variant="outline" onClick={() => handleDecision('edit_send')} disabled={!draftBody} className="gap-1.5">
            <Edit3 className="w-4 h-4" /> Edit & Send
          </Button>
          <Button variant="outline" onClick={() => handleDecision('reject')}
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10">
            <X className="w-4 h-4" /> Reject
          </Button>
          {hasRoutingAlert && (
            <Button variant="outline" className="gap-1.5 border-[hsl(var(--warning))/40] text-[hsl(var(--warning-foreground))] hover:bg-[hsl(var(--warning-bg))]"
              onClick={() => {
                setAssignedTo(intelligenceReport!.layer3.suggestedDepartment || '');
                setNote(intelligenceReport!.layer3.routingNote || '');
                handleDecision('assign');
              }}>
              <ArrowRightCircle className="w-4 h-4" />
              Route to {intelligenceReport!.layer3.suggestedDepartment?.split('/')[0].trim()}
            </Button>
          )}
          <Button variant="ghost" onClick={() => handleDecision('assign')} className="gap-1.5 ml-auto">
            <Mail className="w-4 h-4" /> Create Draft in Gmail/Outlook
          </Button>
          <div className="text-xs text-muted-foreground border-l border-border pl-3">
            ⚠️ No emails sent without approval
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
