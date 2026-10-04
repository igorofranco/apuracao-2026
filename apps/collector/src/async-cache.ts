/**
 * Cache de valores assíncronos com dedupe de requisições em voo: se o mesmo
 * recurso for pedido várias vezes em paralelo, só a primeira chamada dispara o
 * produtor; as demais aguardam a mesma promise. TTL opcional (padrão: infinito).
 */
export class AsyncCache<K, V> {
  private readonly cache = new Map<K, { valor: V; expira: number }>();
  private readonly inflight = new Map<K, Promise<V>>();
  private readonly ttlMs: number;

  constructor(options: { ttlMs?: number } = {}) {
    this.ttlMs = options.ttlMs ?? Number.POSITIVE_INFINITY;
  }

  get tamanho(): number {
    return this.cache.size;
  }

  async get(chave: K, produzir: () => Promise<V>): Promise<V> {
    const emCache = this.cache.get(chave);
    if (emCache && emCache.expira > Date.now()) return emCache.valor;

    const emVoo = this.inflight.get(chave);
    if (emVoo) return emVoo;

    const promessa = (async () => {
      try {
        const valor = await produzir();
        this.cache.set(chave, { valor, expira: Date.now() + this.ttlMs });
        return valor;
      } finally {
        this.inflight.delete(chave);
      }
    })();

    this.inflight.set(chave, promessa);
    return promessa;
  }
}
