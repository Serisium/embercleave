import { describe, expect, it } from "vitest";
import { renderStatusRows } from "../src/domain/status-snapshot.js";
import type { WorkerRecord } from "../src/domain/worker-record.js";

const record = (overrides: Partial<WorkerRecord>): WorkerRecord => ({
  agentId: "alice",
  clientId: "c1",
  cwd: "/work",
  status: "thinking",
  lastSeen: 1000,
  ...overrides,
});

describe("renderStatusRows", () => {
  it("emits a placeholder row when the swarm is empty", () => {
    expect(renderStatusRows([], 1000)).toEqual(["embercleave: no workers"]);
  });

  it("marks connected workers with ● and unreachable with ○", () => {
    const rows = renderStatusRows(
      [
        record({ agentId: "alice", clientId: "c1" }),
        record({ agentId: "bob", clientId: undefined }),
      ],
      1000,
    );
    expect(rows[1]).toContain("● alice");
    expect(rows[2]).toContain("○ bob");
  });

  it("sorts workers by agentId", () => {
    const rows = renderStatusRows(
      [record({ agentId: "z", clientId: "c1" }), record({ agentId: "a", clientId: "c2" })],
      1000,
    );
    expect(rows[1]).toContain("a ");
    expect(rows[2]).toContain("z ");
  });
});
