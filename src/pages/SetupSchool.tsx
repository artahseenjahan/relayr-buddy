import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ArrowRight } from 'lucide-react';
import { SchoolCategory } from '../types';
import OnboardingLayout from '../components/OnboardingLayout';

const CATEGORIES: SchoolCategory[] = [
  'Public University', 'Private University', 'Community College', 'K-12 School', 'Online Institution',
];

export default function SetupSchool() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SchoolCategory | ''>('');
  const [domain, setDomain] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/setup-office');
  };

  return (
    <OnboardingLayout step={1} totalSteps={4} title="Set Up Your School">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            School Information
          </CardTitle>
          <CardDescription>Tell us about your institution</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">School Name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Westbrook State University" required />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={v => setCategory(v as SchoolCategory)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select school type" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" value={domain} onChange={e => setDomain(e.target.value)}
                placeholder="e.g. westbrook.edu" required />
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
