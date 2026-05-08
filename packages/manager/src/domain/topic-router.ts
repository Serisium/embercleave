/**
 * Pure topic subscription graph. No IO. Tracks which bus clients are
 * subscribed to which topics so a publish can be fanned out efficiently
 * (arch.md §4.3).
 */
export class TopicRouter {
  private readonly byTopic = new Map<string, Set<string>>();
  private readonly byClient = new Map<string, Set<string>>();

  /** Add a clientId to a topic's subscriber set. Idempotent. */
  subscribe(clientId: string, topic: string): void {
    this.addToSet(this.byTopic, topic, clientId);
    this.addToSet(this.byClient, clientId, topic);
  }

  /** Returns the clientIds subscribed to `topic`. */
  subscribers(topic: string): readonly string[] {
    const set = this.byTopic.get(topic);
    return set === undefined ? [] : Array.from(set);
  }

  /** Returns the topics `clientId` is subscribed to. */
  topicsFor(clientId: string): readonly string[] {
    const set = this.byClient.get(clientId);
    return set === undefined ? [] : Array.from(set);
  }

  /** Remove all subscriptions for `clientId`. */
  forgetClient(clientId: string): void {
    const topics = this.byClient.get(clientId);
    if (topics === undefined) return;
    for (const topic of topics) {
      const subs = this.byTopic.get(topic);
      if (subs !== undefined) {
        subs.delete(clientId);
        if (subs.size === 0) this.byTopic.delete(topic);
      }
    }
    this.byClient.delete(clientId);
  }

  private addToSet(map: Map<string, Set<string>>, key: string, value: string): void {
    let set = map.get(key);
    if (set === undefined) {
      set = new Set();
      map.set(key, set);
    }
    set.add(value);
  }
}
