import { PROTOCOL_VERSION, type WorkerHello } from "@serisium/embercleave-protocol";
import type { BusClientPort } from "../adapters/bus-client.port.js";

export interface ConnectToBusInput {
  readonly socketPath: string;
  readonly agentId: string;
  readonly cwd: string;
  readonly onMessage: (line: string) => void;
  readonly onConnected?: () => void;
  readonly onDisconnected?: () => void;
}

export interface ConnectToBusDeps {
  readonly busClient: BusClientPort;
}

/**
 * Begin the bus client's connect/reconnect loop. On every successful
 * connect, sends a `worker_hello` (arch.md:154-157) so the manager knows
 * who's at the other end of the new socket.
 */
export async function connectToBus(
  deps: ConnectToBusDeps,
  input: ConnectToBusInput,
): Promise<void> {
  await deps.busClient.connect(input.socketPath, {
    onConnect: async () => {
      const hello: WorkerHello = {
        kind: "worker_hello",
        agentId: input.agentId,
        cwd: input.cwd,
        protocolVersion: PROTOCOL_VERSION,
      };
      await deps.busClient.send(JSON.stringify(hello));
      input.onConnected?.();
    },
    onDisconnect: () => {
      input.onDisconnected?.();
    },
    onMessage: input.onMessage,
  });
}
