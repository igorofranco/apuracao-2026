import { normalizeResultado, type RaceResult } from "@apuracao/domain";
import type { TseClient } from "@apuracao/tse-client";
import { AsyncCache } from "./async-cache.ts";

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
  private readonly cache: AsyncCache<string, RaceResult | null>;
  private readonly client: TseClient;

  constructor(client: TseClient, ttlMs: number) {
    this.client = client;
    this.cache = new AsyncCache({ ttlMs });
  }

  private chave(p: LocalidadeParams): string {
    return [p.ciclo, p.eleicao, p.cargo, p.uf, p.municipio ?? "", p.zona ?? ""].join(":");
  }

  get(p: LocalidadeParams): Promise<RaceResult | null> {
    return this.cache.get(this.chave(p), async () => {
      const raw = await this.client.getResultado({
        ciclo: p.ciclo,
        cdEleicao: p.eleicao,
        cargo: p.cargo,
        uf: p.uf,
        municipio: p.municipio,
        zona: p.zona,
      });
      return raw ? normalizeResultado(raw) : null;
    });
  }

  get tamanho(): number {
    return this.cache.tamanho;
  }
}
