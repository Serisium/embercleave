import type { TSchema } from "typebox";

/**
 * Tool the manager extension exposes to its own LLM. Parameters are
 * validated by pi against the Typebox schema; the handler receives the
 * validated value as `unknown` and casts.
 */
export interface PiToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: TSchema;
  readonly handler: (params: unknown) => Promise<string>;
}

/**
 * Surface of the pi runtime that the manager use-cases depend on. Keeps
 * the pi package import quarantined to `pi-host.adapter.ts`.
 */
export interface PiHostPort {
  registerTool(definition: PiToolDefinition): void;
  log(message: string): void;
  /** Inject a synthetic user message into the manager's pi session. */
  sendUserMessage(text: string): void;
  /** Render or update the status widget. Pass `undefined` to clear. */
  setStatusWidget(content: readonly string[] | undefined): void;
  onSessionShutdown(handler: () => Promise<void> | void): void;
}
