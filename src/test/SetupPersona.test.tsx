import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import SetupPersona from "@/pages/SetupPersona";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const checkGmailConnection = vi.fn();
const fetchPersonaSourceEmails = vi.fn();
const savePersonaSelection = vi.fn();
const buildPersona = vi.fn();
const getCurrentPersona = vi.fn();
const getEmployeeProfile = vi.fn();
const upsertEmployeeProfile = vi.fn();

vi.mock("@/lib/gmailApi", () => ({
  checkGmailConnection: (...args: unknown[]) => checkGmailConnection(...args),
}));

vi.mock("@/lib/personaApi", () => ({
  fetchPersonaSourceEmails: (...args: unknown[]) => fetchPersonaSourceEmails(...args),
  savePersonaSelection: (...args: unknown[]) => savePersonaSelection(...args),
  buildPersona: (...args: unknown[]) => buildPersona(...args),
  getCurrentPersona: (...args: unknown[]) => getCurrentPersona(...args),
}));

vi.mock("@/lib/employeeProfileApi", () => ({
  getEmployeeProfile: (...args: unknown[]) => getEmployeeProfile(...args),
  upsertEmployeeProfile: (...args: unknown[]) => upsertEmployeeProfile(...args),
}));

describe("SetupPersona", () => {
  it("loads sent emails and builds a persona", async () => {
    checkGmailConnection.mockResolvedValue({ connected: true });
    getEmployeeProfile.mockRejectedValue(new Error("missing"));
    getCurrentPersona.mockRejectedValue(new Error("missing"));
    fetchPersonaSourceEmails.mockResolvedValue({
      max_selection: 30,
      messages: [
        { id: "msg-1", subject: "Welcome", snippet: "Thanks for reaching out", date: "2026-04-20" },
        { id: "msg-2", subject: "Follow up", snippet: "Please let me know", date: "2026-04-21" },
      ],
    });
    savePersonaSelection.mockResolvedValue({ persona_profile_id: "persona-1", source_email_count: 2, status: "draft" });
    buildPersona.mockResolvedValue({
      id: "persona-1",
      name: "Primary Persona",
      tone_summary: "Warm and concise",
      style_summary: "Friendly and direct",
      greeting_patterns: ["Hi"],
      signoff_patterns: ["Best"],
      length_preference: "medium",
      formatting_preferences: {},
      preferred_phrases: ["Please let me know"],
      do_not_use_phrases: [],
      source_email_count: 2,
      status: "ready",
    });

    render(
      <MemoryRouter>
        <SetupPersona />
      </MemoryRouter>,
    );

    const loadEmailsButton = await screen.findByRole("button", { name: /load sent emails/i });
    await waitFor(() => expect(loadEmailsButton).not.toBeDisabled());

    fireEvent.click(loadEmailsButton);
    await waitFor(() => expect(fetchPersonaSourceEmails).toHaveBeenCalled());
    expect(await screen.findByText("2/30 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /build persona/i }));

    await waitFor(() => expect(buildPersona).toHaveBeenCalled());
    expect(await screen.findByText("Current Persona")).toBeInTheDocument();
    expect(screen.getByText("Warm and concise")).toBeInTheDocument();
  });
});
