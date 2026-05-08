import {
  type BusMessage,
  BusMessageSchema,
  type SnippetPush,
} from "@serisium/embercleave-protocol";
import { Value } from "typebox/value";

export interface DispatchIncomingMessageDeps {
  readonly onTopicMessage: (topic: string, payload: unknown, fromAgentId: string) => void;
  readonly onSnippetPush: (snippet: SnippetPush) => void;
  readonly onSteer: (message: string) => void;
  readonly log: (message: string) => void;
}

export interface DispatchIncomingMessageInput {
  readonly line: string;
}

/**
 * Parse a JSONL line from the manager and route by `kind`. The worker
 * only accepts manager → worker kinds; receiving anything else is a
 * protocol violation and is logged.
 */
export function dispatchIncomingMessage(
  deps: DispatchIncomingMessageDeps,
  input: DispatchIncomingMessageInput,
): void {
  const message = parse(input.line);
  if (message === undefined) {
    deps.log("bus rx: invalid bus message; dropped");
    return;
  }
  switch (message.kind) {
    case "topic_message":
      deps.onTopicMessage(message.topic, message.payload, message.fromAgentId);
      return;
    case "snippet_push":
      deps.onSnippetPush(message);
      return;
    case "steer":
      deps.onSteer(message.message);
      return;
    case "worker_hello":
    case "agent_status":
    case "subscribe":
    case "publish":
    case "handoff_request":
      // worker → manager kinds; receiving them on the worker is a violation.
      deps.log(`bus rx: unexpected kind ${message.kind}`);
      return;
  }
}

function parse(line: string): BusMessage | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!Value.Check(BusMessageSchema, value)) return undefined;
  return value as BusMessage;
}
