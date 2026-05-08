import type { WorkerHello } from "@serisium/embercleave-protocol";
import { describe, expect, it } from "vitest";
import { WorkerRegistry } from "../src/domain/worker-registry.js";

const HELLO = (agentId: string, cwd = "/workspace"): WorkerHello => ({
  kind: "worker_hello",
  agentId,
  cwd,
  protocolVersion: "1.0.0",
});

describe("WorkerRegistry", () => {
  it("acceptHello binds clientId ↔ agentId and stores cwd", () => {
    const reg = new WorkerRegistry();
    reg.acceptHello("c1", HELLO("alice", "/work/alice"), 1000);
    expect(reg.agentIdFor("c1")).toBe("alice");
    expect(reg.clientIdFor("alice")).toBe("c1");
    const r = reg.recordFor("alice");
    expect(r?.cwd).toBe("/work/alice");
    expect(r?.lastSeen).toBe(1000);
  });

  it("re-hello on a new client drops the old client binding", () => {
    const reg = new WorkerRegistry();
    reg.acceptHello("c1", HELLO("alice"), 1000);
    reg.acceptHello("c2", HELLO("alice"), 2000);
    expect(reg.agentIdFor("c1")).toBeUndefined();
    expect(reg.clientIdFor("alice")).toBe("c2");
    expect(reg.recordFor("alice")?.lastSeen).toBe(2000);
  });

  it("setStatus updates the record and lastSeen", () => {
    const reg = new WorkerRegistry();
    reg.acceptHello("c1", HELLO("alice"), 1000);
    reg.setStatus("c1", "thinking", 5000);
    const r = reg.recordFor("alice");
    expect(r?.status).toBe("thinking");
    expect(r?.lastSeen).toBe(5000);
  });

  it("forgetClient marks worker unreachable but keeps the agentId record", () => {
    const reg = new WorkerRegistry();
    reg.acceptHello("c1", HELLO("alice"), 1000);
    reg.forgetClient("c1", 2000);
    expect(reg.agentIdFor("c1")).toBeUndefined();
    expect(reg.clientIdFor("alice")).toBeUndefined();
    const r = reg.recordFor("alice");
    expect(r?.clientId).toBeUndefined();
    expect(r?.lastSeen).toBe(2000);
  });

  it("upsertUnreachable adds a record without clientId; re-hello reattaches it", () => {
    const reg = new WorkerRegistry();
    reg.upsertUnreachable("alice", 1000);
    expect(reg.recordFor("alice")?.clientId).toBeUndefined();
    reg.acceptHello("c1", HELLO("alice"), 2000);
    expect(reg.recordFor("alice")?.clientId).toBe("c1");
  });

  it("list returns every known record", () => {
    const reg = new WorkerRegistry();
    reg.acceptHello("c1", HELLO("alice"), 1000);
    reg.upsertUnreachable("bob", 1000);
    expect(
      reg
        .list()
        .map((r) => r.agentId)
        .sort(),
    ).toEqual(["alice", "bob"]);
  });
});
