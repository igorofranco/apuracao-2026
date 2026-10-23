import { normalizeResultado } from "@apuracao/domain";
import type { Municipio } from "@apuracao/domain";
import type { TseClient } from "@apuracao/tse-client";
import type { EleicoesResolvidas } from "./eleicoes.ts";
import type { Logger } from "./logger.ts";
import type { MunicipiosCache } from "./municipios.ts";

/** Votação presidencial de um município, já normalizada. */
export interface MunicipioPresidente {
  /** Código TSE do município. */
  cd: string;
  /** Código IBGE (casa com a malha municipal). */
  cdi: string | null;
  nome: string;
  uf: string;
  /** Votos por número de candidato (ex.: { "13": 123, "22": 456 }). */
  votos: Record<string, number>;
  votosValidos: number;
  /** true quando o TSE não publicou o arquivo do município. */
  semDados: boolean;
  atualizadoEm: string;
}

export interface MunicipiosPresidenteSnapshot {
  eleicao: number;
  cargo: number;
  uf: string;
  /** Total de municípios da UF (0 enquanto a lista não carregou). */
  total: number;
  /** Municípios já processados nesta rodada (mesmo os sem dados). */
  coletados: number;
  /** true enquanto a lista de municípios ainda está sendo buscada. */
  preparando: boolean;
  atualizadoEm: string | null;
  municipios: MunicipioPresidente[];
}

interface Item {
  uf: string;
  municipio: Municipio;
}

export interface MunicipiosPresidenteOptions {
  client: TseClient;
  municipios: MunicipiosCache;
  eleicoes: EleicoesResolvidas;
  log: Logger;
  /** Intervalo entre duas requisições ao TSE (ms). */
  intervalMs: number;
  /** Espera entre o fim de uma varredura e o início da próxima (ms). */
  refreshMs: number;
  /** Faz uma única varredura e para (equivalente ao POLL_MODE=once). */
  once: boolean;
}

const CARGO_PRESIDENTE = 1;
/** Voto no exterior não tem malha municipal no mapa. */
const UF_EXTERIOR = "zz";

/**
 * Coleta os resultados presidenciais por município **em segundo plano**.
 *
 * O objetivo é tirar o peso das costas do navegador e do TSE: em vez de o
 * cliente disparar centenas de requisições ao abrir um estado, um único worker
 * percorre os municípios em fila, com intervalo entre as requisições, e guarda
 * o resultado em memória. O web só lê o snapshot (`/api/presidente/municipios`)
 * e pinta o mapa conforme a coleta avança.
 *
 * A fila é intercalada entre as UFs (um município de cada vez) para que todos
 * os estados tenham dados parciais cedo. Quando alguém abre um estado, ele vai
 * para a frente da fila (`priorizar`).
 */
export class MunicipiosPresidente {
  private readonly dados = new Map<string, MunicipioPresidente>();
  private readonly totais = new Map<string, number>();
  private ufs: { uf: string; municipios: Municipio[] }[] = [];
  private fila: Item[] = [];
  private readonly prioridade = new Set<string>();
  private listaPronta = false;
  private parado = false;
  private falhas = 0;
  private dormirAcordar: (() => void) | null = null;

  private readonly deps: MunicipiosPresidenteOptions;

  constructor(deps: MunicipiosPresidenteOptions) {
    this.deps = deps;
  }

  /** Inicia a varredura contínua em segundo plano. */
  iniciar(): void {
    if (this.parado) return;
    void this.loop();
  }

  parar(): void {
    this.parado = true;
    this.dormirAcordar?.();
  }

  /**
   * Dá prioridade a uma UF na próxima fila. Chamado quando o web abre o
   * drill-down daquele estado; não bloqueia nem dispara requisições na hora.
   */
  priorizar(uf: string): void {
    const sigla = uf.toLowerCase();
    // Guarda mesmo antes de a lista carregar: o primeiro sweep já atende a UF.
    if (sigla.length === 2) this.prioridade.add(sigla);
  }

  /**
   * Snapshot da UF para o web. Enquanto a coleta não terminou, `coletados` é
   * menor que `total` e o front pode mostrar o progresso.
   */
  snapshot(
    eleicao: number,
    uf: string,
  ): MunicipiosPresidenteSnapshot | null {
    if (eleicao !== this.deps.eleicoes.federal.cd) return null;
    const sigla = uf.toLowerCase();
    const municipios = [...this.dados.values()]
      .filter((m) => m.uf === sigla)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return {
      eleicao,
      cargo: CARGO_PRESIDENTE,
      uf: sigla,
      total: this.totais.get(sigla) ?? 0,
      coletados: municipios.length,
      preparando: !this.listaPronta,
      atualizadoEm: municipios.reduce<string | null>(
        (maior, m) =>
          !maior || m.atualizadoEm > maior ? m.atualizadoEm : maior,
        null,
      ),
      municipios,
    };
  }

