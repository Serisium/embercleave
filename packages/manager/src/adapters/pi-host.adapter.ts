import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { PiHostPort, PiToolDefinition } from "./pi-host.port.js";

const STATUS_WIDGET_KEY = "embercleave-status";

/**
 * Adapter that translates the manager's PiHostPort into pi's ExtensionAPI.
 * The only file in this package that imports `@mariozechner/pi-coding-agent`.
 */
export class PiHostAdapter implements PiHostPort {
  private capturedCtx: ExtensionContext | undefined;

  constructor(private readonly pi: ExtensionAPI) {
    // Capture the latest ctx on every event so widget updates work
    // outside of an active event handler.
    this.pi.on("session_start", (_event, ctx) => {
      this.capturedCtx = ctx;
    });
    this.pi.on("agent_start", (_event, ctx) => {
      this.capturedCtx = ctx;
    });
    this.pi.on("agent_end", (_event, ctx) => {
      this.capturedCtx = ctx;
    });
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

  log(message: string): void {
    process.stderr.write(`[@serisium/embercleave-manager] ${message}\n`);
  }

  sendUserMessage(text: string): void {
    this.pi.sendUserMessage(text);
  }

  setStatusWidget(content: readonly string[] | undefined): void {
    const ctx = this.capturedCtx;
    if (ctx === undefined || !ctx.hasUI) return;
    const value = content === undefined ? undefined : Array.from(content);
    ctx.ui.setWidget(STATUS_WIDGET_KEY, value, { placement: "aboveEditor" });
  }

  onSessionShutdown(handler: () => Promise<void> | void): void {
    this.pi.on("session_shutdown", async () => {
      await handler();
    });
  }
}
