import type { ExtensionAPI, ExtensionFactory } from "@mariozechner/pi-coding-agent";
import { isValidAgentId } from "@serisium/embercleave-protocol";
import { type Static, Type } from "typebox";
import { BusClientAdapter } from "../adapters/bus-client.adapter.js";
import { PiHostAdapter } from "../adapters/pi-host.adapter.js";
import { SnippetBuffer } from "../domain/snippet-buffer.js";
import { bufferSnippet } from "../use-cases/buffer-snippet.use-case.js";
import { connectToBus } from "../use-cases/connect-to-bus.use-case.js";
import { dispatchIncomingMessage } from "../use-cases/dispatch-incoming-message.use-case.js";
import { flushSnippetsOnTurn } from "../use-cases/flush-snippets-on-turn.use-case.js";
import { forwardAgentStatus } from "../use-cases/forward-agent-status.use-case.js";
import { handleSteer } from "../use-cases/handle-steer.use-case.js";
import { publishToTopic } from "../use-cases/publish-to-topic.use-case.js";
import { requestHandoff } from "../use-cases/request-handoff.use-case.js";
import { subscribeToTopic } from "../use-cases/subscribe-to-topic.use-case.js";

const DEFAULT_SOCKET_PATH = process.env.EMBERCLEAVE_SOCKET ?? "/run/embercleave/bus.sock";
const RAW_AGENT_ID = process.env.EMBERCLEAVE_AGENT_ID ?? `embercleave-${process.pid}`;
const AGENT_ID = isValidAgentId(RAW_AGENT_ID) ? RAW_AGENT_ID : `embercleave-${process.pid}`;

const log = (message: string): void => {
  process.stderr.write(`[@serisium/embercleave-worker ${AGENT_ID}] ${message}\n`);
};

const PublishParams = Type.Object({
  topic: Type.String(),
  payload: Type.Unknown(),
});
type PublishParamsType = Static<typeof PublishParams>;

const SubscribeParams = Type.Object({
  topic: Type.String(),
});
type SubscribeParamsType = Static<typeof SubscribeParams>;

const HandoffParams = Type.Object({
  reason: Type.String(),
  context: Type.String(),
});
type HandoffParamsType = Static<typeof HandoffParams>;

const setupWorker: ExtensionFactory = (pi: ExtensionAPI) => {
  const piHost = new PiHostAdapter(pi);
  const busClient = new BusClientAdapter();
  const snippetBuffer = new SnippetBuffer();

  let started = false;

  piHost.onEvent(async (event) => {
    if (event.type === "session_start" && !started) {
      started = true;
      await connectToBus(
        { busClient },
        {
          socketPath: DEFAULT_SOCKET_PATH,
          agentId: AGENT_ID,
          cwd: event.cwd,
          onMessage: (line) =>
            dispatchIncomingMessage(
              {
                log,
                onTopicMessage: (topic, payload, fromAgentId) =>
                  log(
                    `topic_message ${topic} from ${fromAgentId}: ${JSON.stringify(payload).slice(0, 200)}`,
                  ),
                onSnippetPush: (snippet) => {
                  bufferSnippet({ buffer: snippetBuffer }, snippet);
                  log(`buffered snippet ${snippet.snippetId} (${snippet.content.length} bytes)`);
                },
                onSteer: (message) => {
                  handleSteer({ piHost }, message);
                  log(`steer applied: ${message.slice(0, 80)}`);
                },
              },
              { line },
            ),
          onConnected: () => log(`connected to ${DEFAULT_SOCKET_PATH}`),
          onDisconnected: () => log(`disconnected from ${DEFAULT_SOCKET_PATH}`),
        },
      );
      return;
    }
    if (event.type === "session_shutdown") {
      await busClient.close();
      return;
    }
    await forwardAgentStatus({ busClient }, { agentId: AGENT_ID, event });
  });

  piHost.onBeforeAgentStart((ctx) => {
    const result = flushSnippetsOnTurn(
      { buffer: snippetBuffer },
      { currentSystemPrompt: ctx.systemPrompt },
    );
    if (result.augmentedSystemPrompt !== undefined) {
      log("flushed snippet(s) into system prompt");
      return { systemPrompt: result.augmentedSystemPrompt };
    }
    return undefined;
  });

  piHost.registerTool({
    name: "swarm_publish",
    description:
      "Publish a JSON payload to a swarm topic. Other workers subscribed to the topic will receive it. Returns 'ok' on success or an error string when the bus is unreachable.",
    parameters: PublishParams,
    handler: async (raw) => {
      const { topic, payload } = raw as PublishParamsType;
      try {
        await publishToTopic({ busClient }, { agentId: AGENT_ID, topic, payload });
        return "ok";
      } catch (err) {
        return `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  piHost.registerTool({
    name: "swarm_subscribe",
    description:
      "Subscribe to a swarm topic. Subsequent topic messages will arrive on the bus. Returns 'ok' on success or an error string when the bus is unreachable.",
    parameters: SubscribeParams,
    handler: async (raw) => {
      const { topic } = raw as SubscribeParamsType;
      try {
        await subscribeToTopic({ busClient }, { agentId: AGENT_ID, topic });
        return "ok";
      } catch (err) {
        return `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  piHost.registerTool({
    name: "swarm_request_handoff",
    description:
      "Escalate to the manager: emit a handoff_request with a reason and a context blob. The manager surfaces it as a synthetic user message in its own session. Returns 'ok' on success or an error string when the bus is unreachable.",
    parameters: HandoffParams,
    handler: async (raw) => {
      const { reason, context } = raw as HandoffParamsType;
      try {
        await requestHandoff({ busClient }, { agentId: AGENT_ID, reason, context });
        return "ok";
      } catch (err) {
        return `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
};

export default setupWorker;
