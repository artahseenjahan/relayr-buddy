export type SchoolCategory =
  | 'Public University'
  | 'Private University'
  | 'Community College'
  | 'K-12 School'
  | 'Online Institution';

export interface School {
  id: string;
  name: string;
  category: SchoolCategory;
  domain: string;
}

export interface Office {
  id: string;
  schoolId: string;
  name: string;
  description: string;
  primaryAudience: string;
}

export interface RequiredLink {
  label: string;
  url: string;
}

export interface OfficeRulebook {
  id: string;
  officeId: string;
  responsibilities: string[];
  hardConstraints: string[];
  softGuidelines: string[];
  requiredDisclaimers: string[];
  requiredLinks: RequiredLink[];
  escalationTriggers: string[];
}

export type AuthorityLevel = 1 | 2 | 3 | 4;
export type ToneDefault = 'warm-professional' | 'formal' | 'concise';

export interface Persona {
  id: string;
  officeId: string;
  roleTitle: string;
  authorityLevel: AuthorityLevel;
  toneDefault: ToneDefault;
  signatureBlock: string;
  communicationStructure: string;
  canDo: string[];
  cannotDo: string[];
  approvedPhrases: string[];
  safeLanguageTemplates: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  schoolId: string;
  officeId: string;
  personaId: string;
}

export type MailboxProvider = 'gmail' | 'outlook';
export type MailboxStatus = 'connected' | 'disconnected';

export interface MailboxConnection {
  id: string;
  userId: string;
  provider: MailboxProvider;
  status: MailboxStatus;
  lastSyncAt: string;
}

export type TicketStatus = 'needs_review' | 'approved' | 'rejected' | 'assigned' | 'sent';

export interface ThreadMessage {
  id: string;
  ticketId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sentAt: string;
}

export interface Ticket {
  id: string;
  officeId: string;
  personaId: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  receivedAt: string;
  status: TicketStatus;
  tags: string[];
  riskFlags: string[];
  threadMessages: ThreadMessage[];
}

export interface Draft {
  id: string;
  ticketId: string;
  version: number;
  body: string;
  sourcesUsed: string[];
  exampleEmailsUsed: string[];
  confidenceScore: number;
}

export type DecisionAction = 'approve_send' | 'edit_send' | 'reject' | 'assign';

export interface Decision {
  id: string;
  ticketId: string;
  action: DecisionAction;
  decidedByUserId: string;
  decidedAt: string;
  notes: string;
}
