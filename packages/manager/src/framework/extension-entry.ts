import type { ExtensionAPI, ExtensionFactory } from "@mariozechner/pi-coding-agent";
import { AGENT_ID_PATTERN } from "@serisium/embercleave-protocol";
import { type Static, Type } from "typebox";
import { BusServerAdapter } from "../adapters/bus-server.adapter.js";
import { JournaldAdapter } from "../adapters/journald.adapter.js";
import { PiHostAdapter } from "../adapters/pi-host.adapter.js";
import { PodmanAdapter } from "../adapters/podman.adapter.js";
import { SystemdUnitsAdapter } from "../adapters/systemd-units.adapter.js";
import { TopicRouter } from "../domain/topic-router.js";
import { WorkerRegistry } from "../domain/worker-registry.js";
import { bindBus } from "../use-cases/bind-bus.use-case.js";
import { dispatchBusMessage } from "../use-cases/dispatch-bus-message.use-case.js";
import { inspectWorker } from "../use-cases/inspect-worker.use-case.js";
import { listWorkers } from "../use-cases/list-workers.use-case.js";
import { readWorkerLogs } from "../use-cases/read-worker-logs.use-case.js";
import { reconcileOnStartup } from "../use-cases/reconcile-on-startup.use-case.js";
import { renderStatusWidget } from "../use-cases/render-status-widget.use-case.js";
import { sendSnippet } from "../use-cases/send-snippet.use-case.js";
import { steerWorker } from "../use-cases/steer-worker.use-case.js";

const DEFAULT_SOCKET_PATH = process.env.EMBERCLEAVE_SOCKET ?? "/run/embercleave/bus.sock";

const NoArgs = Type.Object({});

const SendSnippetParams = Type.Object({
  agentId: Type.String({ pattern: AGENT_ID_PATTERN.source }),
  snippetId: Type.String(),
  content: Type.String(),
});
type SendSnippetParamsType = Static<typeof SendSnippetParams>;

const SteerParams = Type.Object({
  agentId: Type.String({ pattern: AGENT_ID_PATTERN.source }),
  message: Type.String(),
});
type SteerParamsType = Static<typeof SteerParams>;

const LogsParams = Type.Object({
  agentId: Type.String({ pattern: AGENT_ID_PATTERN.source }),
  lines: Type.Optional(Type.Number({ minimum: 1, maximum: 5000 })),
});
type LogsParamsType = Static<typeof LogsParams>;

const InspectParams = Type.Object({
  agentId: Type.String({ pattern: AGENT_ID_PATTERN.source }),
});
type InspectParamsType = Static<typeof InspectParams>;

const setupManager: ExtensionFactory = (pi: ExtensionAPI) => {
  const piHost = new PiHostAdapter(pi);
  const busServer = new BusServerAdapter();
  const router = new TopicRouter();
  const registry = new WorkerRegistry();
  const systemd = new SystemdUnitsAdapter();
  const journald = new JournaldAdapter();
  const podman = new PodmanAdapter();
  const log = (message: string) => piHost.log(message);
  const now = () => Date.now();

  const refreshWidget = () => {
    renderStatusWidget({
      registry,
      setWidget: (content) => piHost.setStatusWidget(content),
      now,
    });
  };

  pi.on("session_start", async () => {
    try {
      await bindBus(
        { busServer },
        {
          socketPath: DEFAULT_SOCKET_PATH,
          onClient: (id) => {
            log(`bus connection accepted: ${id}`);
            refreshWidget();
          },
          onClose: (id) => {
            router.forgetClient(id);
            registry.forgetClient(id, now());
            log(`bus connection closed: ${id}`);
            refreshWidget();
          },
          onMessage: (clientId, line) => {
            void dispatchBusMessage(
              {
                registry,
                router,
                busServer,
                log,
                now,
                sendUserMessage: (text) => piHost.sendUserMessage(text),
                onStateChange: refreshWidget,
              },
              { clientId, line },
            );
          },
        },
      );
      log(`bus listening on ${DEFAULT_SOCKET_PATH}`);
      try {
        const discovered = await reconcileOnStartup({ systemd, registry, now });
        if (discovered.length > 0) {
          log(
            `reconciled ${discovered.length} running unit(s) from systemd: ${discovered.join(", ")}`,
          );
        }
      } catch (err) {
        // systemctl may be unavailable in dev environments — non-fatal.
        log(`reconciliation skipped: ${err instanceof Error ? err.message : String(err)}`);
      }
      refreshWidget();
    } catch (err) {
      log(`failed to bind bus: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  });

  piHost.onSessionShutdown(async () => {
    await busServer.close();
  });

  piHost.registerTool({
    name: "swarm_list",
    description:
      "List every worker known to the swarm with its agentId, connection state, status, current cwd, subscribed topics, and how long ago it was last seen. Returns JSON.",
    parameters: NoArgs,
    handler: async () => JSON.stringify(listWorkers({ registry, router }, { now: now() }), null, 2),
  });

  piHost.registerTool({
    name: "swarm_send_snippet",
    description:
      "Push a context snippet to a specific worker agent. The worker buffers it and injects it on the next turn's system prompt, wrapped in a <context-snippet> tag. Returns 'ok' or 'unknown_agent: <agentId>'.",
    parameters: SendSnippetParams,
    handler: async (raw) => {
      const params = raw as SendSnippetParamsType;
      const result = await sendSnippet(
        { registry, busServer },
        {
          agentId: params.agentId,
          snippetId: params.snippetId,
          content: params.content,
        },
      );
      return result.sent ? "ok" : `unknown_agent: ${params.agentId}`;
    },
  });

  piHost.registerTool({
    name: "swarm_steer",
    description:
      "Send a synthetic user message into a specific worker's pi session. The worker will pass it to pi.sendUserMessage. Returns 'ok' or an error reason.",
    parameters: SteerParams,
    handler: async (raw) => {
      const params = raw as SteerParamsType;
      const result = await steerWorker(
        { registry, busServer },
        { agentId: params.agentId, message: params.message },
      );
      if (result.sent) return "ok";
      return result.reason === "unknown_agent"
        ? `unknown_agent: ${params.agentId}`
        : `not_connected: ${params.agentId}`;
    },
  });

  piHost.registerTool({
    name: "swarm_logs",
    description:
      "Read the last N journald lines for a worker's systemd unit. Default: 100 lines. Returns plain text (one log line per output line).",
    parameters: LogsParams,
    handler: async (raw) => {
      const params = raw as LogsParamsType;
      const lines = params.lines ?? 100;
      try {
        const result = await readWorkerLogs({ journald }, { agentId: params.agentId, lines });
        if (!result.read) return `invalid_agent_id: ${params.agentId}`;
        return result.lines.join("\n");
      } catch (err) {
        return `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  piHost.registerTool({
    name: "swarm_inspect",
    description:
      "Run `podman inspect` on a worker's container and return the JSON. Useful for debugging mounts, resource limits, restart counts. Returns JSON or an error reason.",
    parameters: InspectParams,
    handler: async (raw) => {
      const params = raw as InspectParamsType;
      try {
        const result = await inspectWorker({ podman }, { agentId: params.agentId });
        if (!result.inspected) return `invalid_agent_id: ${params.agentId}`;
        return JSON.stringify(result.data, null, 2);
      } catch (err) {
        return `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
};

export default setupManager;
