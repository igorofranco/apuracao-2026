import { normalizeResultado, type RaceResult } from "@apuracao/domain";
import type { TseClient } from "@apuracao/tse-client";

interface Entrada {
  valor: RaceResult | null;
  expira: number;
}

export interface LocalidadeParams {
  ciclo: string;
  eleicao: number;
  cargo: number;
  uf: string;
  municipio?: string;
  zona?: string;
}

/**
 * Cache com TTL curto + dedupe de requisições em voo para os resultados
 * buscados sob demanda (município/zona). Evita martelar o TSE quando muitos
 * usuários abrem o mesmo drill-down.
 */
export class LocalidadesCache {
  private readonly cache = new Map<string, Entrada>();
  private readonly inflight = new Map<string, Promise<RaceResult | null>>();
  private readonly client: TseClient;
  private readonly ttlMs: number;

  constructor(client: TseClient, ttlMs: number) {
    this.client = client;
    this.ttlMs = ttlMs;
  }

  private chave(p: LocalidadeParams): string {
    return [p.ciclo, p.eleicao, p.cargo, p.uf, p.municipio ?? "", p.zona ?? ""].join(":");
  }

  async get(p: LocalidadeParams): Promise<RaceResult | null> {
    const chave = this.chave(p);
    const agora = Date.now();
    const emCache = this.cache.get(chave);
    if (emCache && emCache.expira > agora) return emCache.valor;

    const emVoo = this.inflight.get(chave);
    if (emVoo) return emVoo;

    const promessa = (async () => {
      try {
        const raw = await this.client.getResultado({
          ciclo: p.ciclo,
          cdEleicao: p.eleicao,
          cargo: p.cargo,
          uf: p.uf,
          municipio: p.municipio,
          zona: p.zona,
        });
        const valor = raw ? normalizeResultado(raw) : null;
        this.cache.set(chave, { valor, expira: Date.now() + this.ttlMs });
        return valor;
      } finally {
        this.inflight.delete(chave);
      }
    })();

    this.inflight.set(chave, promessa);
    return promessa;
  }

  get tamanho(): number {
    return this.cache.size;
  }
}
