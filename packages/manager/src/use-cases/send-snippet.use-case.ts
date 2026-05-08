import type { SnippetPush } from "@serisium/embercleave-protocol";
import type { BusServerPort } from "../adapters/bus-server.port.js";
import type { WorkerRegistry } from "../domain/worker-registry.js";

export interface SendSnippetDeps {
  readonly registry: WorkerRegistry;
  readonly busServer: BusServerPort;
}

export interface SendSnippetInput {
  readonly agentId: string;
  readonly snippetId: string;
  readonly content: string;
}

export type SendSnippetResult =
  | { readonly sent: true }
  | { readonly sent: false; readonly reason: "unknown_agent" };

/**
 * Push a `snippet_push` to a specific worker. The worker buffers it and
 * injects it on the next `before_agent_start` event (arch.md:163-166).
 */
export async function sendSnippet(
  deps: SendSnippetDeps,
  input: SendSnippetInput,
): Promise<SendSnippetResult> {
  const clientId = deps.registry.clientIdFor(input.agentId);
  if (clientId === undefined) {
    return { sent: false, reason: "unknown_agent" };
  }
  const message: SnippetPush = {
    kind: "snippet_push",
    snippetId: input.snippetId,
    content: input.content,
  };
  await deps.busServer.send(clientId, JSON.stringify(message));
  return { sent: true };
}
