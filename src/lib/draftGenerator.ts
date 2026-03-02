import { Ticket, Office, OfficeRulebook, Persona, Draft } from '../types';

const toneGreetings: Record<string, string> = {
  'warm-professional': 'Thank you for reaching out to us.',
  'formal': 'We have received your inquiry and are pleased to assist you.',
  'concise': 'Thank you for contacting us.',
};

const toneClosings: Record<string, string> = {
  'warm-professional': 'We appreciate your interest and look forward to assisting you. Please don\'t hesitate to reach out if you have any additional questions.',
  'formal': 'We trust this information addresses your inquiry. Should you require further assistance, please do not hesitate to contact our office.',
  'concise': 'Let us know if you need anything else.',
};

function extractSubjectKeywords(subject: string): string[] {
  return subject.toLowerCase().split(/\s+/).filter(w => w.length > 3);
}

function checkEscalationTriggers(ticket: Ticket, rulebook: OfficeRulebook): string[] {
  const text = `${ticket.subject} ${ticket.threadMessages.map(m => m.body).join(' ')}`.toLowerCase();
  return rulebook.escalationTriggers.filter(trigger => text.includes(trigger.toLowerCase()));
}

function buildAcknowledgement(ticket: Ticket, persona: Persona): string {
  const phrases = persona.approvedPhrases;
  const base = phrases.length > 0 ? phrases[0] : 'Thank you for your message';
  return `${base}. We understand you have a question regarding: \"${ticket.subject}\".`;
}

function buildAnswer(ticket: Ticket, office: Office, rulebook: OfficeRulebook, persona: Persona): string {
  const keywords = extractSubjectKeywords(ticket.subject);
  const templates = persona.safeLanguageTemplates;
  const template = templates.length > 0 ? templates[0] : 'I would be happy to assist you with your inquiry.';

  // Build a contextual answer based on office responsibilities
  const relevantResponsibility = rulebook.responsibilities.find(r =>
    keywords.some(k => r.toLowerCase().includes(k))
  ) || rulebook.responsibilities[0];

  return `${template}\n\nRegarding your inquiry, our office is responsible for: ${relevantResponsibility}. We have reviewed your message and are prepared to assist you with the necessary steps.`;
}

function buildNextSteps(rulebook: OfficeRulebook): string {
  const links = rulebook.requiredLinks;
  if (links.length === 0) return 'Please contact our office if you have additional questions.';

  const linkList = links.slice(0, 2).map(l => `• ${l.label}: ${l.url}`).join('\n');
  return `To proceed, please review the following resources:\n${linkList}`;
}

function buildDisclaimers(ticket: Ticket, rulebook: OfficeRulebook): string {
  const keywords = extractSubjectKeywords(ticket.subject);
  const relevant = rulebook.requiredDisclaimers.filter(d =>
    keywords.some(k => d.toLowerCase().includes(k.substring(0, 5)))
  );
  const toUse = relevant.length > 0 ? relevant : [rulebook.requiredDisclaimers[0]].filter(Boolean);
  if (toUse.length === 0) return '';
  return '\n\nPlease note: ' + toUse.join(' ');
}

export function generateDraft(
  ticket: Ticket,
  office: Office,
  rulebook: OfficeRulebook,
  persona: Persona
): Draft {
  const triggersMatched = checkEscalationTriggers(ticket, rulebook);
  const hasEscalation = triggersMatched.length > 0;

  const greeting = `Dear ${ticket.fromName.split(' ')[0]},\n\n${toneGreetings[persona.toneDefault] || toneGreetings['warm-professional']}`;
  const acknowledgement = buildAcknowledgement(ticket, persona);
  const answer = buildAnswer(ticket, office, rulebook, persona);
  const nextSteps = buildNextSteps(rulebook);
  const disclaimers = buildDisclaimers(ticket, rulebook);
  const escalationNote = hasEscalation
    ? '\n\nIMPORTANT: This matter has been flagged for additional review due to its complexity. A senior staff member will follow up with you.'
    : '';
  const closing = toneClosings[persona.toneDefault] || toneClosings['warm-professional'];

  const body = [
    greeting,
    acknowledgement,
    answer,
    nextSteps,
    disclaimers,
    escalationNote,
    closing,
    persona.signatureBlock,
  ].filter(Boolean).join('\n\n');

  const confidenceScore = hasEscalation
    ? Math.round((0.55 + Math.random() * 0.2) * 100) / 100
    : Math.round((0.72 + Math.random() * 0.25) * 100) / 100;

  const sourcesUsed = [
    `${office.name} Office Rulebook v2.1`,
    `${persona.roleTitle} Communication Guidelines`,
    `Westbrook State University Policy Manual`,
  ];

  const exampleEmailsUsed = [
    `Similar ${office.name} inquiry from archive (Q3 2024)`,
    `Standard ${persona.toneDefault} response template`,
  ];

  // Update ticket risk flags if escalation detected
  if (hasEscalation && !ticket.riskFlags.includes('Needs Human Attention')) {
    ticket.riskFlags.push('Needs Human Attention');
  }

  return {
    id: `draft-${ticket.id}-${Date.now()}`,
    ticketId: ticket.id,
    version: 1,
    body,
    sourcesUsed,
    exampleEmailsUsed,
    confidenceScore,
  };
}

// ─── Tone Modifiers ───────────────────────────────────────────────────────────

export function shortenDraft(body: string): string {
  const paragraphs = body.split('\n\n').filter(Boolean);
  // Keep greeting, first substantive paragraph, next steps, and signature
  const keep = [
    paragraphs[0],
    paragraphs[2] || paragraphs[1],
    paragraphs[paragraphs.length - 2],
    paragraphs[paragraphs.length - 1],
  ].filter(Boolean);
  return keep.join('\n\n');
}

export function makeMoreFormal(body: string): string {
  return body
    .replace(/Hi /g, 'Dear ')
    .replace(/\bThanks\b/g, 'Thank you')
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bdon't\b/g, 'do not')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bisn't\b/g, 'is not')
    .replace(/\baren't\b/g, 'are not')
    .replace(/\bwe're\b/g, 'we are')
    .replace(/\byou're\b/g, 'you are')
    .replace(/\bI'm\b/g, 'I am')
    .replace(/Let us know/g, 'Please do not hesitate to contact us');
}

export function makeMoreWarm(body: string): string {
  return body
    .replace(/Dear /g, 'Hi ')
    .replace(/We have received your inquiry/g, 'Thanks so much for reaching out!')
    .replace(/Please do not hesitate to contact/g, 'Feel free to reach out to')
    .replace(/We trust this information addresses/g, 'We hope this helps with')
    .replace(/Should you require further assistance/g, 'If you have any more questions');
}

export function addBulletList(body: string): string {
  const paragraphs = body.split('\n\n');
  const answerIdx = 2;
  if (paragraphs[answerIdx]) {
    const sentences = paragraphs[answerIdx].split('. ').filter(s => s.length > 10);
    if (sentences.length > 1) {
      paragraphs[answerIdx] = 'Here are the key points to note:\n' +
        sentences.map(s => `• ${s.trim().replace(/\.$/, '')}.`).join('\n');
    }
  }
  return paragraphs.join('\n\n');
}
