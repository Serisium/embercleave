import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type {
  BeforeAgentStartHandler,
  PiHostPort,
  PiToolDefinition,
  WorkerPiEvent,
} from "./pi-host.port.js";

/**
 * Adapter that translates pi's ExtensionAPI events into the narrow
 * {@link WorkerPiEvent} the worker use-cases consume, registers worker
 * tools, and bridges `before_agent_start` for snippet injection. The
 * only file in this package that imports `@mariozechner/pi-coding-agent`.
 */
export class PiHostAdapter implements PiHostPort {
  constructor(private readonly pi: ExtensionAPI) {}

  onEvent(handler: (event: WorkerPiEvent) => Promise<void> | void): void {
    const safe = async (event: WorkerPiEvent) => {
      try {
        await handler(event);
      } catch {
        // Worker errors must not crash the pi session.
      }
    };
    this.pi.on("session_start", () => safe({ type: "session_start", cwd: process.cwd() }));
    this.pi.on("agent_start", () => safe({ type: "agent_start" }));
    this.pi.on("agent_end", () => safe({ type: "agent_end" }));
    this.pi.on("tool_execution_start", (event) =>
      safe({ type: "tool_execution_start", toolName: event.toolName }),
    );
    this.pi.on("session_shutdown", () => safe({ type: "session_shutdown" }));
  }

  registerTool(def: PiToolDefinition): void {
    this.pi.registerTool({
      name: def.name,
      label: def.name,
      description: def.description,
      parameters: def.parameters,
      execute: async (_toolCallId, params) => {
        const text = await def.handler(params);
        return {
          content: [{ type: "text", text }],
          details: undefined,
        };
      },
    });
  }

  onBeforeAgentStart(handler: BeforeAgentStartHandler): void {
    this.pi.on("before_agent_start", async (event) => {
      try {
        const result = await handler({
          prompt: event.prompt,
          systemPrompt: event.systemPrompt,
        });
        if (result?.systemPrompt !== undefined) {
          return { systemPrompt: result.systemPrompt };
        }
        return undefined;
      } catch {
        return undefined;
      }
    });
  }

  sendUserMessage(text: string): void {
    this.pi.sendUserMessage(text);
  }
}
