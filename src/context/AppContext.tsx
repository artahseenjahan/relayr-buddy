import React, { createContext, useContext, useState } from 'react';
import { User, MailboxConnection, School, Office, Persona, Ticket, Draft, Decision, GoogleOAuthSession, RoutingRule, CalendarConnection } from '../types';
import {
  users, mailboxConnections as seedMailbox, schools, offices, personas,
  tickets as seedTickets, drafts as seedDrafts, decisions as seedDecisions,
  getTicketById as dbGetTicketById,
} from '../data/mockDb';
import {
  signInWithGoogle,
  revokeGoogleToken,
  loadSession,
  clearSession,
} from '../lib/googleAuth';

interface AppState {
  currentUser: User | null;
  mailboxConnection: MailboxConnection | null;
  calendarConnection: CalendarConnection | null;
  tickets: Ticket[];
  drafts: Draft[];
  decisions: Decision[];
  isAuthenticated: boolean;
  googleSession: GoogleOAuthSession | null;
  routingRules: RoutingRule[];
}

interface AppContextType extends AppState {
  login: (email: string, password: string) => boolean;
  logout: () => void;
  connectMailbox: (provider: 'gmail' | 'outlook') => void;
  disconnectMailbox: () => void;
  connectCalendar: () => Promise<void>;
  disconnectCalendar: () => void;
  getSchool: (id: string) => School | undefined;
  getOffice: (id: string) => Office | undefined;
  getPersona: (id: string) => Persona | undefined;
  updateTicket: (ticketId: string, updates: Partial<Ticket>) => void;
  saveDraft: (draft: Draft) => void;
  getDraftForTicket: (ticketId: string) => Draft | undefined;
  saveDecision: (decision: Decision) => void;
  clearAllDraftsAndDecisions: () => void;
  connectGoogle: () => Promise<GoogleOAuthSession>;
  revokeGoogle: () => Promise<void>;
  addRoutingRule: (rule: RoutingRule) => void;
  updateRoutingRule: (rule: RoutingRule) => void;
  deleteRoutingRule: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('campusreply_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [mailboxConnection, setMailboxConnection] = useState<MailboxConnection | null>(() => {
    const stored = sessionStorage.getItem('campusreply_mailbox');
    return stored ? JSON.parse(stored) : null;
  });
  const [calendarConnection, setCalendarConnection] = useState<CalendarConnection | null>(() => {
    const stored = sessionStorage.getItem('campusreply_calendar');
    return stored ? JSON.parse(stored) : null;
  });
  const [ticketList, setTicketList] = useState<Ticket[]>(seedTickets);
  const [draftList, setDraftList] = useState<Draft[]>(seedDrafts);
  const [decisionList, setDecisionList] = useState<Decision[]>(seedDecisions);
  const [googleSession, setGoogleSession] = useState<GoogleOAuthSession | null>(() => loadSession());
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([
    { id: 'rule-1', keywords: ['FAFSA', 'financial aid', 'tuition', 'scholarship', 'grant'], targetDepartment: 'Financial Aid Office', reason: 'Topics relating to tuition costs, financial assistance, FAFSA, grants, or scholarships belong to Financial Aid.' },
    { id: 'rule-2', keywords: ['transcript', 'enrollment', 'graduation', 'degree audit', 'credits'], targetDepartment: "Registrar's Office", reason: 'Academic records, enrollment verification, transcripts, and degree requirements are handled by the Registrar.' },
    { id: 'rule-3', keywords: ['password reset', 'login', 'VPN', 'wifi', 'portal access', 'IT'], targetDepartment: 'IT Help Desk', reason: 'Technical issues, account access, and campus system problems should be routed to IT support.' },
  ]);

  const login = (email: string, password: string): boolean => {
    const user = users.find(u => u.email === email);
    if (user && password === 'password123') {
      setCurrentUser(user);
      sessionStorage.setItem('campusreply_user', JSON.stringify(user));
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    setMailboxConnection(null);
    setCalendarConnection(null);
    setGoogleSession(null);
    sessionStorage.removeItem('campusreply_user');
    sessionStorage.removeItem('campusreply_mailbox');
    sessionStorage.removeItem('campusreply_calendar');
    clearSession();
  };

  const connectMailbox = (provider: 'gmail' | 'outlook') => {
    const conn: MailboxConnection = {
      id: `mailbox-${Date.now()}`,
      userId: currentUser?.id || 'user-1',
      provider,
      status: 'connected',
      lastSyncAt: new Date().toISOString(),
    };
    setMailboxConnection(conn);
    sessionStorage.setItem('campusreply_mailbox', JSON.stringify(conn));
  };

  const disconnectMailbox = () => {
    if (mailboxConnection) {
      const updated = { ...mailboxConnection, status: 'disconnected' as const };
      setMailboxConnection(updated);
      sessionStorage.setItem('campusreply_mailbox', JSON.stringify(updated));
    }
  };

  const connectCalendar = async (): Promise<void> => {
    // Reuse existing Google session if valid; otherwise trigger a new sign-in
    let session = googleSession;
    if (!session) {
      session = await signInWithGoogle();
      setGoogleSession(session);
    }
    const conn: CalendarConnection = {
      id: `calendar-${Date.now()}`,
      userId: currentUser?.id || 'user-1',
      provider: 'google',
      status: 'connected',
      connectedAt: new Date().toISOString(),
      userEmail: session.userEmail,
    };
    setCalendarConnection(conn);
    sessionStorage.setItem('campusreply_calendar', JSON.stringify(conn));
  };

  const disconnectCalendar = () => {
    setCalendarConnection(null);
    sessionStorage.removeItem('campusreply_calendar');
  };

  const connectGoogle = async (): Promise<GoogleOAuthSession> => {
    const session = await signInWithGoogle();
    setGoogleSession(session);
    connectMailbox('gmail');
    return session;
  };

  const revokeGoogle = async (): Promise<void> => {
    if (googleSession) {
      await revokeGoogleToken(googleSession.accessToken);
    }
    setGoogleSession(null);
  };

  const getSchool = (id: string) => schools.find(s => s.id === id);
  const getOffice = (id: string) => offices.find(o => o.id === id);
  const getPersona = (id: string) => personas.find(p => p.id === id);

  const updateTicket = (ticketId: string, updates: Partial<Ticket>) => {
    setTicketList(prev => prev.map(t => t.id === ticketId ? { ...t, ...updates } : t));
  };

  const saveDraft = (draft: Draft) => {
    setDraftList(prev => {
      const existing = prev.findIndex(d => d.ticketId === draft.ticketId);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = draft;
        return updated;
      }
      return [...prev, draft];
    });
  };

  const getDraftForTicket = (ticketId: string) => draftList.find(d => d.ticketId === ticketId);

  const saveDecision = (decision: Decision) => {
    setDecisionList(prev => [...prev, decision]);
  };

  const clearAllDraftsAndDecisions = () => {
    setDraftList([]);
    setDecisionList([]);
  };

  const addRoutingRule = (rule: RoutingRule) => setRoutingRules(prev => [...prev, rule]);
  const updateRoutingRule = (rule: RoutingRule) => setRoutingRules(prev => prev.map(r => r.id === rule.id ? rule : r));
  const deleteRoutingRule = (id: string) => setRoutingRules(prev => prev.filter(r => r.id !== id));

  return (
    <AppContext.Provider value={{
      currentUser,
      mailboxConnection,
      calendarConnection,
      tickets: ticketList,
      drafts: draftList,
      decisions: decisionList,
      isAuthenticated: !!currentUser,
      googleSession,
      routingRules,
      login,
      logout,
      connectMailbox,
      disconnectMailbox,
      connectCalendar,
      disconnectCalendar,
      connectGoogle,
      revokeGoogle,
      getSchool,
      getOffice,
      getPersona,
      updateTicket,
      saveDraft,
      getDraftForTicket,
      saveDecision,
      clearAllDraftsAndDecisions,
      addRoutingRule,
      updateRoutingRule,
      deleteRoutingRule,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
