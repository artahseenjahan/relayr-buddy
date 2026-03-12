/**
 * Heuristic persona extractor — no external AI API.
 * Operates on Gmail snippets (short previews) only, never full email bodies.
 * Analyzes patterns across multiple sent emails to infer communication style.
 */

import { ToneDefault } from '../types';
import { GmailMessageMeta } from './gmailApi';

export interface ExtractedPersonaProfile {
  toneDefault: ToneDefault;
  approvedPhrases: string[];
  safeLanguageTemplates: string[];
  styleSummary: string;
  formalityScore: number;   // 0-1: 1 = very formal
  warmthScore: number;      // 0-1: 1 = very warm
  conciseScore: number;     // 0-1: 1 = very concise (short snippets)
  avgSnippetLength: number;
  dominantSalutation: string;
  dominantClosing: string;
}

// ─── Pattern Libraries ────────────────────────────────────────────────────────

const FORMAL_SIGNALS = [
  'dear ', 'i am writing', 'please be advised', 'kindly', 'pursuant to',
  'regarding', 'herewith', 'as per', 'please note', 'we wish to inform',
  'we would like to', 'sincerely', 'yours faithfully', 'yours truly',
  'with regards', 'on behalf of',
];
const WARM_SIGNALS = [
  'hi ', 'hello ', 'hope you', 'hope this', 'happy to', 'great to hear',
  'feel free', 'reach out', 'let me know', 'would love to', 'excited',
  'fantastic', 'wonderful', 'appreciate', 'looking forward',
];
const CONCISE_SIGNALS = [
  'please see', 'see below', 'as discussed', 'attached', 'please confirm',
  'noted', 'done', 'sure', 'will do', 'on it',
];

const SALUTATION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /^dear\s/i, label: 'Dear [Name],' },
  { pattern: /^hi\s/i, label: 'Hi [Name],' },
  { pattern: /^hello\s/i, label: 'Hello [Name],' },
  { pattern: /^good\s(morning|afternoon|evening)/i, label: 'Good [time], [Name],' },
];

const CLOSING_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /sincerely\b/i, label: 'Sincerely,' },
  { pattern: /best regards\b/i, label: 'Best regards,' },
  { pattern: /kind regards\b/i, label: 'Kind regards,' },
  { pattern: /best wishes\b/i, label: 'Best wishes,' },
  { pattern: /\bregards\b/i, label: 'Regards,' },
  { pattern: /thank you\b/i, label: 'Thank you,' },
  { pattern: /thanks\b/i, label: 'Thanks,' },
  { pattern: /warm regards\b/i, label: 'Warm regards,' },
];

// ─── Score Helpers ────────────────────────────────────────────────────────────

function signalScore(texts: string[], signals: string[]): number {
  if (texts.length === 0) return 0;
  let matches = 0;
  texts.forEach(t => {
    const lower = t.toLowerCase();
    signals.forEach(s => { if (lower.includes(s)) matches++; });
  });
  return Math.min(1, matches / (texts.length * 1.5));
}

function mostCommon<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  const freq = new Map<string, number>();
  items.forEach(item => {
    const key = String(item);
    freq.set(key, (freq.get(key) || 0) + 1);
  });
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0][0] as unknown as T;
}

function extractPhrasesFromSnippets(snippets: string[]): string[] {
  // Extract recurring multi-word phrases that look professional
  const PROFESSIONAL_PHRASE_PATTERNS = [
    /please (?:do not hesitate|feel free) to [\w ]+/gi,
    /(?:thank you|thanks) for [\w ]+/gi,
    /(?:i|we) (?:hope|trust) (?:this|that|you) [\w ]+/gi,
    /please (?:note|be advised) [\w ]+/gi,
    /(?:should you|if you) (?:have|need|require) [\w ]+/gi,
    /(?:looking forward|happy to|pleased to) [\w ]+/gi,
    /(?:as per|regarding|with respect to) [\w ]+/gi,
    /please (?:find|see|review) [\w ]+/gi,
    /(?:we|i) would like to [\w ]+/gi,
  ];
  const found = new Set<string>();
  snippets.forEach(snippet => {
    PROFESSIONAL_PHRASE_PATTERNS.forEach(re => {
      const matches = snippet.match(new RegExp(re.source, 'gi')) || [];
      matches.slice(0, 2).forEach(m => {
        const trimmed = m.trim().replace(/[,.!]$/, '');
        if (trimmed.length > 10 && trimmed.length < 80) found.add(trimmed);
      });
    });
  });
  return [...found].slice(0, 6);
}

