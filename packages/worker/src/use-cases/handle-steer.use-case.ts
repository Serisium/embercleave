import type { PiHostPort } from "../adapters/pi-host.port.js";

export interface HandleSteerDeps {
  readonly piHost: PiHostPort;
}

/**
 * Handle an incoming `steer` by injecting the message text as a synthetic
 * user message via `pi.sendUserMessage` (arch.md:167).
 */
export function handleSteer(deps: HandleSteerDeps, message: string): void {
  deps.piHost.sendUserMessage(message);
}
