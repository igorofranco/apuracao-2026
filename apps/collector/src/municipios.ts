import { normalizeMunicipios, type Municipio, type UfMunicipios } from "@apuracao/domain";
import type { TseClient } from "@apuracao/tse-client";
import { AsyncCache } from "./async-cache.ts";

/** Cache preguiçoso do arquivo de municípios/zonas por eleição. */
export class MunicipiosCache {
  private readonly cache: AsyncCache<number, UfMunicipios[]>;
  private readonly client: TseClient;
  private readonly ciclo: string;

  constructor(client: TseClient, ciclo: string) {
    this.client = client;
    this.ciclo = ciclo;
    this.cache = new AsyncCache();
  }

  get(eleicao: number): Promise<UfMunicipios[]> {
    return this.cache.get(eleicao, async () => {
      const raw = await this.client.getMunicipios(this.ciclo, eleicao);
      return raw ? normalizeMunicipios(raw) : [];
    });
  }

  async municipiosOf(eleicao: number, uf: string): Promise<Municipio[]> {
    const all = await this.get(eleicao);
    return all.find((u) => u.uf === uf.toLowerCase())?.municipios ?? [];
  }
}
