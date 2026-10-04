import { randomUUID } from "node:crypto";
import type { RaceStore, RaceUpdate } from "./store.ts";

const CHANNEL = "apuracao:updates";

/**
 * Ponte opcional de pub/sub em Redis para suportar múltiplas instâncias do
 * collector. Sem `REDIS_URL`, o SSE funciona apenas com os eventos locais.
 */
export class RedisBridge {
  private readonly instanceId = randomUUID();
  private readonly pub: import("ioredis").default;
  private readonly sub: import("ioredis").default;
  private readonly store: RaceStore;

  private constructor(
    pub: import("ioredis").default,
    sub: import("ioredis").default,
    store: RaceStore,
  ) {
    this.pub = pub;
    this.sub = sub;
    this.store = store;
  }

  static async create(url: string, store: RaceStore): Promise<RedisBridge> {
    const { default: Redis } = await import("ioredis");
    const pub = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
    const sub = pub.duplicate();
    const bridge = new RedisBridge(pub, sub, store);
    await bridge.init();
    return bridge;
  }

  private async init(): Promise<void> {
    this.store.on("update", (update: RaceUpdate) => {
      void this.pub
        .publish(
          CHANNEL,
          JSON.stringify({ instanceId: this.instanceId, update }),
        )
        .catch(() => {});
    });

    await this.sub.subscribe(CHANNEL);
    this.sub.on("message", (_channel, message) => {
      try {
        const parsed = JSON.parse(message) as { instanceId: string; update: RaceUpdate };
        if (parsed.instanceId === this.instanceId) return;
        // Reaplica no store local; se for novidade, ele reemite para o SSE local.
        this.store.setRace(parsed.update.race, parsed.update.at);
      } catch {
        // ignora mensagens malformadas
      }
    });
    console.log("[collector] Redis pub/sub ativo para fan-out de SSE");
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.sub.quit(), this.pub.quit()]);
  }
}
