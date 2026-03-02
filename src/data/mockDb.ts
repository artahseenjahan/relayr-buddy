import {
  School, Office, OfficeRulebook, Persona, User,
  MailboxConnection, Ticket, ThreadMessage, Draft, Decision
} from '../types';

// ─── School ──────────────────────────────────────────────────────────────────

export const schools: School[] = [
  {
    id: 'school-1',
    name: 'Westbrook State University',
    category: 'Public University',
    domain: 'westbrook.edu',
  },
];

// ─── Offices ─────────────────────────────────────────────────────────────────

export const offices: Office[] = [
  {
    id: 'office-admissions',
    schoolId: 'school-1',
    name: 'Admissions',
    description: 'Manages undergraduate and graduate admissions processes.',
    primaryAudience: 'Prospective students and applicants',
  },
  {
    id: 'office-registrar',
    schoolId: 'school-1',
    name: 'Registrar',
    description: 'Handles student records, transcripts, and enrollment verification.',
    primaryAudience: 'Current and former students',
  },
  {
    id: 'office-finaid',
    schoolId: 'school-1',
    name: 'Financial Aid',
    description: 'Administers scholarships, grants, loans, and work-study programs.',
    primaryAudience: 'Students seeking financial assistance',
  },
  {
    id: 'office-it',
    schoolId: 'school-1',
    name: 'IT Help Desk',
    description: 'Provides technical support for students, faculty, and staff.',
    primaryAudience: 'Students, faculty, and staff',
  },
];

// ─── Rulebooks ────────────────────────────────────────────────────────────────

export const rulebooks: OfficeRulebook[] = [
  {
    id: 'rb-admissions',
    officeId: 'office-admissions',
    responsibilities: [
      'Respond to inquiries about application requirements',
      'Guide applicants through the admission process',
      'Provide information about deadlines and program availability',
      'Share information about campus visits and open houses',
    ],
    hardConstraints: [
      'Never guarantee admission to any applicant',
      'Never disclose specific applicant scores or rankings',
      'Never provide information about other applicants',
      'Never make promises about scholarship amounts',
    ],
    softGuidelines: [
      'Be encouraging and welcoming to prospective students',
      'Highlight campus resources and student life',
      'Direct complex financial aid questions to the Financial Aid office',
    ],
    requiredDisclaimers: [
      'Admission decisions are made by the Admissions Committee and are final.',
      'Application materials must be submitted by the posted deadline to be considered.',
    ],
    requiredLinks: [
      { label: 'Apply Now', url: 'https://apply.westbrook.edu' },
      { label: 'Application Deadlines', url: 'https://admissions.westbrook.edu/deadlines' },
      { label: 'Visit Campus', url: 'https://admissions.westbrook.edu/visit' },
    ],
    escalationTriggers: [
      'appeal', 'discrimination', 'disability accommodation', 'legal',
      'lawsuit', 'complaint', 'waiver', 'override', 'special consideration',
    ],
  },
  {
    id: 'rb-registrar',
    officeId: 'office-registrar',
    responsibilities: [
      'Process transcript requests',
      'Verify enrollment status',
      'Assist with course registration issues',
      'Handle name and address changes',
      'Issue enrollment verification letters',
    ],
    hardConstraints: [
      'Never share student records with unauthorized parties (FERPA)',
      'Never alter grades without proper faculty authorization',
      'Never process requests without proper student ID verification',
    ],
    softGuidelines: [
      'Remind students of processing time for official transcripts (3-5 business days)',
      'Direct grade disputes to the academic department first',
    ],
    requiredDisclaimers: [
      'Student records are protected under FERPA. We are unable to release records to third parties without written student consent.',
      'Official transcript processing takes 3-5 business days.',
    ],
    requiredLinks: [
      { label: 'Request a Transcript', url: 'https://registrar.westbrook.edu/transcripts' },
      { label: 'FERPA Information', url: 'https://registrar.westbrook.edu/ferpa' },
      { label: 'Registration Portal', url: 'https://my.westbrook.edu/registration' },
    ],
    escalationTriggers: [
      'grade change', 'expunge', 'legal hold', 'subpoena', 'FERPA violation',
      'identity theft', 'fraud', 'unauthorized access',
    ],
  },
  {
    id: 'rb-finaid',
    officeId: 'office-finaid',
    responsibilities: [
      'Explain financial aid eligibility requirements',
      'Guide students through FAFSA completion',
      'Process scholarship and grant applications',
      'Explain loan options and repayment',
      'Handle Satisfactory Academic Progress (SAP) questions',
    ],
    hardConstraints: [
      'Never guarantee specific aid amounts before official packaging',
      'Never advise students to falsify FAFSA information',
      'Never share another student\'s financial aid information',
      'Never promise aid renewal without reviewing academic standing',
    ],
    softGuidelines: [
      'Always mention the priority FAFSA deadline',
      'Encourage students to explore scholarship opportunities',
      'Be sensitive when discussing financial hardship situations',
    ],
    requiredDisclaimers: [
      'Financial aid awards are subject to change based on enrollment status and available funding.',
      'Federal aid requires maintaining Satisfactory Academic Progress (SAP).',
    ],
    requiredLinks: [
      { label: 'FAFSA', url: 'https://studentaid.gov/h/apply-for-aid/fafsa' },
      { label: 'Financial Aid Portal', url: 'https://finaid.westbrook.edu' },
      { label: 'Scholarship Search', url: 'https://finaid.westbrook.edu/scholarships' },
    ],
    escalationTriggers: [
      'fraud', 'overpayment', 'appeal', 'SAP appeal', 'professional judgment',
      'verification flag', 'identity fraud', 'divorce', 'dependency override',
    ],
  },
  {
    id: 'rb-it',
    officeId: 'office-it',
    responsibilities: [
      'Assist with password resets and account lockouts',
      'Troubleshoot network connectivity issues',
      'Support university-licensed software installation',
      'Handle email and calendar access issues',
      'Assist with learning management system (LMS) access',
    ],
    hardConstraints: [
      'Never share another user\'s credentials',
      'Never bypass multi-factor authentication requirements',
      'Never install unlicensed software on university devices',
      'Never access user files without proper authorization',
    ],
    softGuidelines: [
      'Always verify user identity before account changes',
      'Provide step-by-step instructions when possible',
      'Escalate persistent hardware issues to on-site support',
    ],
    requiredDisclaimers: [
      'For security reasons, we cannot reset passwords via email. Please visit the IT Help Desk in person or use the self-service portal.',
      'University systems are for authorized use only.',
    ],
    requiredLinks: [
      { label: 'IT Self-Service Portal', url: 'https://it.westbrook.edu/selfservice' },
      { label: 'System Status', url: 'https://status.westbrook.edu' },
      { label: 'Software Downloads', url: 'https://it.westbrook.edu/software' },
    ],
    escalationTriggers: [
      'hacked', 'breach', 'ransomware', 'phishing', 'unauthorized access',
      'data loss', 'HIPAA', 'PII exposed', 'security incident',
    ],
  },
];

