import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { UserCircle, Plus, X, CheckCircle2, Sparkles, Mail, ShieldCheck, AlertCircle, RefreshCw, ChevronDown, ChevronUp, Building2 } from 'lucide-react';
import OnboardingLayout from '../components/OnboardingLayout';
import { ToneDefault } from '../types';
import { fetchSentEmails, GmailMessageMeta } from '../lib/gmailApi';
import { extractPersonaFromEmails, ExtractedPersonaProfile } from '../lib/personaExtractor';
import { offices, personas as allPersonas } from '../data/mockDb';

const ListField = ({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (items: string[]) => void; placeholder?: string }) => {
  const [input, setInput] = useState('');
  const add = () => {
    if (input.trim()) { onChange([...items, input.trim()]); setInput(''); }
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} placeholder={placeholder || 'Add…'}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())} />
        <Button type="button" variant="outline" size="icon" onClick={add}><Plus className="w-4 h-4" /></Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1">
          <span className="flex-1">{item}</span>
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default function SetupPersona() {
  const navigate = useNavigate();
  const { googleSession } = useApp();
  const { user } = useAuth();
  const [roleTitle, setRoleTitle] = useState('');
  const [authorityLevel, setAuthorityLevel] = useState('2');
  const [toneDefault, setToneDefault] = useState<ToneDefault>('warm-professional');
  const [signatureBlock, setSignatureBlock] = useState('');
  const [communicationStructure, setCommunicationStructure] = useState('greeting, acknowledgement, answer, next_steps, closing, signature');
  const [canDo, setCanDo] = useState<string[]>([]);
  const [cannotDo, setCannotDo] = useState<string[]>([]);
  const [approvedPhrases, setApprovedPhrases] = useState<string[]>([]);
  const [safeLanguageTemplates, setSafeLanguageTemplates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Gmail calibration state
  const [gmailStep, setGmailStep] = useState<'office_select' | 'idle' | 'loading' | 'selecting' | 'extracting' | 'preview'>('office_select');
  const [gmailOfficeId, setGmailOfficeId] = useState<string>('');
  const [gmailPersonaId, setGmailPersonaId] = useState<string>('');
  const [gmailCustomRole, setGmailCustomRole] = useState<string>('');
  const [gmailEmails, setGmailEmails] = useState<GmailMessageMeta[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [extractedProfile, setExtractedProfile] = useState<ExtractedPersonaProfile | null>(null);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [gmailExpanded, setGmailExpanded] = useState(false);

  const officePersonas = allPersonas.filter(p => p.officeId === gmailOfficeId);
  const gmailRoleLabel = allPersonas.find(p => p.id === gmailPersonaId)?.roleTitle || gmailCustomRole || '—';
  const canProceed = gmailOfficeId !== '' && (gmailPersonaId !== '' || gmailCustomRole.trim() !== '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save to database if user is authenticated
    if (user) {
      setSaving(true);
      try {
        const { error } = await supabase.from('personas').upsert({
          user_id: user.id,
          role_title: roleTitle,
          authority_level: parseInt(authorityLevel),
          tone_default: toneDefault,
          signature_block: signatureBlock,
          communication_structure: communicationStructure,
          can_do: canDo,
          cannot_do: cannotDo,
          approved_phrases: approvedPhrases,
          safe_language_templates: safeLanguageTemplates,
          office_id: gmailOfficeId || null,
          formality_score: extractedProfile?.formalityScore ?? null,
          warmth_score: extractedProfile?.warmthScore ?? null,
          conciseness_score: extractedProfile?.conciseScore ?? null,
        }, { onConflict: 'user_id' });
        
        if (error) throw error;
        toast.success('Persona saved successfully!');
      } catch (err: any) {
        toast.error('Failed to save persona: ' + (err.message || 'Unknown error'));
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    
    navigate('/inbox');
  };

  const loadGmailEmails = async () => {
    if (!googleSession) return;
    setGmailStep('loading');
    setGmailError(null);
    try {
      const emails = await fetchSentEmails(googleSession.accessToken, 50);
      setGmailEmails(emails);
      setGmailStep('selecting');
      // Auto-select first 10
      setSelectedIds(new Set(emails.slice(0, 10).map(e => e.id)));
    } catch (err: any) {
      setGmailError(err?.message || 'Failed to load emails. Please check your connection.');
      setGmailStep('idle');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 25) {
        next.add(id);
      }
      return next;
    });
  };

  const handleExtract = async () => {
    const selected = gmailEmails.filter(e => selectedIds.has(e.id));
    if (selected.length === 0) return;
    setGmailStep('extracting');
    await new Promise(r => setTimeout(r, 800)); // brief processing pause for UX
    const profile = extractPersonaFromEmails(selected);
    setExtractedProfile(profile);
    setGmailStep('preview');
  };

  const applyExtractedProfile = () => {
    if (!extractedProfile) return;
    setToneDefault(extractedProfile.toneDefault);
    setApprovedPhrases(prev => {
      const combined = [...new Set([...prev, ...extractedProfile.approvedPhrases])];
      return combined.slice(0, 12);
    });
    setSafeLanguageTemplates(prev => {
      const combined = [...new Set([...prev, ...extractedProfile.safeLanguageTemplates])];
      return combined.slice(0, 6);
    });
    setGmailExpanded(false);
    setGmailStep('idle');
  };

  const ScoreBar = ({ value, label }: { value: number; label: string }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{Math.round(value * 100)}%</span>
    </div>
  );

  return (
    <OnboardingLayout step={4} totalSteps={4} title="Define Persona">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-primary" />
            Persona Configuration
          </CardTitle>
          <CardDescription>Define the voice and authority of this office persona</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Gmail Calibration Panel ── */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
              <button
                type="button"
                onClick={() => setGmailExpanded(v => !v)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/10 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">Calibrate Persona from Gmail</div>
                  <div className="text-xs text-muted-foreground">Select your office &amp; role, then auto-extract tone from up to 30 sent emails (snippets only)</div>
                </div>
                {googleSession && (
                  <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">Connected</span>
                )}
                {gmailExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {gmailExpanded && (
                <div className="border-t border-primary/20 p-4 space-y-4">

                  {/* ── Office / role selector step ── */}
                  {gmailStep === 'office_select' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                        <p className="font-medium text-foreground flex items-center gap-1.5 mb-1">
                          <Building2 className="w-3.5 h-3.5 text-primary" />
                          Which office are you calibrating for?
                        </p>
                        <p>Relayr serves all administrative offices — select yours so the tone analysis reflects your specific communication context.</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Your Office</Label>
                        <Select value={gmailOfficeId} onValueChange={v => { setGmailOfficeId(v); setGmailPersonaId(''); }}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select office…" />
                          </SelectTrigger>
                          <SelectContent>
                            {offices.map(o => (
                              <SelectItem key={o.id} value={o.id}>
                                <div className="flex flex-col">
                                  <span>{o.name}</span>
                                  <span className="text-[10px] text-muted-foreground">{o.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {gmailOfficeId && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Your Role</Label>
                          {officePersonas.length > 0 ? (
                            <Select value={gmailPersonaId} onValueChange={setGmailPersonaId}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select role…" />
                              </SelectTrigger>
                              <SelectContent>
                                {officePersonas.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.roleTitle} <span className="text-muted-foreground text-[10px]">· Level {p.authorityLevel}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <input
                              value={gmailCustomRole}
                              onChange={e => setGmailCustomRole(e.target.value)}
                              placeholder="e.g. Front Office Coordinator"
                              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            />
                          )}
                        </div>
                      )}
                      <Button size="sm" className="w-full" disabled={!canProceed} onClick={() => setGmailStep('idle')}>
                        Continue to Email Selection →
                      </Button>
                    </div>
                  )}

                  {/* Breadcrumb for post-selection steps */}
                  {gmailStep !== 'office_select' && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <button type="button" onClick={() => setGmailStep('office_select')} className="text-primary hover:underline">Change role</button>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{offices.find(o => o.id === gmailOfficeId)?.name}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-medium text-foreground">{gmailRoleLabel}</span>
                    </div>
                  )}

                  {gmailStep !== 'office_select' && !googleSession && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertCircle className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5" />
                      <span>Connect your Gmail account in <a href="/settings" className="text-primary hover:underline">Settings → Google Account</a> to enable calibration.</span>
                    </div>
                  )}

                  {gmailStep !== 'office_select' && googleSession && (
                    <>
                      <div className="flex items-center gap-2 text-xs">
                        <Mail className="w-3.5 h-3.5 text-primary" />
                        <span className="text-muted-foreground">Connected as</span>
                        <span className="font-medium text-foreground">{googleSession.userEmail}</span>
                      </div>

                      {gmailError && (
                        <div className="flex items-start gap-2 p-2.5 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          {gmailError}
                        </div>
                      )}

                      {gmailStep === 'idle' && (
                        <Button type="button" size="sm" className="w-full gap-1.5" onClick={loadGmailEmails}>
                          <Mail className="w-3.5 h-3.5" /> Load My 30 Most Recent Sent Emails
                        </Button>
                      )}

                      {gmailStep === 'loading' && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Fetching sent emails (snippets only)…
                        </div>
                      )}

                      {gmailStep === 'extracting' && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                          Analysing patterns for <strong className="text-foreground">{gmailRoleLabel}</strong>…
                        </div>
                      )}

                      {gmailStep === 'selecting' && gmailEmails.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              Select up to 30 emails. <span className="font-medium text-foreground">{selectedIds.size}/30 selected</span>
                            </p>
                            <Button type="button" size="sm" disabled={selectedIds.size === 0} onClick={handleExtract} className="gap-1.5 text-xs h-7">
                              <Sparkles className="w-3 h-3" /> Extract Persona
                            </Button>
                          </div>
                          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                            {gmailEmails.map(email => (
                              <label key={email.id} className={`flex items-start gap-2.5 p-2 rounded cursor-pointer hover:bg-accent transition-colors ${selectedIds.has(email.id) ? 'bg-primary/10 border border-primary/20' : 'border border-transparent'}`}>
                                <Checkbox
                                  checked={selectedIds.has(email.id)}
                                  onCheckedChange={() => toggleSelect(email.id)}
                                  disabled={!selectedIds.has(email.id) && selectedIds.size >= 30}
                                  className="mt-0.5 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-medium truncate">{email.subject}</div>
                                  <div className="text-[10px] text-muted-foreground truncate">{email.snippet}</div>
                                </div>
                              </label>
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <ShieldCheck className="w-3 h-3 text-primary" />
                            Only snippets (~100 chars) are processed. Full email bodies are never read or stored.
                          </div>
                        </div>
                      )}

                      {gmailStep === 'preview' && extractedProfile && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-muted space-y-2">
                            <p className="text-xs font-semibold text-foreground">Extraction Results · {gmailRoleLabel}</p>
                            <p className="text-[10px] text-muted-foreground">{extractedProfile.styleSummary}</p>
                            <div className="space-y-1.5 pt-1">
                              <ScoreBar value={extractedProfile.formalityScore} label="Formality" />
                              <ScoreBar value={extractedProfile.warmthScore} label="Warmth" />
                              <ScoreBar value={extractedProfile.conciseScore} label="Conciseness" />
                            </div>
                          </div>
                          <div className="p-3 rounded-lg bg-muted space-y-1.5">
                            <p className="text-xs font-medium">Detected Style</p>
                            <div className="flex gap-2 flex-wrap text-[10px]">
                              <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">Tone: {extractedProfile.toneDefault.replace('-', ' ')}</span>
                              <span className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground">Opens: {extractedProfile.dominantSalutation}</span>
                              <span className="px-2 py-0.5 rounded-full bg-accent text-accent-foreground">Closes: {extractedProfile.dominantClosing}</span>
                            </div>
                          </div>
                          {extractedProfile.approvedPhrases.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium">Recurring Phrases</p>
                              {extractedProfile.approvedPhrases.slice(0, 4).map((p, i) => (
                                <div key={i} className="text-[10px] text-muted-foreground bg-muted rounded px-2 py-1 truncate">"{p}"</div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button type="button" size="sm" className="flex-1 gap-1.5" onClick={applyExtractedProfile}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Apply to Persona
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setGmailStep('selecting')} className="gap-1.5">
                              Re-select
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Manual Form Fields ── */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">1. Role</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Role Title</Label>
                  <Input value={roleTitle} onChange={e => setRoleTitle(e.target.value)} placeholder="e.g. Admissions Counselor" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Authority Level (1–4)</Label>
                  <Select value={authorityLevel} onValueChange={setAuthorityLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>Level {n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">2. Tone & Style</h3>
              <div className="space-y-1.5">
                <Label>Default Tone</Label>
                <Select value={toneDefault} onValueChange={v => setToneDefault(v as ToneDefault)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warm-professional">Warm-Professional</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="concise">Concise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Communication Structure</Label>
                <Input value={communicationStructure} onChange={e => setCommunicationStructure(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Signature Block</Label>
                <Textarea value={signatureBlock} onChange={e => setSignatureBlock(e.target.value)} rows={3}
                  placeholder="Your name, title, office, email…" />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">3. Authority & Boundaries</h3>
              <ListField label="Can Do" items={canDo} onChange={setCanDo} placeholder="e.g. Answer questions about deadlines" />
              <ListField label="Cannot Do" items={cannotDo} onChange={setCannotDo} placeholder="e.g. Guarantee admission" />
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">4. Approved Institutional Language</h3>
              <ListField label="Approved Phrases" items={approvedPhrases} onChange={setApprovedPhrases} />
              <ListField label="Safe Language Templates" items={safeLanguageTemplates} onChange={setSafeLanguageTemplates} />
            </div>

            <Button type="submit" className="w-full">
              <CheckCircle2 className="w-4 h-4" /> Complete Setup & Go to Inbox
            </Button>
          </form>
        </CardContent>
      </Card>
    </OnboardingLayout>
  );
}
