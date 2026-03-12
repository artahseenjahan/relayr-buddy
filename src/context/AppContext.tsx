import React, { createContext, useContext, useState } from 'react';
import { User, MailboxConnection, School, Office, Persona, Ticket, Draft, Decision, GoogleOAuthSession, RoutingRule } from '../types';
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
  tickets: Ticket[];
  drafts: Draft[];
  decisions: Decision[];
  isAuthenticated: boolean;
  googleSession: GoogleOAuthSession | null;
}

interface AppContextType extends AppState {
  login: (email: string, password: string) => boolean;
  logout: () => void;
  connectMailbox: (provider: 'gmail' | 'outlook') => void;
  disconnectMailbox: () => void;
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
  const [ticketList, setTicketList] = useState<Ticket[]>(seedTickets);
  const [draftList, setDraftList] = useState<Draft[]>(seedDrafts);
  const [decisionList, setDecisionList] = useState<Decision[]>(seedDecisions);
  const [googleSession, setGoogleSession] = useState<GoogleOAuthSession | null>(() => loadSession());

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
    setGoogleSession(null);
    sessionStorage.removeItem('campusreply_user');
    sessionStorage.removeItem('campusreply_mailbox');
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

  const connectGoogle = async (): Promise<GoogleOAuthSession> => {
    const session = await signInWithGoogle();
    setGoogleSession(session);
    // Also connect the mailbox provider as gmail
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

  return (
    <AppContext.Provider value={{
      currentUser,
      mailboxConnection,
      tickets: ticketList,
      drafts: draftList,
      decisions: decisionList,
      isAuthenticated: !!currentUser,
      googleSession,
      login,
      logout,
      connectMailbox,
      disconnectMailbox,
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