// ─── Personas ─────────────────────────────────────────────────────────────────

export const personas: Persona[] = [
  {
    id: 'persona-admissions-counselor',
    officeId: 'office-admissions',
    roleTitle: 'Admissions Counselor',
    authorityLevel: 2,
    toneDefault: 'warm-professional',
    signatureBlock: 'Best regards,\nAdmissions Counselor\nOffice of Admissions\nWestbrook State University\nadmissions@westbrook.edu | (555) 100-2000',
    communicationStructure: 'greeting, acknowledgement, answer, next_steps, closing, signature',
    canDo: [
      'Answer questions about application requirements',
      'Explain program offerings',
      'Schedule campus visits',
      'Provide general admission timeline information',
    ],
    cannotDo: [
      'Guarantee admission',
      'Reveal committee decisions early',
      'Negotiate merit scholarship amounts',
    ],
    approvedPhrases: [
      'Thank you for your interest in Westbrook State University',
      'We look forward to reviewing your application',
      'Our admissions team is here to help',
      'We encourage you to apply before the deadline',
    ],
    safeLanguageTemplates: [
      'I would be happy to assist you with your inquiry.',
      'Please don\'t hesitate to reach out if you have additional questions.',
      'We appreciate your interest in our programs.',
    ],
  },
  {
    id: 'persona-registrar-specialist',
    officeId: 'office-registrar',
    roleTitle: 'Registrar Specialist',
    authorityLevel: 2,
    toneDefault: 'formal',
    signatureBlock: 'Sincerely,\nRegistrar Specialist\nOffice of the Registrar\nWestbrook State University\nregistrar@westbrook.edu | (555) 100-3000',
    communicationStructure: 'greeting, acknowledgement, answer, next_steps, closing, signature',
    canDo: [
      'Process transcript requests',
      'Verify enrollment status',
      'Update student contact information',
      'Issue enrollment verification letters',
    ],
    cannotDo: [
      'Change grades without faculty authorization',
      'Release records to unauthorized parties',
      'Override holds without proper approval',
    ],
    approvedPhrases: [
      'Thank you for contacting the Office of the Registrar',
      'We are pleased to assist you with your records request',
      'Please allow the standard processing time for this request',
    ],
    safeLanguageTemplates: [
      'Your request has been received and will be processed in accordance with our standard procedures.',
      'Please be advised that student records are protected under FERPA.',
    ],
  },
  {
    id: 'persona-finaid-advisor',
    officeId: 'office-finaid',
    roleTitle: 'Financial Aid Advisor',
    authorityLevel: 2,
    toneDefault: 'warm-professional',
    signatureBlock: 'Warm regards,\nFinancial Aid Advisor\nOffice of Financial Aid\nWestbrook State University\nfinancialaid@westbrook.edu | (555) 100-4000',
    communicationStructure: 'greeting, acknowledgement, answer, next_steps, closing, signature',
    canDo: [
      'Explain aid eligibility requirements',
      'Guide FAFSA completion',
      'Explain loan options',
      'Review financial aid packages',
    ],
    cannotDo: [
      'Guarantee specific aid amounts',
      'Override SAP determinations without appeal',
      'Advise falsifying financial documents',
    ],
    approvedPhrases: [
      'Thank you for reaching out to the Office of Financial Aid',
      'We understand that navigating financial aid can be complex',
      'We are committed to helping you access all available funding',
    ],
    safeLanguageTemplates: [
      'I want to ensure you have all the information needed to make the best decision for your education.',
      'Please know that our office is here to support you through this process.',
    ],
  },
  {
    id: 'persona-it-specialist',
    officeId: 'office-it',
    roleTitle: 'IT Support Specialist',
    authorityLevel: 1,
    toneDefault: 'concise',
    signatureBlock: 'Thanks,\nIT Support Specialist\nIT Help Desk\nWestbrook State University\nhelp@westbrook.edu | (555) 100-5000',
    communicationStructure: 'greeting, acknowledgement, answer, next_steps, closing, signature',
    canDo: [
      'Guide through password reset process',
      'Troubleshoot common software issues',
      'Explain account access procedures',
      'Provide software installation instructions',
    ],
    cannotDo: [
      'Reset passwords via email',
      'Share other users\' account information',
      'Bypass security protocols',
    ],
    approvedPhrases: [
      'Thank you for contacting the IT Help Desk',
      'We\'re here to help get you back on track',
      'Let us know if you need further assistance',
    ],
    safeLanguageTemplates: [
      'Here are the steps to resolve your issue:',
      'If these steps do not resolve the issue, please visit the IT Help Desk in person.',
    ],
  },
];

