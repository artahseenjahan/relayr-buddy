import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Mail, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import AppLayout from "../components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { fetchMessageDetail, fetchThreadDetail } from "@/lib/gmailApi";
import { approveDraft, generateDraft, sendDraft, updateDraft } from "@/lib/draftApi";
import type { DraftResponseApi } from "@/types";

type ThreadMessage = {
  id: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  body?: string;
  snippet?: string;
};

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sourceMessageId = useMemo(() => (id || "").replace(/^gmail-/, ""), [id]);
  const [loadingMessage, setLoadingMessage] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<Record<string, unknown> | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState<DraftResponseApi | null>(null);
  const [draftBody, setDraftBody] = useState("");

  useEffect(() => {
    if (!sourceMessageId) return;
    setLoadingMessage(true);
    fetchMessageDetail(sourceMessageId)
      .then(async (result) => {
        setMessage(result);
        const threadId = String(result.thread_id || "");
        if (threadId) {
          try {
            const thread = await fetchThreadDetail(threadId);
            setThreadMessages((thread.messages as ThreadMessage[]) || []);
          } catch {
            setThreadMessages([]);
          }
        }
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to load message");
      })
      .finally(() => setLoadingMessage(false));
  }, [sourceMessageId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const nextDraft = await generateDraft({ source_gmail_message_id: sourceMessageId });
      setDraft(nextDraft);
      setDraftBody(nextDraft.draft_body);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      const updated = await updateDraft(draft.id, draftBody);
      setDraft(updated);
      toast.success("Draft updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update draft");
    }
  };

  const handleApprove = async () => {
    if (!draft) return;
    try {
      const approved = await approveDraft(draft.id);
      setDraft(approved);
      toast.success("Draft approved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve draft");
    }
  };

  const handleSend = async () => {
    if (!draft) return;
    setSending(true);
    try {
      const sent = await sendDraft(draft.id);
      setDraft(sent);
      if (sent.status === "sent") {
        toast.success("Draft sent successfully.");
        navigate("/inbox");
      } else {
        toast.error(sent.error_message || "Draft send failed.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send draft");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex h-full flex-col">
        <div className="border-b border-border bg-card px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/inbox")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Inbox
          </Button>
        </div>

        {loadingMessage ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[1fr_420px]">
            <Card className="min-h-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  {String(message?.subject || "(no subject)")}
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-0">
                <ScrollArea className="h-[calc(100vh-240px)]">
                  <div className="space-y-4 pr-4">
                    {threadMessages.length > 0 ? (
                      threadMessages.map((entry) => (
                        <div key={entry.id} className="rounded-md border p-4">
                          <div className="text-xs text-muted-foreground">
                            From: {entry.from || "Unknown"} · {entry.date || ""}
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-sm">{entry.body || entry.snippet || ""}</div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border p-4">
                        <div className="text-xs text-muted-foreground">From: {String(message?.from || "Unknown")}</div>
                        <div className="mt-2 whitespace-pre-wrap text-sm">{String(message?.body || message?.snippet || "")}</div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="min-h-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Draft
                </CardTitle>
              </CardHeader>
              <CardContent className="flex h-full flex-col gap-4">
                {!draft && (
                  <Button onClick={handleGenerate} disabled={generating}>
                    {generating ? "Generating…" : "Generate Draft"}
                  </Button>
                )}

                {draft && (
                  <>
                    <Textarea className="min-h-[280px] flex-1" value={draftBody} onChange={(e) => setDraftBody(e.target.value)} />
                    <div className="text-xs text-muted-foreground">Status: {draft.status}</div>
                    {draft.error_message && <div className="text-xs text-destructive">{draft.error_message}</div>}
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={handleSave}>
                        Save Draft
                      </Button>
                      <Button onClick={handleApprove} disabled={draft.status === "approved" || draft.status === "sent"}>
                        Approve
                      </Button>
                      <Button onClick={handleSend} disabled={draft.status !== "approved" || sending}>
                        <Send className="mr-2 h-4 w-4" />
                        {sending ? "Sending…" : "Send"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
