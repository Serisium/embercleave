import { describe, expect, it, vi } from "vitest";
import { surfaceHandoff } from "../src/use-cases/surface-handoff.use-case.js";

describe("surfaceHandoff", () => {
  it("calls sendUserMessage with a formatted block referencing the originator", () => {
    const sendUserMessage = vi.fn();
    surfaceHandoff(
      { sendUserMessage },
      {
        kind: "handoff_request",
        agentId: "alice",
        reason: "stuck on auth",
        context: "tried two providers, both 401",
      },
    );
    expect(sendUserMessage).toHaveBeenCalledOnce();
    const text = sendUserMessage.mock.calls[0]?.[0] as string;
    expect(text).toContain("[handoff request from alice]");
    expect(text).toContain("reason: stuck on auth");
    expect(text).toContain("tried two providers, both 401");
  });
});
