import { Ticket, Office, OfficeRulebook, Persona } from '../types';

// ─── Layer 1: Communication Style Analysis ────────────────────────────────────

export interface ToneAnalysis {
  dominantTone: string;
  formalityScore: number; // 0–100
  warmthScore: number;    // 0–100
  conciseness: number;    // 0–100
  recipientAdaptation: string;
  detectedStyle: string;
  styleSample: string;
}

export function analyzePersonaTone(persona: Persona, ticket: Ticket): ToneAnalysis {
  const toneMap: Record<string, { formality: number; warmth: number; conciseness: number; style: string }> = {
    'warm-professional': { formality: 68, warmth: 82, conciseness: 55, style: 'Empathetic & Supportive' },
    'formal':            { formality: 92, warmth: 38, conciseness: 60, style: 'Authoritative & Precise' },
    'concise':           { formality: 58, warmth: 52, conciseness: 91, style: 'Direct & Action-Oriented' },
  };
  const base = toneMap[persona.toneDefault] || toneMap['warm-professional'];

  // Detect recipient type from email/subject
  const subject = ticket.subject.toLowerCase();
  const email = ticket.fromEmail.toLowerCase();
  let recipientAdaptation = 'Student';
  if (email.includes('.edu') || subject.includes('faculty') || subject.includes('professor')) {
    recipientAdaptation = 'Faculty/Staff';
  } else if (subject.includes('parent') || subject.includes('family') || subject.includes('guardian')) {
    recipientAdaptation = 'Parent/Guardian';
  } else if (subject.includes('agency') || subject.includes('external') || subject.includes('partner')) {
    recipientAdaptation = 'External Agency';
  } else if (subject.includes('visa') || subject.includes('international') || subject.includes('toefl')) {
    recipientAdaptation = 'International Student';
  }

  const emailTypeAdjustment: Record<string, Partial<typeof base>> = {
    'inquiry': { warmth: base.warmth + 5 },
    'appeal': { formality: base.formality + 8, warmth: base.warmth - 5 },
    'visa': { formality: base.formality + 10, conciseness: base.conciseness + 10 },
    'document': { formality: base.formality + 6, conciseness: base.conciseness + 8 },
    'deadline': { conciseness: base.conciseness + 12 },
    'complaint': { formality: base.formality + 15, warmth: base.warmth - 10 },
  };

  const matchedType = Object.keys(emailTypeAdjustment).find(k => subject.includes(k)) || 'inquiry';
  const adjusted = { ...base, ...(emailTypeAdjustment[matchedType] || {}) };

  // Clamp to 0–100
  const clamp = (v: number) => Math.min(100, Math.max(0, v));

  const styleSample = persona.approvedPhrases[0] || persona.safeLanguageTemplates[0] || 'Standard institutional voice';

  return {
    dominantTone: persona.toneDefault,
    formalityScore: clamp(adjusted.formality),
    warmthScore: clamp(adjusted.warmth),
    conciseness: clamp(adjusted.conciseness),
    recipientAdaptation,
    detectedStyle: adjusted.style,
    styleSample,
  };
}

// ─── Layer 2: Policy & Rulebook Grounding ────────────────────────────────────

export interface PolicyGrounding {
  policiesApplied: string[];
  constraintsEnforced: string[];
  disclaimersTriggered: string[];
  linksInjected: { label: string; url: string }[];
  guidelinesFollowed: string[];
  complianceScore: number; // 0–100
}

export function analyzeRulebookGrounding(ticket: Ticket, rulebook: OfficeRulebook): PolicyGrounding {
  const text = `${ticket.subject} ${ticket.threadMessages.map(m => m.body).join(' ')}`.toLowerCase();

  const keywords = text.split(/\s+/).filter(w => w.length > 3);

  // Policies applied = responsibilities that keyword-match
  const policiesApplied = rulebook.responsibilities.filter(r =>
    keywords.some(k => r.toLowerCase().includes(k.substring(0, 6)))
  ).slice(0, 3);

  // Constraints enforced = always show all hard constraints (they're always in play)
  const constraintsEnforced = rulebook.hardConstraints.slice(0, 3);

  // Disclaimers triggered by keyword match
  const disclaimersTriggered = rulebook.requiredDisclaimers.filter(d =>
    keywords.some(k => d.toLowerCase().includes(k.substring(0, 5)))
  );

  // Links injected (first 2 always relevant)
  const linksInjected = rulebook.requiredLinks.slice(0, 2);

  // Guidelines followed
  const guidelinesFollowed = rulebook.softGuidelines.slice(0, 2);

  // Compliance score based on matched policies + constraints coverage
  const complianceScore = Math.min(100,
    70 + (policiesApplied.length * 5) + (disclaimersTriggered.length * 5)
  );

  return {
    policiesApplied: policiesApplied.length > 0 ? policiesApplied : [rulebook.responsibilities[0]],
    constraintsEnforced,
    disclaimersTriggered,
    linksInjected,
    guidelinesFollowed,
    complianceScore,
  };
}

// ─── Layer 3: Role Authority & Routing ───────────────────────────────────────

export type RoutingDecision = 'handle' | 'route' | 'escalate';

export interface AuthorityAnalysis {
  routingDecision: RoutingDecision;
  withinAuthority: boolean;
  authorityReason: string;
  suggestedDepartment?: string;
  routingNote?: string;
  reputationRisk: 'low' | 'medium' | 'high';
  reputationFactors: string[];
  outOfScopeReason?: string;
  escalationTriggerMatched: string[];
}

