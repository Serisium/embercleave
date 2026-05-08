import type { TSchema } from "typebox";
import { Value } from "typebox/value";
import { describe, expect, it } from "vitest";

import {
  AgentStatusSchema,
  BusMessageSchema,
  HandoffRequestSchema,
  PublishSchema,
  SnippetPushSchema,
  SteerSchema,
  SubscribeSchema,
  TopicMessageSchema,
  WorkerHelloSchema,
} from "../src/index.js";

interface Fixture {
  readonly name: string;
  readonly schema: TSchema;
  readonly value: unknown;
}

const fixtures: readonly Fixture[] = [
  {
    name: "worker_hello",
    schema: WorkerHelloSchema,
    value: {
      kind: "worker_hello",
      agentId: "alice",
      cwd: "/workspace",
      protocolVersion: "1.0.0",
    },
  },
  {
    name: "agent_status (thinking)",
    schema: AgentStatusSchema,
    value: { kind: "agent_status", agentId: "alice", status: "thinking" },
  },
  {
    name: "agent_status (idle)",
    schema: AgentStatusSchema,
    value: { kind: "agent_status", agentId: "bob", status: "idle" },
  },
  {
    name: "agent_status (tool)",
    schema: AgentStatusSchema,
    value: { kind: "agent_status", agentId: "charlie", status: "tool:Read" },
  },
  {
    name: "subscribe",
    schema: SubscribeSchema,
    value: { kind: "subscribe", agentId: "alice", topic: "build-results" },
  },
  {
    name: "publish",
    schema: PublishSchema,
    value: {
      kind: "publish",
      agentId: "alice",
      topic: "build-results",
      payload: { ok: true, durationMs: 1200 },
    },
  },
  {
    name: "topic_message",
    schema: TopicMessageSchema,
    value: {
      kind: "topic_message",
      topic: "build-results",
      payload: { ok: true },
      fromAgentId: "alice",
    },
  },
  {
    name: "snippet_push",
    schema: SnippetPushSchema,
    value: { kind: "snippet_push", snippetId: "s-7", content: "remember the cwd" },
  },
  {
    name: "steer",
    schema: SteerSchema,
    value: { kind: "steer", message: "stop and summarise" },
  },
  {
    name: "handoff_request",
    schema: HandoffRequestSchema,
    value: {
      kind: "handoff_request",
      agentId: "alice",
      reason: "needs human",
      context: "stuck on auth",
    },
  },
];

describe("bus message schemas", () => {
  for (const { name, schema, value } of fixtures) {
    it(`${name}: validates`, () => {
      expect(Value.Check(schema, value)).toBe(true);
    });

    it(`${name}: round-trips through Encode/Decode`, () => {
      const encoded = Value.Encode(schema, value);
      const decoded = Value.Decode(schema, encoded);
      expect(decoded).toEqual(value);
    });

    it(`${name}: matches BusMessage union`, () => {
      expect(Value.Check(BusMessageSchema, value)).toBe(true);
    });
  }

  it("rejects an unknown kind", () => {
    expect(Value.Check(BusMessageSchema, { kind: "nope" })).toBe(false);
  });

  it("rejects an invalid agentId on worker_hello", () => {
    const bad = {
      kind: "worker_hello",
      agentId: "Has Spaces",
      cwd: "/x",
      protocolVersion: "1.0.0",
    };
    expect(Value.Check(WorkerHelloSchema, bad)).toBe(false);
  });
});
