import { describe, expect, it } from "vitest";
import { TopicRouter } from "../src/domain/topic-router.js";

describe("TopicRouter", () => {
  it("returns no subscribers for an unknown topic", () => {
    const router = new TopicRouter();
    expect(router.subscribers("anything")).toEqual([]);
  });

  it("fans subscribers per topic", () => {
    const router = new TopicRouter();
    router.subscribe("c1", "build");
    router.subscribe("c2", "build");
    router.subscribe("c2", "deploy");

    expect([...router.subscribers("build")].sort()).toEqual(["c1", "c2"]);
    expect(router.subscribers("deploy")).toEqual(["c2"]);
  });

  it("subscribe is idempotent", () => {
    const router = new TopicRouter();
    router.subscribe("c1", "build");
    router.subscribe("c1", "build");
    expect(router.subscribers("build")).toEqual(["c1"]);
  });

  it("forgetClient removes all of that client's subscriptions", () => {
    const router = new TopicRouter();
    router.subscribe("c1", "build");
    router.subscribe("c1", "deploy");
    router.subscribe("c2", "build");

    router.forgetClient("c1");

    expect(router.subscribers("build")).toEqual(["c2"]);
    expect(router.subscribers("deploy")).toEqual([]);
    expect(router.topicsFor("c1")).toEqual([]);
  });
});
