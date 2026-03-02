import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, ArrowRight, Plus, X } from 'lucide-react';
import OnboardingLayout from '../components/OnboardingLayout';

const ListField = ({ label, items, onChange }: { label: string; items: string[]; onChange: (items: string[]) => void }) => {
  const [input, setInput] = useState('');

  const add = () => {
    if (input.trim()) {
      onChange([...items, input.trim()]);
      setInput('');
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Add item…"
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())} />
        <Button type="button" variant="outline" size="icon" onClick={add}><Plus className="w-4 h-4" /></Button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1">
              <span className="flex-1">{item}</span>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const LinkField = ({ items, onChange }: { items: { label: string; url: string }[]; onChange: (items: { label: string; url: string }[]) => void }) => {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');

  const add = () => {
    if (label.trim() && url.trim()) {
      onChange([...items, { label: label.trim(), url: url.trim() }]);
      setLabel(''); setUrl('');
    }
  };

  return (
    <div className="space-y-2">
      <Label>Required Links</Label>
      <div className="flex gap-2">
        <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label" className="w-1/3" />
        <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" className="flex-1" />
        <Button type="button" variant="outline" size="icon" onClick={add}><Plus className="w-4 h-4" /></Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1">
          <span className="font-medium w-24 truncate">{item.label}</span>
          <span className="flex-1 text-muted-foreground truncate">{item.url}</span>
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default function SetupRulebook() {
  const navigate = useNavigate();
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [hardConstraints, setHardConstraints] = useState<string[]>([]);
  const [softGuidelines, setSoftGuidelines] = useState<string[]>([]);
  const [requiredDisclaimers, setRequiredDisclaimers] = useState<string[]>([]);
  const [requiredLinks, setRequiredLinks] = useState<{ label: string; url: string }[]>([]);
  const [escalationTriggers, setEscalationTriggers] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/setup-persona');
  };

  return (
    <OnboardingLayout step={3} totalSteps={4} title="Office Rulebook">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Define Office Rules
          </CardTitle>
          <CardDescription>These rules guide AI draft generation for your office</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <ListField label="Responsibilities" items={responsibilities} onChange={setResponsibilities} />
            <ListField label="Hard Constraints (AI must never violate)" items={hardConstraints} onChange={setHardConstraints} />
            <ListField label="Soft Guidelines" items={softGuidelines} onChange={setSoftGuidelines} />
            <ListField label="Required Disclaimers" items={requiredDisclaimers} onChange={setRequiredDisclaimers} />
            <LinkField items={requiredLinks} onChange={setRequiredLinks} />
            <ListField label="Escalation Triggers (keywords)" items={escalationTriggers} onChange={setEscalationTriggers} />
            <Button type="submit" className="w-full">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </OnboardingLayout>
  );
}
