import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { PiHostPort, PiToolDefinition } from "./pi-host.port.js";

/**
 * The only file in this package that imports `@mariozechner/pi-coding-agent`.
 */
export class PiHostAdapter implements PiHostPort {
  constructor(private readonly pi: ExtensionAPI) {}

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
    process.stderr.write(`[@serisium/embercleave-quadlet] ${message}\n`);
  }
}
