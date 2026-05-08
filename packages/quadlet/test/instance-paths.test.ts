import { describe, expect, it } from "vitest";
import { instancePaths } from "../src/domain/instance-paths.js";

describe("instancePaths", () => {
  it("places the env file under ~/.config/embercleave/instances/", () => {
    const p = instancePaths("alice", "/home/swarm");
    expect(p.envFile).toBe("/home/swarm/.config/embercleave/instances/alice.env");
  });

  it("places the workspace under ~/embercleave/workspaces/", () => {
    const p = instancePaths("alice", "/home/swarm");
    expect(p.workspaceDir).toBe("/home/swarm/embercleave/workspaces/alice");
  });
});
