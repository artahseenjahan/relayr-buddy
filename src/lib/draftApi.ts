import { apiFetch } from "@/lib/apiClient";
import type { DraftResponseApi } from "@/types";

export async function generateDraft(input: {
  source_gmail_message_id: string;
  persona_profile_id?: string | null;
  employee_profile_id?: string | null;
}): Promise<DraftResponseApi> {
  return apiFetch("/api/draft/generate", {
    method: "POST",
    body: JSON.stringify({
      source_gmail_message_id: input.source_gmail_message_id,
      persona_profile_id: input.persona_profile_id ?? null,
      employee_profile_id: input.employee_profile_id ?? null,
    }),
  });
}

export async function getDraft(draftId: string): Promise<DraftResponseApi> {
  return apiFetch(`/api/draft/${draftId}`);
}

export async function updateDraft(draftId: string, draft_body: string): Promise<DraftResponseApi> {
  return apiFetch(`/api/draft/${draftId}`, {
    method: "PATCH",
    body: JSON.stringify({ draft_body }),
  });
}

export async function approveDraft(draftId: string): Promise<DraftResponseApi> {
  return apiFetch(`/api/draft/${draftId}/approve`, { method: "POST" });
}

export async function sendDraft(draftId: string): Promise<DraftResponseApi> {
  return apiFetch(`/api/draft/${draftId}/send`, { method: "POST" });
}
