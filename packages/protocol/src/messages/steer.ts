import { type Static, Type } from "typebox";

/**
 * manager → worker. Send a user message into the worker's pi session via
 * `pi.sendUserMessage` (arch.md:167).
 */
export const SteerSchema = Type.Object({
  kind: Type.Literal("steer"),
  message: Type.String(),
});

export type Steer = Static<typeof SteerSchema>;