// ─── Users ────────────────────────────────────────────────────────────────────

export const users: User[] = [
  {
    id: 'user-1',
    name: 'Alex Johnson',
    email: 'alex@westbrook.edu',
    passwordHash: 'mock-hash-password123',
    schoolId: 'school-1',
    officeId: 'office-admissions',
    personaId: 'persona-admissions-counselor',
  },
];

// ─── Mailbox Connections ──────────────────────────────────────────────────────

export const mailboxConnections: MailboxConnection[] = [];

// ─── Tickets ──────────────────────────────────────────────────────────────────

const makeThread = (ticketId: string, inboundBody: string): ThreadMessage[] => [
  {
    id: `msg-${ticketId}-1`,
    ticketId,
    direction: 'inbound',
    body: inboundBody,
    sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

export const tickets: Ticket[] = [
  // ── Admissions Tickets ──
  {
    id: 'ticket-adm-1',
    officeId: 'office-admissions',
    personaId: 'persona-admissions-counselor',
    fromName: 'Emma Rodriguez',
    fromEmail: 'emma.rodriguez@gmail.com',
    subject: 'Question about application requirements for Computer Science',
    receivedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['application', 'computer-science', 'requirements'],
    riskFlags: [],
    threadMessages: makeThread('ticket-adm-1', `Hello,

I am interested in applying to the Computer Science program at Westbrook State University for the Fall 2025 semester. Could you please tell me what the minimum GPA and SAT/ACT requirements are for admission? I also want to know if there is a specific deadline for submitting letters of recommendation.

Thank you,
Emma Rodriguez`),
  },
  {
    id: 'ticket-adm-2',
    officeId: 'office-admissions',
    personaId: 'persona-admissions-counselor',
    fromName: 'Marcus Thompson',
    fromEmail: 'mthompson@yahoo.com',
    subject: 'Transfer student - credit evaluation question',
    receivedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['transfer', 'credits', 'evaluation'],
    riskFlags: [],
    threadMessages: makeThread('ticket-adm-2', `To Whom It May Concern,

I am currently a sophomore at Riverside Community College with a 3.7 GPA and I'm planning to transfer to Westbrook State. I have completed 45 credit hours. How will my credits transfer? Do you have articulation agreements with community colleges in the region?

Marcus Thompson`),
  },
  {
    id: 'ticket-adm-3',
    officeId: 'office-admissions',
    personaId: 'persona-admissions-counselor',
    fromName: 'Sarah Kim',
    fromEmail: 'sarahkim2024@outlook.com',
    subject: 'Campus visit request - prospective student',
    receivedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: 'assigned',
    tags: ['campus-visit', 'prospective'],
    riskFlags: [],
    threadMessages: makeThread('ticket-adm-3', `Hi there,

I would love to schedule a campus tour of Westbrook State University. I'm a high school junior considering applying next year. Are there any upcoming open house events? I'm particularly interested in the School of Engineering and the student housing options.

Best,
Sarah Kim`),
  },
  {
    id: 'ticket-adm-4',
    officeId: 'office-admissions',
    personaId: 'persona-admissions-counselor',
    fromName: 'David Patel',
    fromEmail: 'dpatel.intl@gmail.com',
    subject: 'International student visa and admission requirements',
    receivedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['international', 'visa', 'F-1'],
    riskFlags: [],
    threadMessages: makeThread('ticket-adm-4', `Dear Admissions Office,

I am an international student from India and I would like to apply to the MBA program. What are the TOEFL/IELTS requirements? Also, can you explain the F-1 visa process and when I should apply to ensure my visa is ready by the start of classes?

Regards,
David Patel`),
  },
  {
    id: 'ticket-adm-5',
    officeId: 'office-admissions',
    personaId: 'persona-admissions-counselor',
    fromName: 'Jennifer Walsh',
    fromEmail: 'jwalsh.appeal@gmail.com',
    subject: 'Admission appeal - decision reconsideration request',
    receivedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['appeal', 'reconsideration'],
    riskFlags: ['Needs Human Attention'],
    threadMessages: makeThread('ticket-adm-5', `To the Admissions Committee,

I received my rejection letter last week and I am writing to formally appeal this decision. I believe there was a disability accommodation that was not properly considered during the review process. My IEP from high school documents a learning disability that affected my standardized test scores, though my GPA of 3.8 reflects my true academic capability.

I am requesting a formal appeal review and am prepared to submit additional documentation.

Jennifer Walsh`),
  },
  {
    id: 'ticket-adm-6',
    officeId: 'office-admissions',
    personaId: 'persona-admissions-counselor',
    fromName: 'Carlos Mendez',
    fromEmail: 'c.mendez.grad@gmail.com',
    subject: 'Graduate program application - missing documents',
    receivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'approved',
    tags: ['graduate', 'missing-documents'],
    riskFlags: [],
    threadMessages: makeThread('ticket-adm-6', `Hello,

I submitted my application for the Master's in Data Science program last month. My portal shows that my official transcripts are still marked as "pending." I mailed them from the university 3 weeks ago. Can you confirm whether they have been received? My applicant ID is GR-2025-8847.

Thank you,
Carlos Mendez`),
  },
  {
    id: 'ticket-adm-7',
    officeId: 'office-admissions',
    personaId: 'persona-admissions-counselor',
    fromName: 'Aisha Johnson',
    fromEmail: 'aisha.j.honors@gmail.com',
    subject: 'Honors program eligibility question',
    receivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'sent',
    tags: ['honors', 'eligibility'],
    riskFlags: [],
    threadMessages: makeThread('ticket-adm-7', `Dear Admissions,

I was recently admitted to Westbrook State and I'm very excited! I wanted to ask about the Honors College. What GPA and test score requirements are needed to be considered? Is there a separate application or is it automatic based on my admission profile?

Sincerely,
Aisha Johnson`),
  },
  {
    id: 'ticket-adm-8',
    officeId: 'office-admissions',
    personaId: 'persona-admissions-counselor',
    fromName: 'Tyler Brooks',
    fromEmail: 'tyler.brooks.sport@gmail.com',
    subject: 'Athletic scholarship and admission process',
    receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'rejected',
    tags: ['athletic', 'scholarship'],
    riskFlags: [],
    threadMessages: makeThread('ticket-adm-8', `Hi,

I'm a recruited athlete (Division II basketball) and my coach told me to reach out about the admission process for student athletes. Do I apply through the regular admissions portal? Are there special scholarship opportunities for recruited athletes and how does the financial aid process work for athletics?

Thanks,
Tyler Brooks`),
  },

  // ── Registrar Tickets ──
  {
    id: 'ticket-reg-1',
    officeId: 'office-registrar',
    personaId: 'persona-registrar-specialist',
    fromName: 'Michelle Carter',
    fromEmail: 'michelle.carter@westbrook.edu',
    subject: 'Official transcript request for graduate school application',
    receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['transcript', 'graduate-school'],
    riskFlags: [],
    threadMessages: makeThread('ticket-reg-1', `Hello Registrar's Office,

I am a graduating senior applying to law school and I need 5 official transcripts sent to different institutions. I submitted the request online last Tuesday but I haven't received a confirmation. My student ID is WSU-2021-4423. Can you confirm the status and let me know when they'll be sent?

Thank you,
Michelle Carter`),
  },
  {
    id: 'ticket-reg-2',
    officeId: 'office-registrar',
    personaId: 'persona-registrar-specialist',
    fromName: 'James Liu',
    fromEmail: 'james.liu@westbrook.edu',
    subject: 'Enrollment verification for health insurance',
    receivedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['enrollment-verification', 'insurance'],
    riskFlags: [],
    threadMessages: makeThread('ticket-reg-2', `To the Registrar,

I need an enrollment verification letter for my parents' health insurance. They need proof that I am enrolled full-time this semester. The insurance company requires the letter on official letterhead with the Registrar's signature. How quickly can I get this?

James Liu, Student ID: WSU-2022-7891`),
  },
  {
    id: 'ticket-reg-3',
    officeId: 'office-registrar',
    personaId: 'persona-registrar-specialist',
    fromName: 'Priya Sharma',
    fromEmail: 'priya.sharma@westbrook.edu',
    subject: 'Name change request - legal name update',
    receivedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    status: 'assigned',
    tags: ['name-change', 'records-update'],
    riskFlags: [],
    threadMessages: makeThread('ticket-reg-3', `Dear Registrar,

I recently got married and have legally changed my name. I need to update my name in the university system. My current name on file is Priya Kapoor and I need it changed to Priya Sharma. What documents do I need to submit?

Thank you,
Priya Sharma (formerly Priya Kapoor), Student ID: WSU-2020-5512`),
  },
  {
    id: 'ticket-reg-4',
    officeId: 'office-registrar',
    personaId: 'persona-registrar-specialist',
    fromName: 'Robert Fleming',
    fromEmail: 'rob.fleming@westbrook.edu',
    subject: 'Registration hold preventing course enrollment',
    receivedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['hold', 'registration', 'enrollment'],
    riskFlags: [],
    threadMessages: makeThread('ticket-reg-4', `Hi,

I'm trying to register for next semester's classes but I have a financial hold on my account. I paid my balance two weeks ago but the hold is still showing. My student ID is WSU-2023-1144. Can someone please remove this hold so I can register before the priority registration deadline closes?

Robert Fleming`),
  },
  {
    id: 'ticket-reg-5',
    officeId: 'office-registrar',
    personaId: 'persona-registrar-specialist',
    fromName: 'Angela Torres',
    fromEmail: 'angela.torres@westbrook.edu',
    subject: 'Grade change dispute - FERPA concern',
    receivedAt: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['grade-dispute', 'FERPA'],
    riskFlags: ['Needs Human Attention'],
    threadMessages: makeThread('ticket-reg-5', `To the Registrar,

I believe there has been an unauthorized grade change in my HIST 301 course. My transcript shows a D but my professor confirmed in writing that I earned a B. This appears to be a FERPA violation and I am considering legal action if this is not corrected immediately.

Angela Torres, Student ID: WSU-2021-8876`),
  },
  {
    id: 'ticket-reg-6',
    officeId: 'office-registrar',
    personaId: 'persona-registrar-specialist',
    fromName: 'Kevin Park',
    fromEmail: 'kevin.park@westbrook.edu',
    subject: 'Degree verification for employment background check',
    receivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'approved',
    tags: ['degree-verification', 'employment'],
    riskFlags: [],
    threadMessages: makeThread('ticket-reg-6', `Hello,

I graduated in May 2024 with a BS in Business Administration and a prospective employer is requesting degree verification through your office. They need confirmation of my degree, graduation date, and GPA. Can you process this quickly as I have a job offer pending?

Kevin Park, Alumni ID: WSU-2020-3344`),
  },
  {
    id: 'ticket-reg-7',
    officeId: 'office-registrar',
    personaId: 'persona-registrar-specialist',
    fromName: 'Diana Chen',
    fromEmail: 'diana.chen@westbrook.edu',
    subject: 'Credit overload request for honors thesis',
    receivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'sent',
    tags: ['overload', 'honors-thesis', 'credits'],
    riskFlags: [],
    threadMessages: makeThread('ticket-reg-7', `Dear Registrar,

I am a senior Honors student working on my thesis and need to take 19 credit hours next semester (the max is 18). My thesis advisor has approved this. Do I need a separate form or can my advisor submit an override through the faculty portal?

Diana Chen, Student ID: WSU-2021-6621`),
  },
  {
    id: 'ticket-reg-8',
    officeId: 'office-registrar',
    personaId: 'persona-registrar-specialist',
    fromName: 'Omar Hassan',
    fromEmail: 'omar.hassan@westbrook.edu',
    subject: 'Study abroad credit transfer question',
    receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'rejected',
    tags: ['study-abroad', 'transfer-credit'],
    riskFlags: [],
    threadMessages: makeThread('ticket-reg-8', `Hello,

I am returning from a semester abroad in Spain and need to know how my courses will be evaluated for transfer credit. I took 5 courses at Universidad de Salamanca. Do I need to submit course syllabi? Who evaluates whether the credits count toward my major requirements?

Omar Hassan, Student ID: WSU-2022-9988`),
  },

  // ── Financial Aid Tickets ──
  {
    id: 'ticket-fin-1',
    officeId: 'office-finaid',
    personaId: 'persona-finaid-advisor',
    fromName: 'Brittany Wells',
    fromEmail: 'brittany.wells@westbrook.edu',
    subject: 'FAFSA verification documents request',
    receivedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['FAFSA', 'verification', 'documents'],
    riskFlags: [],
    threadMessages: makeThread('ticket-fin-1', `Hello Financial Aid,

I received a notification that I have been selected for FAFSA verification. My portal is showing I need to submit additional documents but I'm not sure what everything means. Specifically, it's asking for "verification worksheet" and "tax return transcript." Where do I get these and how do I submit them?

Brittany Wells, ID: WSU-2023-2211`),
  },
  {
    id: 'ticket-fin-2',
    officeId: 'office-finaid',
    personaId: 'persona-finaid-advisor',
    fromName: 'Nathan Scott',
    fromEmail: 'nathan.scott@westbrook.edu',
    subject: 'Lost scholarship eligibility - appeal process',
    receivedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['scholarship', 'appeal', 'SAP'],
    riskFlags: ['Needs Human Attention'],
    threadMessages: makeThread('ticket-fin-2', `Dear Financial Aid,

I received notice that I lost my merit scholarship due to my GPA dropping below 3.0 last semester. I went through a very difficult personal situation (my parent passed away) and had to take a medical withdrawal from two courses. I want to appeal this decision. What is the process and what documentation do I need?

Nathan Scott`),
  },
  {
    id: 'ticket-fin-3',
    officeId: 'office-finaid',
    personaId: 'persona-finaid-advisor',
    fromName: 'Isabella Martinez',
    fromEmail: 'isabella.m@westbrook.edu',
    subject: 'Work-study position availability',
    receivedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    status: 'assigned',
    tags: ['work-study', 'employment'],
    riskFlags: [],
    threadMessages: makeThread('ticket-fin-3', `Hi,

My financial aid package includes federal work-study but I haven't been able to find a position yet. The semester started 3 weeks ago. Are there still work-study positions available? Do I need to apply somewhere specific or does the Financial Aid office place students?

Isabella Martinez, ID: WSU-2024-1155`),
  },
  {
    id: 'ticket-fin-4',
    officeId: 'office-finaid',
    personaId: 'persona-finaid-advisor',
    fromName: 'Chris Anderson',
    fromEmail: 'chris.a.fa@westbrook.edu',
    subject: 'Parent PLUS loan application status',
    receivedAt: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['PLUS-loan', 'parent', 'loan-status'],
    riskFlags: [],
    threadMessages: makeThread('ticket-fin-4', `Hello,

My parents applied for a Parent PLUS loan three weeks ago and we haven't heard anything about the status. They completed the application on studentaid.gov. I need to know if the loan will be disbursed before my bill deadline next week. My student ID is WSU-2023-7789.

Chris Anderson`),
  },
  {
    id: 'ticket-fin-5',
    officeId: 'office-finaid',
    personaId: 'persona-finaid-advisor',
    fromName: 'Samantha Green',
    fromEmail: 'sam.green@westbrook.edu',
    subject: 'Dependency override request - estranged from parents',
    receivedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['dependency-override', 'FAFSA', 'independent'],
    riskFlags: ['Needs Human Attention'],
    threadMessages: makeThread('ticket-fin-5', `To Financial Aid,

I am estranged from both of my parents and cannot obtain their financial information for the FAFSA. I have been living independently since I was 17. I understand there is a dependency override process. Can you explain how to apply and what documentation I need to provide? My situation involved a difficult family circumstance.

Samantha Green, ID: WSU-2024-4422`),
  },
  {
    id: 'ticket-fin-6',
    officeId: 'office-finaid',
    personaId: 'persona-finaid-advisor',
    fromName: 'Derek Washington',
    fromEmail: 'derek.w@westbrook.edu',
    subject: 'Scholarship disbursement timing question',
    receivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'approved',
    tags: ['scholarship', 'disbursement'],
    riskFlags: [],
    threadMessages: makeThread('ticket-fin-6', `Hi,

I was awarded the Westbrook Excellence Scholarship but I don't see it in my financial aid portal yet. The letter said it would be applied to my account for the spring semester but it's not showing. My bill is due Friday. Can you check on this?

Derek Washington, ID: WSU-2022-6601`),
  },
  {
    id: 'ticket-fin-7',
    officeId: 'office-finaid',
    personaId: 'persona-finaid-advisor',
    fromName: 'Lisa Chang',
    fromEmail: 'lisa.chang@westbrook.edu',
    subject: 'Refund check delay - spring disbursement',
    receivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'sent',
    tags: ['refund', 'disbursement', 'direct-deposit'],
    riskFlags: [],
    threadMessages: makeThread('ticket-fin-7', `Hello,

My financial aid refund check was supposed to be processed 10 days ago but I still haven't received it. I set up direct deposit through the student portal. I rely on this money for rent and it's becoming urgent. Can you look into this?

Lisa Chang, ID: WSU-2023-3312`),
  },
  {
    id: 'ticket-fin-8',
    officeId: 'office-finaid',
    personaId: 'persona-finaid-advisor',
    fromName: 'Michael Torres',
    fromEmail: 'michael.t.aid@westbrook.edu',
    subject: 'Aid eligibility for part-time enrollment',
    receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'rejected',
    tags: ['part-time', 'eligibility'],
    riskFlags: [],
    threadMessages: makeThread('ticket-fin-8', `Dear Financial Aid Office,

I'm planning to drop to part-time (6 credit hours) next semester to work more hours to help my family. Will I still be eligible for my financial aid package? I have both federal loans and an institutional grant. I don't want to lose my aid unexpectedly.

Michael Torres, ID: WSU-2022-8814`),
  },

  // ── IT Help Desk Tickets ──
  {
    id: 'ticket-it-1',
    officeId: 'office-it',
    personaId: 'persona-it-specialist',
    fromName: 'Ryan Mitchell',
    fromEmail: 'ryan.mitchell@westbrook.edu',
    subject: 'Cannot log into student portal - account locked',
    receivedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['account-lockout', 'portal', 'login'],
    riskFlags: [],
    threadMessages: makeThread('ticket-it-1', `Hello IT Help Desk,

I have been locked out of my student portal account. I tried to log in this morning and after 3 attempts it says my account is locked. I have a project deadline today and need access to submit my work through the LMS. My username is rmitchell2022.

Please help urgently!
Ryan Mitchell`),
  },
  {
    id: 'ticket-it-2',
    officeId: 'office-it',
    personaId: 'persona-it-specialist',
    fromName: 'Jennifer Ortiz',
    fromEmail: 'jennifer.ortiz@westbrook.edu',
    subject: 'University email not working on mobile device',
    receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['email', 'mobile', 'configuration'],
    riskFlags: [],
    threadMessages: makeThread('ticket-it-2', `Hi,

I recently got a new iPhone and I can't get my university email to work on it. I've tried adding the account as an Exchange account but it keeps saying "Cannot Verify Server Identity." I'm missing important emails. My email address is jennifer.ortiz@westbrook.edu.

Thanks,
Jennifer Ortiz`),
  },
  {
    id: 'ticket-it-3',
    officeId: 'office-it',
    personaId: 'persona-it-specialist',
    fromName: 'Brandon Hughes',
    fromEmail: 'brandon.hughes@westbrook.edu',
    subject: 'Need Adobe Creative Cloud for design course',
    receivedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    status: 'assigned',
    tags: ['software', 'Adobe', 'Creative-Cloud'],
    riskFlags: [],
    threadMessages: makeThread('ticket-it-3', `Hello,

I enrolled in DSGN 201 (Graphic Design) this semester and the course requires Adobe Creative Cloud (Photoshop, Illustrator, InDesign). My professor said the university provides free licenses for students. How do I access this? I couldn't find it on the IT website.

Brandon Hughes, ID: WSU-2023-9914`),
  },
  {
    id: 'ticket-it-4',
    officeId: 'office-it',
    personaId: 'persona-it-specialist',
    fromName: 'Megan Foster',
    fromEmail: 'megan.foster@westbrook.edu',
    subject: 'WiFi keeps disconnecting in the library',
    receivedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['wifi', 'connectivity', 'library'],
    riskFlags: [],
    threadMessages: makeThread('ticket-it-4', `Hi IT,

For the past two weeks, the WiFi in the McKinley Library (3rd floor study area) keeps dropping every 20-30 minutes. I have to reconnect constantly which is very disruptive. Other students in the area have the same problem. Is there a known issue with the access points in that area?

Megan Foster`),
  },
  {
    id: 'ticket-it-5',
    officeId: 'office-it',
    personaId: 'persona-it-specialist',
    fromName: 'Justin Cole',
    fromEmail: 'justin.cole@westbrook.edu',
    subject: 'Suspicious email received - possible phishing attack',
    receivedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    status: 'needs_review',
    tags: ['phishing', 'security', 'suspicious-email'],
    riskFlags: ['Needs Human Attention'],
    threadMessages: makeThread('ticket-it-5', `Hello IT Security,

I received a very suspicious email claiming to be from "IT Administration" asking me to click a link and verify my university credentials. The sender address looks fake. I may have accidentally clicked the link but didn't enter any information. Should I be worried about a security breach? I think my account may have been hacked.

Justin Cole, ID: WSU-2024-5577`),
  },
  {
    id: 'ticket-it-6',
    officeId: 'office-it',
    personaId: 'persona-it-specialist',
    fromName: 'Amanda Lewis',
    fromEmail: 'amanda.lewis@westbrook.edu',
    subject: 'Zoom not working for virtual class sessions',
    receivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'approved',
    tags: ['Zoom', 'virtual-class', 'software'],
    riskFlags: [],
    threadMessages: makeThread('ticket-it-6', `Dear Help Desk,

I cannot join my virtual class sessions on Zoom. When I click the meeting link, it opens Zoom but then gives an error "Unable to connect to Zoom's service." This has been happening for 3 days. I have tried reinstalling Zoom. My internet works for everything else.

Amanda Lewis`),
  },
  {
    id: 'ticket-it-7',
    officeId: 'office-it',
    personaId: 'persona-it-specialist',
    fromName: 'Steven Park',
    fromEmail: 'steven.park@westbrook.edu',
    subject: 'Two-factor authentication not working',
    receivedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'sent',
    tags: ['MFA', 'two-factor', 'authentication'],
    riskFlags: [],
    threadMessages: makeThread('ticket-it-7', `Hi,

My two-factor authentication app is no longer generating codes for my university account. I got a new phone and set up the authenticator app but now it gives an "invalid code" error every time. I can't access my email or LMS. Is there a way to reset my MFA settings?

Steven Park, ID: WSU-2022-4488`),
  },
  {
    id: 'ticket-it-8',
    officeId: 'office-it',
    personaId: 'persona-it-specialist',
    fromName: 'Nicole Baker',
    fromEmail: 'nicole.baker@westbrook.edu',
    subject: 'Laptop repair - screen cracked, warranty question',
    receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'rejected',
    tags: ['hardware', 'laptop', 'repair', 'warranty'],
    riskFlags: [],
    threadMessages: makeThread('ticket-it-8', `Hello,

I have a university-issued loaner laptop and the screen cracked after I accidentally dropped it. I'm not sure if this is covered under any warranty or if I'll be responsible for the repair cost. Can the IT department repair it? What's the process for this situation?

Nicole Baker, Asset Tag: WSU-LT-4421`),
  },
];

// ─── Drafts ───────────────────────────────────────────────────────────────────

export const drafts: Draft[] = [];

// ─── Decisions ───────────────────────────────────────────────────────────────

export const decisions: Decision[] = [];

// ─── Helper accessors ────────────────────────────────────────────────────────

export const getOfficeById = (id: string) => offices.find(o => o.id === id);
export const getPersonaById = (id: string) => personas.find(p => p.id === id);
export const getRulebookByOfficeId = (officeId: string) => rulebooks.find(r => r.officeId === officeId);
export const getTicketById = (id: string) => tickets.find(t => t.id === id);
export const getDraftByTicketId = (ticketId: string) => drafts.find(d => d.ticketId === ticketId);
export const getTicketsByOfficeId = (officeId: string) => tickets.filter(t => t.officeId === officeId);
