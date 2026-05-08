import { describe, expect, it } from "vitest";
import { TopicRouter } from "../src/domain/topic-router.js";
import { WorkerRegistry } from "../src/domain/worker-registry.js";
import { listWorkers } from "../src/use-cases/list-workers.use-case.js";

const hello = (agentId: string, cwd = "/work") => ({
  kind: "worker_hello" as const,
  agentId,
  cwd,
  protocolVersion: "1.0.0",
});

describe("listWorkers", () => {
  it("returns one row per known worker, sorted by agentId", () => {
    const registry = new WorkerRegistry();
    const router = new TopicRouter();
    registry.acceptHello("c1", hello("alice"), 1000);
    registry.acceptHello("c2", hello("bob"), 2000);
    registry.setStatus("c1", "thinking", 1500);
    router.subscribe("c1", "build");

    const out = listWorkers({ registry, router }, { now: 3000 });
    expect(out.map((w) => w.agentId)).toEqual(["alice", "bob"]);
    expect(out[0]).toEqual({
      agentId: "alice",
      connected: true,
      cwd: "/work",
      status: "thinking",
      topics: ["build"],
      lastSeenMsAgo: 1500,
    });
  });

  it("reports unknown status and no topics for a never-seen worker", () => {
    const registry = new WorkerRegistry();
    registry.upsertUnreachable("ghost", 1000);
    const out = listWorkers({ registry, router: new TopicRouter() }, { now: 2000 });
    expect(out[0]?.connected).toBe(false);
    expect(out[0]?.status).toBe("unknown");
    expect(out[0]?.topics).toEqual([]);
  });
});
