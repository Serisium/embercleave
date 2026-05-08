import { Type } from "typebox";

/**
 * Regex used by every package to validate an agentId before it lands in a
 * systemd unit name, container name, or filesystem path. Non-negotiable —
 * see arch.md:229-232.
 */
export const AGENT_ID_PATTERN = /^[a-z0-9-]+$/;

/** Returns true when `value` is a string matching {@link AGENT_ID_PATTERN}. */
export function isValidAgentId(value: unknown): value is string {
  return typeof value === "string" && AGENT_ID_PATTERN.test(value);
}

/** Typebox schema for an agentId; reused by every wire message that carries one. */
export const AgentIdSchema = Type.String({ pattern: AGENT_ID_PATTERN.source });
