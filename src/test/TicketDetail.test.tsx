import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { AppProvider } from "@/context/AppContext";
import TicketDetail from "@/pages/TicketDetail";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const fetchMessageDetail = vi.fn();
const fetchThreadDetail = vi.fn();
const generateDraft = vi.fn();
const approveDraft = vi.fn();
const sendDraft = vi.fn();

vi.mock("@/lib/gmailApi", () => ({
  fetchMessageDetail: (...args: unknown[]) => fetchMessageDetail(...args),
  fetchThreadDetail: (...args: unknown[]) => fetchThreadDetail(...args),
}));

vi.mock("@/lib/draftApi", () => ({
  generateDraft: (...args: unknown[]) => generateDraft(...args),
  approveDraft: (...args: unknown[]) => approveDraft(...args),
  sendDraft: (...args: unknown[]) => sendDraft(...args),
  updateDraft: vi.fn(async (_id: string, body: string) => ({
    id: "draft-1",
    status: "draft",
    draft_body: body,
    subject: "Subject",
    recipient_email: "student@example.edu",
    generation_context: {},
  })),
}));

describe("TicketDetail", () => {
  it("generates, approves, and sends a draft", async () => {
    fetchMessageDetail.mockResolvedValue({
      id: "abc123",
      subject: "Need help",
      from: "Student <student@example.edu>",
      body: "Can you help?",
      thread_id: "thread-1",
    });
    fetchThreadDetail.mockResolvedValue({
      messages: [{ id: "abc123", from: "Student", date: "2026-04-23", body: "Can you help?" }],
    });
    generateDraft.mockResolvedValue({
      id: "draft-1",
      status: "draft",
      draft_body: "Sure, happy to help.",
      subject: "Need help",
      recipient_email: "student@example.edu",
      generation_context: {},
    });
    approveDraft.mockResolvedValue({
      id: "draft-1",
      status: "approved",
      draft_body: "Sure, happy to help.",
      subject: "Need help",
      recipient_email: "student@example.edu",
      generation_context: {},
    });
    sendDraft.mockResolvedValue({
      id: "draft-1",
      status: "sent",
      draft_body: "Sure, happy to help.",
      subject: "Need help",
      recipient_email: "student@example.edu",
      generation_context: {},
    });

    render(
      <MemoryRouter initialEntries={["/ticket/gmail-abc123"]}>
        <AppProvider>
          <Routes>
            <Route path="/ticket/:id" element={<TicketDetail />} />
          </Routes>
        </AppProvider>
      </MemoryRouter>,
    );

    await screen.findByText("Need help");
    fireEvent.click(screen.getByRole("button", { name: /generate draft/i }));
    await screen.findByDisplayValue("Sure, happy to help.");
    fireEvent.click(screen.getByRole("button", { name: /^approve$/i }));
    await waitFor(() => expect(approveDraft).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(sendDraft).toHaveBeenCalled());
  });
});
