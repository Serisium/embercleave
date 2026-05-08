import type { HandoffRequest } from "@serisium/embercleave-protocol";

export interface SurfaceHandoffDeps {
  readonly sendUserMessage: (text: string) => void;
}

/**
 * Surface a `handoff_request` to the manager's pi session as a synthetic
 * user message. The model sees it as if a human had typed it
 * (arch.md:188-194).
 */
export function surfaceHandoff(deps: SurfaceHandoffDeps, request: HandoffRequest): void {
  const text = [
    `[handoff request from ${request.agentId}]`,
    `reason: ${request.reason}`,
    "",
    request.context,
  ].join("\n");
  deps.sendUserMessage(text);
}
