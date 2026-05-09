import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const imageDir = fileURLToPath(new URL("../..", import.meta.url));
const read = (relative: string): string => readFileSync(`${imageDir}/${relative}`, "utf8");

const workerQuadlet = read("quadlets/embercleave-worker@.container");
const mgrService = read("systemd/embercleave-mgr.service");
const swarmTarget = read("systemd/embercleave.target");
const tmpfilesConf = read("tmpfiles.d/embercleave.conf");

const has = (haystack: string, needle: string): boolean =>
  haystack.split("\n").some((line) => line.trim() === needle);

describe("worker Quadlet template", () => {
  it("references the embedded runtime image", () => {
    expect(has(workerQuadlet, "Image=localhost/embercleave-worker:latest")).toBe(true);
  });

  it("loads the per-instance EnvironmentFile", () => {
    expect(has(workerQuadlet, "EnvironmentFile=%h/.config/embercleave/instances/%i.env")).toBe(
      true,
    );
  });

  it("mounts the bus socket directory rw", () => {
    expect(has(workerQuadlet, "Volume=/run/embercleave:/run/embercleave:rw")).toBe(true);
  });

  it("mounts a per-instance workspace under the swarm home", () => {
    expect(has(workerQuadlet, "Volume=%h/embercleave/workspaces/%i:/workspace:Z")).toBe(true);
  });

  it("attaches to embercleave.target for ordered shutdown", () => {
    expect(has(workerQuadlet, "PartOf=embercleave.target")).toBe(true);
    expect(has(workerQuadlet, "WantedBy=embercleave.target")).toBe(true);
  });

  it("hardens the container", () => {
    expect(has(workerQuadlet, "NoNewPrivileges=true")).toBe(true);
    expect(has(workerQuadlet, "DropCapability=ALL")).toBe(true);
  });
});

describe("manager systemd service (host-level, not a Quadlet)", () => {
  it("runs pi directly from the host /usr install", () => {
    expect(has(mgrService, "ExecStart=/usr/bin/pi")).toBe(true);
  });

  it("reads its env from the singleton manager.env", () => {
    expect(has(mgrService, "EnvironmentFile=%h/.config/embercleave/manager.env")).toBe(true);
  });

  it("starts before the worker target so the bus is up first", () => {
    expect(has(mgrService, "Before=embercleave.target")).toBe(true);
  });

  it("attaches to embercleave.target", () => {
    expect(has(mgrService, "PartOf=embercleave.target")).toBe(true);
    expect(has(mgrService, "WantedBy=embercleave.target")).toBe(true);
  });

  it("restarts on failure", () => {
    expect(has(mgrService, "Restart=on-failure")).toBe(true);
  });
});

describe("embercleave.target", () => {
  it("is wanted by default.target so it auto-starts under swarm linger", () => {
    expect(has(swarmTarget, "WantedBy=default.target")).toBe(true);
  });

  it("is a pure synchronization unit (no ExecStart)", () => {
    expect(swarmTarget).not.toMatch(/^ExecStart=/m);
  });
});

describe("tmpfiles.d snippet", () => {
  it("declares the bus socket directory with swarm:swarm 0750", () => {
    expect(tmpfilesConf).toMatch(/^d \/run\/embercleave 0750 swarm swarm -$/m);
  });
});