const CROSS_OFFICE_PATTERNS: { pattern: RegExp; department: string; reason: string }[] = [
  { pattern: /financial aid|fafsa|scholarship|loan|grant|tuition|fee waiver/i, department: 'Financial Aid', reason: 'Financial aid queries require Financial Aid office expertise' },
  { pattern: /transcript|enrollment verification|grade|registration|credit/i, department: 'Registrar', reason: 'Student records and enrollment queries are handled by the Registrar' },
  { pattern: /visa|i-20|f-1|opt|cpt|sevis|international student office/i, department: 'International Student Office', reason: 'Visa and immigration compliance must go through designated school officials' },
  { pattern: /password|account|email access|network|software|it support|vpn/i, department: 'IT Help Desk', reason: 'Technical support issues require IT intervention' },
  { pattern: /legal|lawsuit|attorney|discrimination|title ix|civil rights/i, department: 'Office of General Counsel', reason: 'Legal matters require consultation with university legal counsel' },
  { pattern: /disability|accommodation|ada|accessibility/i, department: 'Disability Services', reason: 'Accommodation requests must be processed through Disability Services' },
  { pattern: /housing|dormitory|roommate|residence hall/i, department: 'Residential Life', reason: 'Housing matters are managed by Residential Life & Housing' },
  { pattern: /academic advising|degree plan|major change|academic probation/i, department: 'Academic Affairs', reason: 'Academic planning queries require an Academic Advisor' },
];

export function analyzeRoleAuthority(
  ticket: Ticket,
  persona: Persona,
  rulebook: OfficeRulebook,
  currentOfficeId: string
): AuthorityAnalysis {
  const text = `${ticket.subject} ${ticket.threadMessages.map(m => m.body).join(' ')}`;

  // Check escalation triggers
  const escalationTriggerMatched = rulebook.escalationTriggers.filter(t =>
    text.toLowerCase().includes(t.toLowerCase())
  );

  // Check cross-office routing
  const crossOfficeMatch = CROSS_OFFICE_PATTERNS.find(p => p.pattern.test(text));
  const isWrongOffice = crossOfficeMatch && !new RegExp(
    currentOfficeId.replace('office-', ''), 'i'
  ).test(text);

  // Reputation risk assessment
  const reputationFactors: string[] = [];
  if (escalationTriggerMatched.length > 0) reputationFactors.push('Escalation trigger detected');
  if (/legal|lawsuit|attorney/i.test(text)) reputationFactors.push('Legal language present');
  if (/media|press|news|report/i.test(text)) reputationFactors.push('Potential media exposure risk');
  if (/complaint|dissatisfied|terrible|unacceptable/i.test(text)) reputationFactors.push('Expressed dissatisfaction');
  if (/promise|guarantee|you said|you told/i.test(text)) reputationFactors.push('References prior commitment');

  const reputationRisk: AuthorityAnalysis['reputationRisk'] =
    reputationFactors.length >= 3 ? 'high' :
    reputationFactors.length >= 1 ? 'medium' : 'low';

  // Routing decision
  let routingDecision: RoutingDecision = 'handle';
  let withinAuthority = true;
  let authorityReason = `Within ${persona.roleTitle} authority (Level ${persona.authorityLevel})`;
  let suggestedDepartment: string | undefined;
  let routingNote: string | undefined;
  let outOfScopeReason: string | undefined;

  if (escalationTriggerMatched.length > 0) {
    routingDecision = 'escalate';
    withinAuthority = false;
    authorityReason = 'Escalation trigger matched — senior review required';
    outOfScopeReason = `Trigger keywords: "${escalationTriggerMatched.slice(0, 2).join('", "')}"`;
    suggestedDepartment = 'Senior Administrator / Department Head';
    routingNote = `This inquiry contains sensitive language that exceeds standard ${persona.roleTitle} authority. Forwarding with context summary for senior review.`;
  } else if (isWrongOffice && crossOfficeMatch) {
    routingDecision = 'route';
    withinAuthority = false;
    authorityReason = crossOfficeMatch.reason;
    outOfScopeReason = `Query falls outside ${persona.roleTitle} scope`;
    suggestedDepartment = crossOfficeMatch.department;
    routingNote = `The student's inquiry contains topics best handled by ${crossOfficeMatch.department}. Routing with internal context note attached.`;
  }

  return {
    routingDecision,
    withinAuthority,
    authorityReason,
    suggestedDepartment,
    routingNote,
    reputationRisk,
    reputationFactors,
    outOfScopeReason,
    escalationTriggerMatched,
  };
}

// ─── Combined Intelligence Report ────────────────────────────────────────────

export interface IntelligenceReport {
  layer1: ToneAnalysis;
  layer2: PolicyGrounding;
  layer3: AuthorityAnalysis;
  generatedAt: string;
}

export function buildIntelligenceReport(
  ticket: Ticket,
  office: Office,
  rulebook: OfficeRulebook,
  persona: Persona
): IntelligenceReport {
  return {
    layer1: analyzePersonaTone(persona, ticket),
    layer2: analyzeRulebookGrounding(ticket, rulebook),
    layer3: analyzeRoleAuthority(ticket, persona, rulebook, office.id),
    generatedAt: new Date().toISOString(),
  };
}
