import type { BusServerPort } from "../adapters/bus-server.port.js";

export interface BindBusInput {
  readonly socketPath: string;
  readonly onClient: (clientId: string) => void;
  readonly onClose: (clientId: string) => void;
  readonly onMessage: (clientId: string, line: string) => void;
}

export interface BindBusUseCaseDeps {
  readonly busServer: BusServerPort;
}

/**
 * Bind the bus UDS at `socketPath`. Failure here must crash the manager
 * loudly; another running manager would corrupt the swarm registry
 * (arch.md:182-184).
 */
export async function bindBus(deps: BindBusUseCaseDeps, input: BindBusInput): Promise<void> {
  await deps.busServer.bind(input.socketPath, {
    onClient: input.onClient,
    onClose: input.onClose,
    onMessage: input.onMessage,
  });
}
