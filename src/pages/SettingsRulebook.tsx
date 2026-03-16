import { useState } from 'react';
import AppLayout from '../components/AppLayout';
import RulebookUpload from '../components/RulebookUpload';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Shield, User, ChevronDown, ChevronUp, Trash2,
  Sparkles, Mail, ShieldCheck, AlertCircle, RefreshCw,
  CheckCircle2, RotateCcw, Info, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type ParsedRulebookLayers } from '@/lib/rulebookParser';
import { fetchSentEmails, GmailMessageMeta } from '@/lib/gmailApi';
import { extractPersonaFromEmails, ExtractedPersonaProfile } from '@/lib/personaExtractor';
import { offices, personas } from '@/data/mockDb';

interface MergedEntry {
  fileName: string;
  layers: ParsedRulebookLayers;
  addedAt: string;
}

const LAYER_META = {
  1: { label: 'Layer 1 · Communication Style',  icon: <User className="w-3.5 h-3.5" />,     color: 'bg-[hsl(var(--status-sent-bg))] text-[hsl(var(--status-sent-fg))]' },
  2: { label: 'Layer 2 · Institutional Policy',  icon: <BookOpen className="w-3.5 h-3.5" />, color: 'bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-fg))]' },
  3: { label: 'Layer 3 · Role & Responsibility', icon: <Shield className="w-3.5 h-3.5" />,   color: 'bg-[hsl(var(--status-needs-review-bg))] text-[hsl(var(--status-needs-review-fg))]' },
} as const;

type LayerNum = 1 | 2 | 3;

const LAYER_KEYS: Record<LayerNum, (keyof ParsedRulebookLayers)[]> = {
  1: ['communicationTones', 'approvedPhrases', 'safeLanguageTemplates'],
  2: ['responsibilities', 'hardConstraints', 'softGuidelines', 'requiredDisclaimers'],
  3: ['canDo', 'cannotDo', 'escalationTriggers'],
};

const KEY_LABELS: Record<keyof ParsedRulebookLayers, string> = {
  communicationTones:    'Communication Tones',
  approvedPhrases:       'Approved Phrases',
  safeLanguageTemplates: 'Safe Language Templates',
  responsibilities:      'Responsibilities',
  hardConstraints:       'Hard Constraints',
  softGuidelines:        'Soft Guidelines',
  requiredDisclaimers:   'Required Disclaimers',
  canDo:                 'Can Do',
  cannotDo:              'Cannot Do',
  escalationTriggers:    'Escalation Triggers',
};

function mergeLayers(entries: MergedEntry[]): ParsedRulebookLayers {
  const merged: ParsedRulebookLayers = {
    communicationTones: [], approvedPhrases: [], safeLanguageTemplates: [],
    responsibilities: [], hardConstraints: [], softGuidelines: [], requiredDisclaimers: [],
    canDo: [], cannotDo: [], escalationTriggers: [],
  };
  const seen: Record<string, Set<string>> = {};
  for (const key of Object.keys(merged) as (keyof ParsedRulebookLayers)[]) seen[key] = new Set();

  for (const entry of entries) {
    for (const key of Object.keys(merged) as (keyof ParsedRulebookLayers)[]) {
      for (const item of entry.layers[key]) {
        if (!seen[key].has(item)) {
          (merged[key] as string[]).push(item);
          seen[key].add(item);
        }
      }
    }
  }
  return merged;
}

