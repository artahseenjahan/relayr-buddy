import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import ConnectEmail from "./pages/ConnectEmail";
import SetupSchool from "./pages/SetupSchool";
import SetupOffice from "./pages/SetupOffice";
import SetupRulebook from "./pages/SetupRulebook";
import SetupPersona from "./pages/SetupPersona";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import TicketDetail from "./pages/TicketDetail";
import Settings from "./pages/Settings";
import SettingsRulebook from "./pages/SettingsRulebook";
import SettingsRouting from "./pages/SettingsRouting";
import SettingsCalendar from "./pages/SettingsCalendar";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useApp();
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  // Allow access if either Supabase auth or demo mode is active
  if (!isAuthenticated && !user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { isAuthenticated } = useApp();
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  const loggedIn = isAuthenticated || !!user;

  return (
    <Routes>
      <Route path="/login" element={
        loggedIn
          ? <Navigate to="/inbox" replace />
          : <Login />
      } />
      <Route path="/connect-email" element={<ProtectedRoute><ConnectEmail /></ProtectedRoute>} />
      <Route path="/setup-school" element={<ProtectedRoute><SetupSchool /></ProtectedRoute>} />
      <Route path="/setup-office" element={<ProtectedRoute><SetupOffice /></ProtectedRoute>} />
      <Route path="/setup-rulebook" element={<ProtectedRoute><SetupRulebook /></ProtectedRoute>} />
      <Route path="/setup-persona" element={<ProtectedRoute><SetupPersona /></ProtectedRoute>} />
      <Route path="/inbox" element={<ProtectedRoute><Inbox /></ProtectedRoute>} />
      <Route path="/ticket/:id" element={<ProtectedRoute><TicketDetail /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/settings/rulebook" element={<ProtectedRoute><SettingsRulebook /></ProtectedRoute>} />
      <Route path="/settings/routing" element={<ProtectedRoute><SettingsRouting /></ProtectedRoute>} />
      <Route path="/settings/calendar" element={<ProtectedRoute><SettingsCalendar /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppProvider>
            <AppRoutes />
          </AppProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
