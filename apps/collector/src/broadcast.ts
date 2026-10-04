import { randomUUID } from "node:crypto";
import type { Logger } from "./logger.ts";
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
  private readonly log?: Logger;
  private conectado = true;

  private constructor(
    pub: import("ioredis").default,
    sub: import("ioredis").default,
    store: RaceStore,
    log?: Logger,
  ) {
    this.pub = pub;
    this.sub = sub;
    this.store = store;
    this.log = log;
  }

  static async create(url: string, store: RaceStore, log?: Logger): Promise<RedisBridge> {
    const { default: Redis } = await import("ioredis");
    const pub = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
    const sub = pub.duplicate();
    const bridge = new RedisBridge(pub, sub, store, log);
    await bridge.init();
    return bridge;
  }

  private async init(): Promise<void> {
    this.pub.on("error", (err) => {
      this.conectado = false;
      this.log?.warn("erro no Redis (pub)", { erro: err.message });
    });

    this.store.on("update", (update: RaceUpdate) => {
      void this.pub
        .publish(
          CHANNEL,
          JSON.stringify({ instanceId: this.instanceId, update }),
        )
        .catch(() => {
          this.conectado = false;
        });
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
    this.conectado = true;
    this.log?.info("Redis pub/sub ativo para fan-out de SSE");
  }

  /** Verifica a conectividade com o Redis (para /api/status). */
  async ping(): Promise<boolean> {
    try {
      const pong = await this.pub.ping();
      this.conectado = pong === "PONG";
    } catch {
      this.conectado = false;
    }
    return this.conectado;
  }

  get ok(): boolean {
    return this.conectado;
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.sub.quit(), this.pub.quit()]);
  }
}
