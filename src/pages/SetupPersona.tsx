import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Mail, RefreshCw, Sparkles, UserCircle } from "lucide-react";

import OnboardingLayout from "../components/OnboardingLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { checkGmailConnection } from "@/lib/gmailApi";
import { getEmployeeProfile, upsertEmployeeProfile } from "@/lib/employeeProfileApi";
import { buildPersona, fetchPersonaSourceEmails, getCurrentPersona, savePersonaSelection } from "@/lib/personaApi";
import type { EmployeeProfileApi, PersonaProfileApi } from "@/types";

type EmployeeForm = {
  title: string;
  department: string;
  office_name: string;
  responsibilities_summary: string;
  role_guidelines_summary: string;
};

const EMPTY_FORM: EmployeeForm = {
  title: "",
  department: "",
  office_name: "",
  responsibilities_summary: "",
  role_guidelines_summary: "",
};

export default function SetupPersona() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [buildingPersona, setBuildingPersona] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; subject: string; snippet: string; date: string; from?: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [personaName, setPersonaName] = useState("Primary Persona");
  const [currentPersona, setCurrentPersona] = useState<PersonaProfileApi | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeForm>(EMPTY_FORM);

  useEffect(() => {
    if (!user) return;

    checkGmailConnection()
      .then((result) => setGmailConnected(result.connected))
      .catch(() => setGmailConnected(false));

    getEmployeeProfile()
      .then((profile: EmployeeProfileApi) =>
        setEmployeeProfile({
          title: profile.title,
          department: profile.department,
          office_name: profile.office_name,
          responsibilities_summary: profile.responsibilities_summary,
          role_guidelines_summary: profile.role_guidelines_summary,
        }),
      )
      .catch(() => {});

    getCurrentPersona()
      .then(setCurrentPersona)
      .catch(() => {});
  }, [user]);

  const selectedCount = selectedIds.size;
  const canBuild = selectedCount > 0 && selectedCount <= 30;
  const canSaveProfile = Object.values(employeeProfile).every((value) => value.trim().length > 0);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()),
    [messages],
  );

  const loadMessages = async () => {
    setLoadingMessages(true);
    try {
      const result = await fetchPersonaSourceEmails();
      setMessages(
        result.messages.map((message) => ({
          id: message.id,
          subject: message.subject,
          snippet: message.snippet,
          date: message.date,
          from: message.from,
        })),
      );
      setSelectedIds(new Set(result.messages.slice(0, Math.min(10, result.messages.length)).map((message) => message.id)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load sent emails");
    } finally {
      setLoadingMessages(false);
    }
  };

  const toggleMessage = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 30) {
        next.add(id);
      } else {
        toast.error("You can select up to 30 emails.");
      }
      return next;
    });
  };

  const saveEmployee = async () => {
    if (!canSaveProfile) {
      toast.error("Complete the employee profile before saving.");
      return;
    }

    setSavingProfile(true);
    try {
      await upsertEmployeeProfile(employeeProfile);
      toast.success("Employee profile saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save employee profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleBuildPersona = async () => {
    setBuildingPersona(true);
    try {
      const selectedMessages = sortedMessages
        .filter((message) => selectedIds.has(message.id))
        .map((message) => ({
          gmail_message_id: message.id,
          subject: message.subject,
          snippet: message.snippet,
          from_email: message.from ?? null,
          direction: "sent",
          to_emails: [],
        }));

      const selection = await savePersonaSelection({
        persona_name: personaName,
        selected_messages: selectedMessages,
      });
      const persona = await buildPersona(selection.persona_profile_id);
      setCurrentPersona(persona);
      toast.success("Persona generated successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate persona");
    } finally {
      setBuildingPersona(false);
    }
  };

  return (
    <OnboardingLayout step={4} totalSteps={4} title="Define Persona">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-primary" />
              Employee Profile
            </CardTitle>
            <CardDescription>Role context is used alongside your writing persona when generating drafts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={employeeProfile.title} onChange={(e) => setEmployeeProfile((prev) => ({ ...prev, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={employeeProfile.department}
                  onChange={(e) => setEmployeeProfile((prev) => ({ ...prev, department: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="office_name">Office Name</Label>
              <Input
                id="office_name"
                value={employeeProfile.office_name}
                onChange={(e) => setEmployeeProfile((prev) => ({ ...prev, office_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsibilities_summary">Responsibilities Summary</Label>
              <Textarea
                id="responsibilities_summary"
                rows={4}
                value={employeeProfile.responsibilities_summary}
                onChange={(e) => setEmployeeProfile((prev) => ({ ...prev, responsibilities_summary: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role_guidelines_summary">Role Guidelines Summary</Label>
              <Textarea
                id="role_guidelines_summary"
                rows={4}
                value={employeeProfile.role_guidelines_summary}
                onChange={(e) => setEmployeeProfile((prev) => ({ ...prev, role_guidelines_summary: e.target.value }))}
              />
            </div>
            <Button type="button" onClick={saveEmployee} disabled={savingProfile || !canSaveProfile}>
              {savingProfile ? "Saving…" : "Save Employee Profile"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Persona From Gmail
            </CardTitle>
            <CardDescription>Select up to 30 sent emails so Relayr can build your writing persona without storing full bodies long-term.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {gmailConnected === false && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                <div className="font-medium">Gmail is not connected yet.</div>
                <div className="mt-1 text-muted-foreground">Connect Gmail before loading source emails for persona generation.</div>
                <Button className="mt-3" variant="outline" onClick={() => navigate("/connect-email")}>
                  <Mail className="mr-2 h-4 w-4" />
                  Connect Gmail
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="persona_name">Persona Name</Label>
              <Input id="persona_name" value={personaName} onChange={(e) => setPersonaName(e.target.value)} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={loadMessages} disabled={loadingMessages || gmailConnected !== true}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loadingMessages ? "animate-spin" : ""}`} />
                {loadingMessages ? "Loading Sent Emails…" : "Load Sent Emails"}
              </Button>
              <span className="text-sm text-muted-foreground">{selectedCount}/30 selected</span>
            </div>

            {messages.length > 0 && (
              <ScrollArea className="h-72 rounded-md border">
                <div className="space-y-2 p-3">
                  {sortedMessages.map((message) => {
                    const checked = selectedIds.has(message.id);
                    return (
                      <label key={message.id} className="flex cursor-pointer gap-3 rounded-md border p-3 hover:bg-accent/50">
                        <Checkbox checked={checked} onCheckedChange={() => toggleMessage(message.id)} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{message.subject || "(no subject)"}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{message.snippet || "No snippet available."}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">{message.date}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={handleBuildPersona} disabled={!canBuild || buildingPersona || gmailConnected !== true}>
                {buildingPersona ? "Building Persona…" : "Build Persona"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate("/inbox")}>
                Continue to Inbox
              </Button>
            </div>
          </CardContent>
        </Card>

        {currentPersona && (
          <Card>
            <CardHeader>
              <CardTitle>Current Persona</CardTitle>
              <CardDescription>Status: {currentPersona.status}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="font-medium">Tone</div>
                <div className="text-muted-foreground">{currentPersona.tone_summary || "No tone summary available."}</div>
              </div>
              <div>
                <div className="font-medium">Style</div>
                <div className="text-muted-foreground">{currentPersona.style_summary || "No style summary available."}</div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="font-medium">Greeting Patterns</div>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {currentPersona.greeting_patterns.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="font-medium">Sign-off Patterns</div>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {currentPersona.signoff_patterns.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </OnboardingLayout>
  );
}
