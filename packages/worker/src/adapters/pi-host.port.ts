import type { TSchema } from "typebox";

/** Subset of pi lifecycle events the worker derives wire status from. */
export type WorkerPiEvent =
  | { type: "session_start"; cwd: string }
  | { type: "agent_start" }
  | { type: "agent_end" }
  | { type: "tool_execution_start"; toolName: string }
  | { type: "session_shutdown" };

/**
 * Worker LLM tool. Parameters are validated by pi against the Typebox
 * schema; the handler receives the validated value as `unknown` and casts.
 */
export interface PiToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: TSchema;
  readonly handler: (params: unknown) => Promise<string>;
}

/** Pre-turn context exposed to {@link PiHostPort.onBeforeAgentStart}. */
export interface BeforeAgentStartContext {
  readonly prompt: string;
  readonly systemPrompt: string;
}

/**
 * Result of a {@link PiHostPort.onBeforeAgentStart} handler. When
 * `systemPrompt` is set, pi replaces the system prompt for this turn
 * (e.g. to inject buffered snippets). arch.md:163-166.
 */
export interface BeforeAgentStartResult {
  readonly systemPrompt?: string;
}

export type BeforeAgentStartHandler = (
  ctx: BeforeAgentStartContext,
) => BeforeAgentStartResult | undefined | Promise<BeforeAgentStartResult | undefined>;

/**
 * Surface of the pi runtime that the worker use-cases depend on. Keeps
 * the pi import quarantined to `pi-host.adapter.ts`.
 */
export interface PiHostPort {
  onEvent(handler: (event: WorkerPiEvent) => Promise<void> | void): void;
  registerTool(definition: PiToolDefinition): void;
  /** Subscribe to `before_agent_start` and optionally augment the turn. */
  onBeforeAgentStart(handler: BeforeAgentStartHandler): void;
  /** Inject a synthetic user message into the worker's pi session. */
  sendUserMessage(text: string): void;
}