function MergedLayerPanel({ entries }: { entries: MergedEntry[] }) {
  const [open, setOpen] = useState<Record<LayerNum, boolean>>({ 1: true, 2: true, 3: true });
  const merged = mergeLayers(entries);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Merged Intelligence Layers
        </CardTitle>
        <CardDescription>All items extracted and deduplicated from uploaded files, organised by layer</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {([1, 2, 3] as LayerNum[]).map(layerNum => {
          const keys = LAYER_KEYS[layerNum];
          const count = keys.reduce((a, k) => a + merged[k].length, 0);
          const meta = LAYER_META[layerNum];
          return (
            <Collapsible key={layerNum} open={open[layerNum]} onOpenChange={v => setOpen(p => ({ ...p, [layerNum]: v }))}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{count} item{count !== 1 ? 's' : ''}</span>
                  </div>
                  {open[layerNum] ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-3 px-1">
                  {keys.map(key => {
                    const items = merged[key];
                    return (
                      <div key={key}>
                        <h5 className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-1 pl-1">{KEY_LABELS[key]}</h5>
                        {items.length === 0
                          ? <p className="text-xs text-muted-foreground italic pl-1">No items extracted</p>
                          : (
                            <ul className="space-y-1">
                              {items.map((item, i) => (
                                <li key={i} className={`text-xs px-2 py-1 rounded-md ${meta.color}`}>{item}</li>
                              ))}
                            </ul>
                          )
                        }
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────
const ScoreBar = ({ value, label }: { value: number; label: string }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
    <div className="flex-1">
      <Progress value={Math.round(value * 100)} className="h-1.5" />
    </div>
    <span className="text-xs font-semibold w-8 text-right text-foreground">{Math.round(value * 100)}%</span>
  </div>
);

// ─── Gmail Tone Demo Panel ────────────────────────────────────────────────────
type GmailStep = 'idle' | 'loading' | 'selecting' | 'extracting' | 'preview';

function GmailToneDemoPanel() {
  const { googleSession, connectGoogle } = useApp();
  const navigate = useNavigate();

  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState<GmailStep>('idle');
  const [emails, setEmails] = useState<GmailMessageMeta[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<ExtractedPersonaProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const MAX = 30;

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await connectGoogle();
    } catch (err: any) {
      setError(err?.message || 'Could not connect Google account.');
    } finally {
      setConnecting(false);
    }
  };

  const loadEmails = async () => {
    if (!googleSession) return;
    setStep('loading');
    setError(null);
    try {
      const fetched = await fetchSentEmails(googleSession.accessToken, MAX);
      setEmails(fetched);
      // auto-select first 10
      setSelected(new Set(fetched.slice(0, 10).map(e => e.id)));
      setStep('selecting');
    } catch (err: any) {
      setError(err?.message || 'Failed to load emails. Check your connection.');
      setStep('idle');
    }
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < MAX) { next.add(id); }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(emails.slice(0, MAX).map(e => e.id)));
  const clearAll = () => setSelected(new Set());

  const handleExtract = async () => {
    const chosen = emails.filter(e => selected.has(e.id));
    if (chosen.length === 0) return;
    setStep('extracting');
    await new Promise(r => setTimeout(r, 1000));
    setProfile(extractPersonaFromEmails(chosen));
    setStep('preview');
  };

  const reset = () => {
    setStep('idle');
    setEmails([]);
    setSelected(new Set());
    setProfile(null);
    setError(null);
  };

  return (
    <Card className="border-primary/25 overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-primary/5 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            Staff Persona · Tone Demo
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">Layer 1</Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Select up to 30 sent emails — AI analyses tone & style patterns (snippets only, for demo purposes)
          </div>
        </div>
        {googleSession && (
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium shrink-0">
            Gmail connected
          </span>
        )}
        {expanded
          ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        }
      </button>

      {expanded && (
        <div className="border-t border-primary/20">
          {/* Privacy notice */}
          <div className="flex items-start gap-2 px-4 py-2.5 bg-muted/60 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-primary mt-0.5" />
            <span>
              <strong className="text-foreground">Privacy:</strong> Only ~100-char snippets + subject lines are processed — never full bodies. Nothing is persisted. This is for tone-demo purposes only and does not send any email.
            </span>
          </div>

          <div className="p-4 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* ── Not connected ── */}
            {!googleSession && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">How it works</p>
                  <p>1. Connect your Google account (read-only, no send access).</p>
                  <p>2. Your 30 most recent sent emails are loaded — subject + snippet only.</p>
                  <p>3. Choose which emails to include in the analysis.</p>
                  <p>4. The system extracts tone, salutation patterns, and recurring phrases.</p>
                </div>
                <Button
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  {connecting
                    ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Connecting…</>
                    : <><Mail className="w-3.5 h-3.5" /> Connect Gmail to Start</>
                  }
                </Button>
              </div>
            )}

            {/* ── Connected, idle ── */}
            {googleSession && step === 'idle' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted">
                  {googleSession.userPicture
                    ? <img src={googleSession.userPicture} alt="" className="w-7 h-7 rounded-full border border-border" />
                    : <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">{googleSession.userName?.[0] || 'G'}</div>
                  }
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground">{googleSession.userName}</div>
                    <div className="text-[10px] text-muted-foreground">{googleSession.userEmail}</div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-approved))] ml-auto shrink-0" />
                </div>
                <Button size="sm" className="w-full gap-2" onClick={loadEmails}>
                  <Mail className="w-3.5 h-3.5" /> Load My 30 Most Recent Sent Emails
                </Button>
              </div>
            )}

            {/* ── Loading ── */}
            {step === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Fetching your sent emails…</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Loading subject lines and snippets only</p>
                </div>
              </div>
            )}

            {/* ── Selecting ── */}
            {step === 'selecting' && emails.length > 0 && (
              <div className="space-y-3">
                {/* Selection controls */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{selected.size}/{MAX} selected</span>
                    <div className="h-1 w-24 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(selected.size / MAX) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>
                      Clear all
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={selectAll}>
                      Select 30
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      disabled={selected.size === 0}
                      onClick={handleExtract}
                    >
                      <Sparkles className="w-3 h-3" />
                      Analyse {selected.size > 0 ? `(${selected.size})` : ''}
                    </Button>
                  </div>
                </div>

                {/* Email list */}
                <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {emails.map((email, idx) => {
                    const isSelected = selected.has(email.id);
                    const isDisabled = !isSelected && selected.size >= MAX;
                    return (
                      <label
                        key={email.id}
                        className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors select-none
                          ${isSelected ? 'bg-primary/8' : 'hover:bg-muted/60'}
                          ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}
                        `}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => !isDisabled && toggle(email.id)}
                          disabled={isDisabled}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground/60 w-5 shrink-0">#{idx + 1}</span>
                            <span className="text-xs font-medium text-foreground truncate">{email.subject}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 pl-7">{email.snippet}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Info className="w-3 h-3 text-muted-foreground/60" />
                  {emails.length} emails loaded · snippets are ~100 chars · no full bodies processed
                </div>
              </div>
            )}

            {/* ── Extracting ── */}
            {step === 'extracting' && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Analysing communication patterns…</p>
                  <p className="text-xs text-muted-foreground mt-1">Extracting tone, salutation style, and recurring phrases</p>
                </div>
              </div>
            )}

            {/* ── Preview ── */}
            {step === 'preview' && profile && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="p-3 rounded-lg bg-muted space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-approved))] shrink-0" />
                    <p className="text-xs font-semibold text-foreground">Tone Analysis Complete</p>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {selected.size} email{selected.size !== 1 ? 's' : ''} analysed
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{profile.styleSummary}</p>
                </div>

                {/* Score bars */}
                <div className="p-3 rounded-lg border border-border space-y-2.5">
                  <p className="text-xs font-semibold text-foreground mb-1">Communication Scores</p>
                  <ScoreBar value={profile.formalityScore} label="Formality" />
                  <ScoreBar value={profile.warmthScore}    label="Warmth" />
                  <ScoreBar value={profile.conciseScore}   label="Conciseness" />
                </div>

                {/* Detected style chips */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Detected Style</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                      <Sparkles className="w-3 h-3" />
                      Tone: {profile.toneDefault.replace('-', ' ')}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                      <Mail className="w-3 h-3" />
                      Opens: {profile.dominantSalutation}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                      <Mail className="w-3 h-3" />
                      Closes: {profile.dominantClosing}
                    </span>
                  </div>
                </div>

                {/* Recurring phrases */}
                {profile.approvedPhrases.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground">Recurring Professional Phrases</p>
                    <div className="grid grid-cols-1 gap-1">
                      {profile.approvedPhrases.map((phrase, i) => (
                        <div key={i} className="flex items-start gap-2 text-[11px] bg-muted rounded-md px-3 py-1.5">
                          <span className="text-primary font-bold shrink-0">"</span>
                          <span className="text-foreground">{phrase}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Safe templates preview */}
                {profile.safeLanguageTemplates.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between text-xs font-semibold text-foreground px-1 py-1 hover:text-primary transition-colors">
                        <span>Safe Language Templates ({profile.safeLanguageTemplates.length})</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 mt-2">
                        {profile.safeLanguageTemplates.map((t, i) => (
                          <pre key={i} className="text-[10px] text-muted-foreground bg-muted rounded-md p-2.5 whitespace-pre-wrap font-sans leading-relaxed">
                            {t}
                          </pre>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <Separator />

                {/* Demo notice */}
                <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                  <span>
                    This is a <strong className="text-foreground">tone demo</strong> — results are displayed for review only and not automatically applied to your persona. To apply these patterns, go to the <a href="/setup-persona" className="text-primary hover:underline">Persona Setup</a> page.
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setStep('selecting')}
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Re-select
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={reset}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SettingsRulebook() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<MergedEntry[]>([]);

  const handleLayersExtracted = (layers: ParsedRulebookLayers, fileName: string) => {
    setEntries(prev => [
      ...prev,
      { fileName, layers, addedAt: new Date().toISOString() },
    ]);
  };

  const removeEntry = (fileName: string) => {
    setEntries(prev => prev.filter(e => e.fileName !== fileName));
  };

  const totalItems = entries.reduce((acc, e) =>
    acc + Object.values(e.layers).reduce((a, v) => a + v.length, 0), 0
  );

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Rulebook & Responsibility Layers
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload institutional policy documents. The AI will parse and map content across all three intelligence layers automatically.
            </p>
          </div>
        </div>

        {/* ── Gmail Tone Demo (Layer 1) ── */}
        <GmailToneDemoPanel />

        {/* Upload card */}
        <RulebookUpload onLayersExtracted={handleLayersExtracted} />

        {/* Uploaded file list with remove */}
        {entries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Parsed Documents
                  <Badge variant="outline" className="text-xs">{entries.length}</Badge>
                </span>
                {totalItems > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">{totalItems} total items extracted</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {entries.map(e => (
                <div key={e.fileName} className="flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-lg bg-muted">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate font-medium">{e.fileName}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {Object.values(e.layers).reduce((a, v) => a + v.length, 0)} items
                    </span>
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeEntry(e.fileName)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Merged layer view */}
        {entries.length > 0 && <MergedLayerPanel entries={entries} />}

        {/* Empty state */}
        {entries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No documents uploaded yet</p>
            <p className="text-xs mt-1">Upload a rulebook or policy document above to get started</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
