import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AppLayout from '../components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Inbox, AlertTriangle, CheckCircle2, Send, Clock, ArrowRight, FileText
} from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const navigate = useNavigate();
  const { tickets, drafts, decisions, getOffice, currentUser } = useApp();

  const stats = useMemo(() => {
    const total = tickets.length;
    const needsReview = tickets.filter(t => t.status === 'needs_review').length;
    const approved = tickets.filter(t => t.status === 'approved' || t.status === 'sent').length;
    const riskFlagged = tickets.filter(t => t.riskFlags.length > 0).length;
    return { total, needsReview, approved, riskFlagged };
  }, [tickets]);

  // Tickets by office for bar chart
  const officeData = useMemo(() => {
    const map: Record<string, { name: string; tickets: number; reviewed: number }> = {};
    tickets.forEach(t => {
      const office = getOffice(t.officeId);
      const name = office?.name ?? t.officeId;
      if (!map[t.officeId]) map[t.officeId] = { name, tickets: 0, reviewed: 0 };
      map[t.officeId].tickets += 1;
      if (t.status === 'approved' || t.status === 'sent') map[t.officeId].reviewed += 1;
    });
    return Object.values(map);
  }, [tickets, getOffice]);

  // Status breakdown
  const statusBreakdown = useMemo(() => {
    const statuses: { label: string; count: number; color: string }[] = [
      { label: 'Needs Review', count: tickets.filter(t => t.status === 'needs_review').length, color: 'hsl(var(--status-review))' },
      { label: 'Approved', count: tickets.filter(t => t.status === 'approved').length, color: 'hsl(var(--status-approved))' },
      { label: 'Sent', count: tickets.filter(t => t.status === 'sent').length, color: 'hsl(var(--primary))' },
      { label: 'Assigned', count: tickets.filter(t => t.status === 'assigned').length, color: 'hsl(var(--status-assigned))' },
      { label: 'Rejected', count: tickets.filter(t => t.status === 'rejected').length, color: 'hsl(var(--status-rejected))' },
    ];
    return statuses;
  }, [tickets]);

  const recentDecisions = useMemo(() => {
    return [...decisions]
      .sort((a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime())
      .slice(0, 5);
  }, [decisions]);

  const recentTickets = useMemo(() => {
    return [...tickets]
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
      .slice(0, 5);
  }, [tickets]);

  const statCards = [
    {
      label: 'Total Tickets',
      value: stats.total,
      icon: Inbox,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Needs Review',
      value: stats.needsReview,
      icon: Clock,
      color: 'text-[hsl(var(--status-review))]',
      bg: 'bg-[hsl(var(--status-review))]/10',
    },
    {
      label: 'Approved / Sent',
      value: stats.approved,
      icon: CheckCircle2,
      color: 'text-[hsl(var(--status-approved))]',
      bg: 'bg-[hsl(var(--status-approved))]/10',
    },
    {
      label: 'Risk Flagged',
      value: stats.riskFlagged,
      icon: AlertTriangle,
      color: 'text-[hsl(var(--status-rejected))]',
      bg: 'bg-[hsl(var(--status-rejected))]/10',
    },
  ];

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Overview of your inbox and reply activity</p>
          </div>
          <Button size="sm" onClick={() => navigate('/inbox')} className="gap-1.5">
            <Inbox className="w-3.5 h-3.5" /> Go to Inbox
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending drafts + Office chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bar chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Tickets by Office</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={officeData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  />
                  <Bar dataKey="tickets" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="reviewed" name="Approved/Sent" fill="hsl(var(--status-approved))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pending drafts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Pending Drafts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No drafts saved yet.</p>
              ) : (
                drafts.slice(0, 5).map(d => {
                  const ticket = tickets.find(t => t.id === d.ticketId);
                  return ticket ? (
                    <button
                      key={d.id}
                      onClick={() => navigate(`/ticket/${ticket.id}`)}
                      className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
                    >
                      <div className="text-xs font-medium text-foreground truncate">{ticket.subject}</div>
                      <div className="text-xs text-muted-foreground">v{d.version} · {Math.round(d.confidenceScore * 100)}% confidence</div>
                    </button>
                  ) : null;
                })
              )}
              <div className="flex items-center gap-1 pt-1">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{drafts.length} total draft{drafts.length !== 1 ? 's' : ''}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status breakdown + Recent tickets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Status breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {statusBreakdown.map(({ label, count, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: stats.total > 0 ? `${(count / stats.total) * 100}%` : '0%',
                        background: color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent tickets */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Tickets</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => navigate('/inbox')}>
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-1">
              {recentTickets.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => navigate(`/ticket/${ticket.id}`)}
                  className="w-full text-left flex items-start gap-2 p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{ticket.subject}</div>
                    <div className="text-xs text-muted-foreground">{ticket.fromName} · {format(new Date(ticket.receivedAt), 'MMM d')}</div>
                  </div>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0"
                    style={{
                      background: ticket.status === 'needs_review'
                        ? 'hsl(var(--status-review) / 0.15)'
                        : ticket.status === 'approved' || ticket.status === 'sent'
                        ? 'hsl(var(--status-approved) / 0.15)'
                        : 'hsl(var(--muted))',
                      color: ticket.status === 'needs_review'
                        ? 'hsl(var(--status-review))'
                        : ticket.status === 'approved' || ticket.status === 'sent'
                        ? 'hsl(var(--status-approved))'
                        : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {ticket.status.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent Decisions */}
        {recentDecisions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Recent Decisions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentDecisions.map(d => {
                  const ticket = tickets.find(t => t.id === d.ticketId);
                  return (
                    <div key={d.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">
                          {ticket?.subject ?? d.ticketId}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(d.decidedAt), 'MMM d, h:mm a')}
                          {d.notes && ` · ${d.notes}`}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize shrink-0"
                      >
                        {d.action.replace('_', ' ')}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
