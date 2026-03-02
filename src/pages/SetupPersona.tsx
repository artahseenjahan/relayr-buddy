import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCircle, Plus, X, CheckCircle2 } from 'lucide-react';
import OnboardingLayout from '../components/OnboardingLayout';
import { ToneDefault } from '../types';

const ListField = ({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (items: string[]) => void; placeholder?: string }) => {
  const [input, setInput] = useState('');
  const add = () => {
    if (input.trim()) { onChange([...items, input.trim()]); setInput(''); }
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} placeholder={placeholder || 'Add…'}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())} />
        <Button type="button" variant="outline" size="icon" onClick={add}><Plus className="w-4 h-4" /></Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1">
          <span className="flex-1">{item}</span>
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default function SetupPersona() {
  const navigate = useNavigate();
  const [roleTitle, setRoleTitle] = useState('');
  const [authorityLevel, setAuthorityLevel] = useState('2');
  const [toneDefault, setToneDefault] = useState<ToneDefault>('warm-professional');
  const [signatureBlock, setSignatureBlock] = useState('');
  const [communicationStructure, setCommunicationStructure] = useState('greeting, acknowledgement, answer, next_steps, closing, signature');
  const [canDo, setCanDo] = useState<string[]>([]);
  const [cannotDo, setCannotDo] = useState<string[]>([]);
  const [approvedPhrases, setApprovedPhrases] = useState<string[]>([]);
  const [safeLanguageTemplates, setSafeLanguageTemplates] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/inbox');
  };

  return (
    <OnboardingLayout step={4} totalSteps={4} title="Define Persona">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-primary" />
            Persona Configuration
          </CardTitle>
          <CardDescription>Define the voice and authority of this office persona</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">1. Role</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Role Title</Label>
                  <Input value={roleTitle} onChange={e => setRoleTitle(e.target.value)} placeholder="e.g. Admissions Counselor" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Authority Level (1–4)</Label>
                  <Select value={authorityLevel} onValueChange={setAuthorityLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4].map(n => <SelectItem key={n} value={String(n)}>Level {n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">2. Tone & Style</h3>
              <div className="space-y-1.5">
                <Label>Default Tone</Label>
                <Select value={toneDefault} onValueChange={v => setToneDefault(v as ToneDefault)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warm-professional">Warm-Professional</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="concise">Concise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Communication Structure</Label>
                <Input value={communicationStructure} onChange={e => setCommunicationStructure(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Signature Block</Label>
                <Textarea value={signatureBlock} onChange={e => setSignatureBlock(e.target.value)} rows={3}
                  placeholder="Your name, title, office, email…" />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">3. Authority & Boundaries</h3>
              <ListField label="Can Do" items={canDo} onChange={setCanDo} placeholder="e.g. Answer questions about deadlines" />
              <ListField label="Cannot Do" items={cannotDo} onChange={setCannotDo} placeholder="e.g. Guarantee admission" />
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">4. Approved Institutional Language</h3>
              <ListField label="Approved Phrases" items={approvedPhrases} onChange={setApprovedPhrases} />
              <ListField label="Safe Language Templates" items={safeLanguageTemplates} onChange={setSafeLanguageTemplates} />
            </div>

            <Button type="submit" className="w-full">
              <CheckCircle2 className="w-4 h-4" /> Complete Setup & Go to Inbox
            </Button>
          </form>
        </CardContent>
      </Card>
    </OnboardingLayout>
  );
}
