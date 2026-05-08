import type { TSchema } from "typebox";

export interface PiToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: TSchema;
  readonly handler: (params: unknown) => Promise<string>;
}

/**
 * Surface of the pi runtime that the quadlet use-cases depend on. Keeps
 * the pi import quarantined to `pi-host.adapter.ts`.
 */
export interface PiHostPort {
  registerTool(definition: PiToolDefinition): void;
  log(message: string): void;
}