function buildSafeTemplates(
  salutation: string,
  closing: string,
  toneDefault: ToneDefault
): string[] {
  const templates: Record<ToneDefault, string[]> = {
    'formal': [
      `${salutation}\n\nThank you for contacting our office. [RESPONSE]. Please do not hesitate to contact us if you require further assistance.\n\n${closing}`,
      `${salutation}\n\nWe have received your inquiry regarding [TOPIC]. [RESPONSE].\n\n${closing}`,
    ],
    'warm-professional': [
      `${salutation}\n\nThank you for reaching out! [RESPONSE]. Please feel free to contact us if you have any further questions.\n\n${closing}`,
      `${salutation}\n\nHope you're doing well. [RESPONSE]. Looking forward to assisting you further.\n\n${closing}`,
    ],
    'concise': [
      `${salutation}\n\n[RESPONSE].\n\nPlease let me know if you need anything else.\n\n${closing}`,
      `${salutation}\n\nThank you for your email. [RESPONSE].\n\n${closing}`,
    ],
  };
  return templates[toneDefault] || templates['warm-professional'];
}

// ─── Main Extractor ───────────────────────────────────────────────────────────

export function extractPersonaFromEmails(emails: GmailMessageMeta[]): ExtractedPersonaProfile {
  const snippets = emails.map(e => e.snippet).filter(Boolean);
  const subjects = emails.map(e => e.subject).filter(Boolean);
  const allText = [...snippets, ...subjects];

  // Score each dimension
  const formalityScore = signalScore(allText, FORMAL_SIGNALS);
  const warmthScore = signalScore(allText, WARM_SIGNALS);
  const avgSnippetLength = snippets.length > 0
    ? snippets.reduce((sum, s) => sum + s.length, 0) / snippets.length
    : 50;
  // Concise = short average length + concise signal words
  const conciseScore = Math.min(1, (signalScore(allText, CONCISE_SIGNALS) + (avgSnippetLength < 60 ? 0.5 : 0)) / 1.5);

  // Determine dominant tone
  const scores = { formal: formalityScore, warm: warmthScore, concise: conciseScore };
  const dominant = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const toneDefault: ToneDefault =
    dominant === 'formal' ? 'formal' :
    dominant === 'concise' ? 'concise' : 'warm-professional';

  // Detect dominant salutation
  const salutationCounts: string[] = [];
  allText.forEach(text => {
    SALUTATION_PATTERNS.forEach(({ pattern, label }) => {
      if (pattern.test(text)) salutationCounts.push(label);
    });
  });
  const dominantSalutation = mostCommon(salutationCounts) || 'Dear [Name],';

  // Detect dominant closing
  const closingCounts: string[] = [];
  allText.forEach(text => {
    CLOSING_PATTERNS.forEach(({ pattern, label }) => {
      if (pattern.test(text)) closingCounts.push(label);
    });
  });
  const dominantClosing = mostCommon(closingCounts) || 'Best regards,';

  // Extract recurring professional phrases
  const approvedPhrases = extractPhrasesFromSnippets(allText);
  if (approvedPhrases.length === 0) {
    const fallbacks: Record<ToneDefault, string[]> = {
      'formal': ['Please do not hesitate to contact us', 'We trust this information is helpful'],
      'warm-professional': ['Please feel free to reach out', 'Happy to help with any questions'],
      'concise': ['Let me know if you need anything', 'Please see the information below'],
    };
    approvedPhrases.push(...fallbacks[toneDefault]);
  }

  const safeLanguageTemplates = buildSafeTemplates(dominantSalutation, dominantClosing, toneDefault);

  // Build a human-readable style summary
  const formalPct = Math.round(formalityScore * 100);
  const warmPct = Math.round(warmthScore * 100);
  const styleSummary =
    `Analyzed ${emails.length} sent email${emails.length !== 1 ? 's' : ''}. ` +
    `Detected tone: ${toneDefault.replace('-', ' ')} ` +
    `(formality ${formalPct}%, warmth ${warmPct}%). ` +
    `Dominant salutation: "${dominantSalutation}" · Closing: "${dominantClosing}". ` +
    `${approvedPhrases.length} recurring professional phrase${approvedPhrases.length !== 1 ? 's' : ''} extracted.`;

  return {
    toneDefault,
    approvedPhrases,
    safeLanguageTemplates,
    styleSummary,
    formalityScore,
    warmthScore,
    conciseScore,
    avgSnippetLength,
    dominantSalutation,
    dominantClosing,
  };
}
