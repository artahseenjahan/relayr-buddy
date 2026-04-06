import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '../context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, AlertCircle, Chrome } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { signInWithGoogle, user } = useAuth();
  const { login } = useApp();
  const [email, setEmail] = useState('alex@westbrook.edu');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Auth state change will redirect via ProtectedRoute
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
      setGoogleLoading(false);
    }
  };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const success = login(email, password);
    setLoading(false);
    if (success) {
      navigate('/inbox');
    } else {
      setError('Invalid email or password. Try alex@westbrook.edu / password123');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(220,20%,97%)] to-[hsl(221,83%,96%)]">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Relayr</h1>
          <p className="text-muted-foreground mt-1">AI-powered email drafting for universities</p>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>Use your Google account or try demo mode</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full"
              variant="default"
            >
              <Chrome className="w-4 h-4 mr-2" />
              {googleLoading ? 'Connecting…' : 'Sign in with Google'}
            </Button>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            {!showDemo ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowDemo(true)}
              >
                Try Demo Mode
              </Button>
            ) : (
              <form onSubmit={handleDemoSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@university.edu"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" variant="secondary" disabled={loading}>
                  {loading ? 'Signing in…' : 'Enter Demo Mode'}
                </Button>

                <div className="p-3 rounded-md bg-muted text-muted-foreground text-xs">
                  <strong>Demo credentials:</strong><br />
                  Email: alex@westbrook.edu<br />
                  Password: password123
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