  /**
   * Executa uma única varredura (carrega a lista se necessário). Exposto para
   * testes e para o modo `once`.
   */
  async rodarUmaVez(): Promise<void> {
    if (!this.listaPronta) await this.carregarLista();
    await this.executar();
  }

  private async loop(): Promise<void> {
    while (!this.parado) {
      let falhou = false;
      try {
        await this.rodarUmaVez();
      } catch (err) {
        falhou = true;
        this.deps.log.warn("falha na varredura municipal do 2º turno", {
          erro: err instanceof Error ? err.message : String(err),
        });
      }
      if (this.parado) break;
      // Em `once`, uma falha ainda tenta de novo (uma varredura bem-sucedida).
      if (this.deps.once && !falhou) break;
      await this.esperar(this.deps.refreshMs);
    }
  }

  private async carregarLista(): Promise<void> {
    const todas = await this.deps.municipios.get(this.deps.eleicoes.federal.cd);
    const ufs = todas
      .filter((u) => u.uf !== UF_EXTERIOR && u.municipios.length > 0)
      .map((u) => ({ uf: u.uf, municipios: u.municipios }));
    // Config indisponível/vazio no TSE: tenta de novo na próxima volta em vez
    // de marcar a lista como pronta e ficar sem municípios para sempre.
    if (ufs.length === 0) throw new Error("lista de municípios vazia");
    this.ufs = ufs;
    this.totais.clear();
    for (const u of this.ufs) this.totais.set(u.uf, u.municipios.length);
    this.montarFila();
    this.listaPronta = true;

    const total = [...this.totais.values()].reduce((a, b) => a + b, 0);
    const minutos = Math.ceil((total * this.deps.intervalMs) / 60_000);
    this.deps.log.info("coleta municipal do 2º turno preparada", {
      ufs: this.ufs.length,
      municipios: total,
      intervaloMs: this.deps.intervalMs,
      varreduraAproximadaMin: minutos,
      modo: this.deps.once ? "once" : "continuo",
    });
  }

  /** Intercala as UFs para espalhar a cobertura desde o início. */
  private montarFila(): void {
    this.fila = [];
    const maior = Math.max(0, ...this.ufs.map((u) => u.municipios.length));
    for (let i = 0; i < maior; i++) {
      for (const u of this.ufs) {
        const municipio = u.municipios[i];
        if (municipio) this.fila.push({ uf: u.uf, municipio });
      }
    }
  }

  private async executar(): Promise<void> {
    while (!this.parado && this.fila.length > 0) {
      const item = this.proximo();
      if (!item) break;
      await this.coletar(item);
      if (this.parado) break;
      await this.esperar(this.deps.intervalMs);
    }
  }

  private proximo(): Item | undefined {
    if (this.prioridade.size > 0) {
      for (let i = 0; i < this.fila.length; i++) {
        const item = this.fila[i];
        if (item && this.prioridade.has(item.uf)) {
          this.fila.splice(i, 1);
          return item;
        }
      }
      // A UF prioritária já foi concluída nesta varredura.
      this.prioridade.clear();
    }
    return this.fila.shift();
  }

  private async coletar({ uf, municipio }: Item): Promise<void> {
    const chave = `${uf}:${municipio.cd}`;
    const agora = new Date().toISOString();
    try {
      const raw = await this.deps.client.getResultado({
        ciclo: this.deps.eleicoes.ciclo,
        cdEleicao: this.deps.eleicoes.federal.cd,
        cargo: CARGO_PRESIDENTE,
        uf,
        municipio: municipio.cd,
      });

      if (!raw) {
        this.dados.set(chave, {
          cd: municipio.cd,
          cdi: municipio.cdi,
          nome: municipio.nome,
          uf,
          votos: {},
          votosValidos: 0,
          semDados: true,
          atualizadoEm: agora,
        });
        return;
      }

      const race = normalizeResultado(raw);
      const votos: Record<string, number> = {};
      for (const candidato of race.candidatos) {
        votos[candidato.numero] = candidato.votos;
      }
      const atualizadoEm = race.atualizadoEm ?? agora;
      this.dados.set(chave, {
        cd: municipio.cd,
        cdi: municipio.cdi,
        nome: municipio.nome,
        uf,
        votos,
        votosValidos: race.votos.validos,
        semDados: false,
        atualizadoEm,
      });
    } catch (err) {
      // Não interrompe a varredura por causa de um município; tenta de novo na
      // próxima volta. O log é amostrado para não inundar durante uma falha.
      this.falhas += 1;
      if (this.falhas === 1 || this.falhas % 20 === 0) {
        this.deps.log.warn("falhas na coleta municipal (amostra)", {
          falhas: this.falhas,
          uf,
          municipio: municipio.cd,
          erro: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /** Espera interrompível (para o shutdown não ficar preso). */
  private esperar(ms: number): Promise<void> {
    if (ms <= 0 || this.parado) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.dormirAcordar = null;
        resolve();
      }, ms);
      this.dormirAcordar = () => {
        clearTimeout(timer);
        this.dormirAcordar = null;
        resolve();
      };
    });
  }
}
