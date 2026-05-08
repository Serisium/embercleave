import { describe, expect, it, vi } from "vitest";
import { dispatchIncomingMessage } from "../src/use-cases/dispatch-incoming-message.use-case.js";

const stubDeps = () => ({
  onTopicMessage: vi.fn(),
  onSnippetPush: vi.fn(),
  onSteer: vi.fn(),
  log: vi.fn(),
});

describe("dispatchIncomingMessage", () => {
  it("delivers a topic_message to onTopicMessage", () => {
    const deps = stubDeps();
    dispatchIncomingMessage(deps, {
      line: JSON.stringify({
        kind: "topic_message",
        topic: "build",
        payload: { ok: true },
        fromAgentId: "alice",
      }),
    });
    expect(deps.onTopicMessage).toHaveBeenCalledWith("build", { ok: true }, "alice");
    expect(deps.log).not.toHaveBeenCalled();
  });

  it("delivers a snippet_push to onSnippetPush", () => {
    const deps = stubDeps();
    dispatchIncomingMessage(deps, {
      line: JSON.stringify({
        kind: "snippet_push",
        snippetId: "s1",
        content: "hello",
      }),
    });
    expect(deps.onSnippetPush).toHaveBeenCalledOnce();
    expect(deps.onSnippetPush.mock.calls[0]?.[0]).toMatchObject({
      kind: "snippet_push",
      snippetId: "s1",
      content: "hello",
    });
  });

  it("delivers a steer to onSteer with the payload message", () => {
    const deps = stubDeps();
    dispatchIncomingMessage(deps, {
      line: JSON.stringify({ kind: "steer", message: "stop" }),
    });
    expect(deps.onSteer).toHaveBeenCalledWith("stop");
  });

  it("drops invalid JSON and logs", () => {
    const deps = stubDeps();
    dispatchIncomingMessage(deps, { line: "{not json" });
    expect(deps.log).toHaveBeenCalledOnce();
  });

  it("drops a worker → manager kind arriving at the worker", () => {
    const deps = stubDeps();
    dispatchIncomingMessage(deps, {
      line: JSON.stringify({
        kind: "worker_hello",
        agentId: "alice",
        cwd: "/x",
        protocolVersion: "1.0.0",
      }),
    });
    expect(deps.log.mock.calls[0]?.[0]).toContain("unexpected kind worker_hello");
  });
});
