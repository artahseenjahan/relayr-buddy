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

/** Google OAuth session — access token + basic profile only. No email bodies stored. */
export interface GoogleOAuthSession {
  accessToken: string;
  expiresAt: number; // Unix ms
  userEmail: string;
  userName: string;
  userPicture?: string;
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

export interface RoutingRule {
  id: string;
  keywords: string[];
  targetDepartment: string;
  reason: string;
}

export type CalendarProvider = 'google' | 'outlook';
export type CalendarConnectionStatus = 'connected' | 'disconnected';

export interface CalendarConnection {
  id: string;
  userId: string;
  provider: CalendarProvider;
  status: CalendarConnectionStatus;
  connectedAt: string;
  userEmail: string;
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

export interface EmployeeProfileApi {
  id: string;
  account_id: string;
  user_id: string;
  title: string;
  department: string;
  office_name: string;
  responsibilities_summary: string;
  role_guidelines_summary: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PersonaProfileApi {
  id: string;
  name: string;
  tone_summary: string | null;
  style_summary: string | null;
  greeting_patterns: string[];
  signoff_patterns: string[];
  length_preference: string | null;
  formatting_preferences: Record<string, unknown>;
  preferred_phrases: string[];
  do_not_use_phrases: string[];
  source_email_count: number;
  status: string;
  last_built_at?: string | null;
}

export interface DraftResponseApi {
  id: string;
  account_id: string;
  user_id: string;
  gmail_connection_id: string;
  source_gmail_message_id: string;
  source_gmail_thread_id?: string | null;
  recipient_email: string;
  subject: string;
  draft_body: string;
  status: string;
  generation_context: Record<string, unknown>;
  persona_profile_id?: string | null;
  employee_profile_id?: string | null;
  approved_at?: string | null;
  sent_at?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
