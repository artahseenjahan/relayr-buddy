import { apiFetch } from "@/lib/apiClient";
import type { PersonaProfileApi } from "@/types";

export interface PersonaSelectableMessage {
  id: string;
  thread_id?: string;
  subject: string;
  snippet: string;
  date: string;
  from?: string;
  to?: string;
}

export interface PersonaSelectionInput {
  gmail_message_id: string;
  gmail_thread_id?: string | null;
  direction?: string;
  from_email?: string | null;
  to_emails?: string[];
  subject?: string | null;
  snippet?: string | null;
}

export async function fetchPersonaSourceEmails(): Promise<{ messages: PersonaSelectableMessage[]; max_selection: number }> {
  return apiFetch("/api/persona/source-emails");
}

export async function savePersonaSelection(input: {
  persona_name?: string | null;
  selected_messages: PersonaSelectionInput[];
}): Promise<{ persona_profile_id: string; source_email_count: number; status: string }> {
  return apiFetch("/api/persona/selection", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function buildPersona(persona_profile_id?: string): Promise<PersonaProfileApi> {
  await apiFetch("/api/persona/build", {
    method: "POST",
    body: JSON.stringify({ persona_profile_id: persona_profile_id ?? null }),
  });
  return getCurrentPersona();
}

export async function getCurrentPersona(): Promise<PersonaProfileApi> {
  return apiFetch("/api/persona/current");
}
