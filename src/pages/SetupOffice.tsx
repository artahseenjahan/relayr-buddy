import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ArrowRight } from 'lucide-react';
import OnboardingLayout from '../components/OnboardingLayout';

export default function SetupOffice() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/setup-rulebook');
  };

  return (
    <OnboardingLayout step={2} totalSteps={4} title="Set Up Your Office">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Office Details
          </CardTitle>
          <CardDescription>Define the office that will use CampusReply</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Office Name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Office of Admissions" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What does this office do?" rows={3} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audience">Primary Audience</Label>
              <Input id="audience" value={audience} onChange={e => setAudience(e.target.value)}
                placeholder="e.g. Prospective students and applicants" required />
            </div>
            <Button type="submit" className="w-full">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </OnboardingLayout>
  );
}
