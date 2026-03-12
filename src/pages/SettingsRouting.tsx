import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AppLayout from '../components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Pencil, Trash2, GitMerge, X } from 'lucide-react';
import type { RoutingRule } from '../types';

export default function SettingsRouting() {
  const navigate = useNavigate();
  const { routingRules, addRoutingRule, updateRoutingRule, deleteRoutingRule } = useApp();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoutingRule | null>(null);
  const [form, setForm] = useState({ keywords: '', targetDepartment: '', reason: '' });
  const [keywordInput, setKeywordInput] = useState('');

  const openNew = () => {
    setEditing(null);
    setForm({ keywords: '', targetDepartment: '', reason: '' });
    setKeywordInput('');
    setDialogOpen(true);
  };

  const openEdit = (rule: RoutingRule) => {
    setEditing(rule);
    setForm({
      keywords: rule.keywords.join(', '),
      targetDepartment: rule.targetDepartment,
      reason: rule.reason,
    });
    setKeywordInput('');
    setDialogOpen(true);
  };

  const handleSave = () => {
    const keywords = form.keywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);
    if (!keywords.length || !form.targetDepartment.trim()) return;

    if (editing) {
      updateRoutingRule({ ...editing, keywords, targetDepartment: form.targetDepartment.trim(), reason: form.reason.trim() });
    } else {
      addRoutingRule({
        id: `rule-${Date.now()}`,
        keywords,
        targetDepartment: form.targetDepartment.trim(),
        reason: form.reason.trim(),
      });
    }
    setDialogOpen(false);
  };

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (!kw) return;
    const existing = form.keywords ? form.keywords + ', ' + kw : kw;
    setForm(f => ({ ...f, keywords: existing }));
    setKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    const updated = form.keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k && k !== kw)
      .join(', ');
    setForm(f => ({ ...f, keywords: updated }));
  };

  const parsedKeywords = form.keywords
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to Settings
          </Button>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-primary" /> Routing Rules
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Define keyword triggers that route tickets to the correct department. These feed into the Layer 3 intelligence routing engine.
            </p>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={openNew}>
            <Plus className="w-4 h-4" /> Add Rule
          </Button>
        </div>

        {routingRules.length === 0 ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
              <GitMerge className="w-10 h-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-foreground">No routing rules yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add rules to automatically suggest routing for tickets containing specific keywords.</p>
              </div>
              <Button size="sm" onClick={openNew} className="gap-1.5 mt-2">
                <Plus className="w-4 h-4" /> Add first rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {routingRules.map(rule => (
              <Card key={rule.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Route to</span>
                        <span className="text-sm font-semibold text-foreground">{rule.targetDepartment}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {rule.keywords.map(kw => (
                          <Badge key={kw} variant="secondary" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                      {rule.reason && (
                        <p className="text-xs text-muted-foreground">{rule.reason}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(rule)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete routing rule?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the rule routing "{rule.keywords.join(', ')}" to {rule.targetDepartment}. The Layer 3 engine will no longer use this rule for ticket triage.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteRoutingRule(rule.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How routing rules work</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1.5">
            <p>• The <strong className="text-foreground">Layer 3 intelligence engine</strong> scans each incoming ticket for keyword matches.</p>
            <p>• When a match is found, it flags the ticket with a routing suggestion and the reason you defined.</p>
            <p>• Staff still make the final routing decision — these rules only surface suggestions.</p>
            <p>• Keywords are <strong className="text-foreground">case-insensitive</strong> and matched against subject, body, and tags.</p>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Routing Rule' : 'New Routing Rule'}</DialogTitle>
            <DialogDescription>
              Define keywords that trigger routing to a specific department.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Target Department</Label>
              <Input
                placeholder="e.g. Financial Aid Office"
                value={form.targetDepartment}
                onChange={e => setForm(f => ({ ...f, targetDepartment: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Keywords</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a keyword…"
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addKeyword} className="shrink-0">
                  Add
                </Button>
              </div>
              {parsedKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {parsedKeywords.map(kw => (
                    <Badge key={kw} variant="secondary" className="gap-1 text-xs">
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        className="hover:text-destructive"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Separate multiple keywords with commas or add them one at a time.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder="e.g. Topics about tuition, FAFSA, or financial assistance belong to this office."
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={parsedKeywords.length === 0 || !form.targetDepartment.trim()}
            >
              {editing ? 'Save Changes' : 'Add Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
