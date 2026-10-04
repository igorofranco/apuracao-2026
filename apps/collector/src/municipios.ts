import type { Municipio, UfMunicipios } from "@apuracao/domain";
import { normalizeMunicipios } from "@apuracao/domain";
import type { TseClient } from "@apuracao/tse-client";

/** Cache preguiçoso do arquivo de municípios/zonas por eleição. */
export class MunicipiosCache {
  private readonly cache = new Map<number, UfMunicipios[]>();
  private readonly inflight = new Map<number, Promise<UfMunicipios[]>>();
  private readonly client: TseClient;
  private readonly ciclo: string;

  constructor(client: TseClient, ciclo: string) {
    this.client = client;
    this.ciclo = ciclo;
  }

  async get(eleicao: number): Promise<UfMunicipios[]> {
    const cached = this.cache.get(eleicao);
    if (cached) return cached;
    const running = this.inflight.get(eleicao);
    if (running) return running;

    const promise = (async () => {
      const raw = await this.client.getMunicipios(this.ciclo, eleicao);
      const data = raw ? normalizeMunicipios(raw) : [];
      this.cache.set(eleicao, data);
      this.inflight.delete(eleicao);
      return data;
    })();
    this.inflight.set(eleicao, promise);
    return promise;
  }

  async municipiosOf(eleicao: number, uf: string): Promise<Municipio[]> {
    const all = await this.get(eleicao);
    return all.find((u) => u.uf === uf.toLowerCase())?.municipios ?? [];
  }
}
