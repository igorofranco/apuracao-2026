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

/** Progresso agregado da varredura municipal (sem o payload pesado). */
export interface MunicipiosPresidenteProgresso {
  eleicao: number;
  cargo: number;
  total: number;
  coletados: number;
  preparando: boolean;
  revisao: number;
  /** Quantas varreduras completas já terminaram. */
  ciclos: number;
  atualizadoEm: string | null;
  porUf: Record<
    string,
    { total: number; coletados: number; atualizadoEm: string | null }
  >;
}

/**
 * Snapshot global compacto para o mapa do Brasil. Cada município é uma tupla
 * `[cdi, uf, votosA, votosB]`, já na ordem dos candidatos pedidos pelo cliente.
 */
export interface MunicipiosPresidenteBrasil extends MunicipiosPresidenteProgresso {
  candidatos: [string, string];
  municipios: Array<[string, string, number, number]>;
}

export interface MunicipiosPresidenteStats {
  total: number;
  coletados: number;
  preparando: boolean;
  revisao: number;
  ciclos: number;
  atualizadoEm: string | null;
  ultimaConclusao: string | null;
  ultimaDuracaoMs: number;
  falhas: number;
  rodando: boolean;
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
  /** Requisições simultâneas (1–4). */
  workers?: number;
  /** Intervalo entre duas requisições de um mesmo worker (ms). */
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
 * Pausa a varredura depois de N falhas seguidas (TSE fora/limitando). O loop
 * espera `refreshMs` e retoma de onde parou, sem martelar a fonte.
 */
const MAX_FALHAS_CONSECUTIVAS = 5;
/** Teto do backoff entre requisições quando o TSE falha. */
const MAX_BACKOFF_MS = 30_000;
/** Latência média usada só para estimar/logar a duração da varredura. */
const LATENCIA_ESTIMADA_MS = 130;

/**
 * Coleta os resultados presidenciais por município **em segundo plano**.
 *
 * O objetivo é tirar o peso das costas do navegador e do TSE: em vez de o
 * cliente disparar centenas de requisições ao abrir um estado, um pequeno pool
 * de workers percorre os municípios em fila, com intervalo entre as
 * requisições, e guarda o resultado em memória. O web só lê o snapshot
 * (`/api/presidente/municipios`) e pinta o mapa conforme a coleta avança.
 *
 * A fila é intercalada entre as UFs (um município de cada vez) para que todos
 * os estados tenham dados parciais cedo. Não há prioridade para nenhuma UF: a
 * ordem é sempre justa e estável entre as varreduras.
 */
export class MunicipiosPresidente {
  private readonly dados = new Map<string, MunicipioPresidente>();
  private readonly totais = new Map<string, number>();
  private ufs: { uf: string; municipios: Municipio[] }[] = [];
  private fila: Item[] = [];
  private listaPronta = false;
  private iniciado = false;
  private parado = false;
  private pausado = false;
  private falhas = 0;
  private falhasConsecutivas = 0;
  private revisao = 0;
  private ciclos = 0;
  private ultimoDadoEm: string | null = null;
  private ultimaConclusao: string | null = null;
  private ultimaDuracaoMs = 0;
  private readonly dorminhocos = new Set<() => void>();
  private cacheBrasil: {
    chave: string;
    valor: MunicipiosPresidenteBrasil;
  } | null = null;

  private readonly deps: MunicipiosPresidenteOptions;

  constructor(deps: MunicipiosPresidenteOptions) {
    this.deps = deps;
  }

  /** Inicia a varredura contínua em segundo plano. */
  iniciar(): void {
    if (this.parado || this.iniciado) return;
    this.iniciado = true;
    void this.loop();
  }

  parar(): void {
    this.parado = true;
    for (const acordar of [...this.dorminhocos]) acordar();
  }

  get totalMunicipios(): number {
    let total = 0;
    for (const n of this.totais.values()) total += n;
    return total;
  }

  get stats(): MunicipiosPresidenteStats {
    return {
      total: this.totalMunicipios,
      coletados: this.dados.size,
      preparando: !this.listaPronta,
      revisao: this.revisao,
      ciclos: this.ciclos,
      atualizadoEm: this.ultimoDadoEm,
      ultimaConclusao: this.ultimaConclusao,
      ultimaDuracaoMs: this.ultimaDuracaoMs,
      falhas: this.falhas,
      rodando: this.iniciado && !this.parado,
    };
  }

  /**
   * Snapshot de uma UF para o web (endpoint detalhado/compatibilidade).
   * Enquanto a coleta não terminou, `coletados` é menor que `total`.
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
      atualizadoEm: municipios.reduce<string | null>((maior, m) => {
        if (m.semDados) return maior;
        return !maior || m.atualizadoEm > maior ? m.atualizadoEm : maior;
      }, null),
      municipios,
    };
  }

  /** Progresso agregado (leve) para status, SSE e cabeçalhos de cache. */
  progresso(eleicao: number): MunicipiosPresidenteProgresso | null {
    if (eleicao !== this.deps.eleicoes.federal.cd) return null;
    const porUf: MunicipiosPresidenteProgresso["porUf"] = {};
    for (const [uf, total] of this.totais) {
      porUf[uf] = { total, coletados: 0, atualizadoEm: null };
    }
    for (const m of this.dados.values()) {
      const p = porUf[m.uf];
      if (!p) continue;
      p.coletados += 1;
      if (
        !m.semDados &&
        (!p.atualizadoEm || m.atualizadoEm > p.atualizadoEm)
      ) {
        p.atualizadoEm = m.atualizadoEm;
      }
    }
    return {
      eleicao,
      cargo: CARGO_PRESIDENTE,
      total: this.totalMunicipios,
      coletados: this.dados.size,
      preparando: !this.listaPronta,
      revisao: this.revisao,
      ciclos: this.ciclos,
      atualizadoEm: this.ultimoDadoEm,
      porUf,
    };
  }

  /**
   * Snapshot nacional compacto: todos os municípios em uma única resposta, já
   * pronto para o browser (sem fan-out por UF). O resultado é memorizado por
   * revisão + candidatos; só é remontado quando algum município muda.
   */
  snapshotBrasil(
    eleicao: number,
    a: string,
    b: string,
  ): MunicipiosPresidenteBrasil | null {
    if (eleicao !== this.deps.eleicoes.federal.cd) return null;
    const chave = `${eleicao}:${this.revisao}:${a}:${b}`;
    if (this.cacheBrasil?.chave === chave) return this.cacheBrasil.valor;

    const progresso = this.progresso(eleicao);
    if (!progresso) return null;

    const municipios: MunicipiosPresidenteBrasil["municipios"] = [];
    for (const m of this.dados.values()) {
      if (!m.cdi) continue;
      municipios.push([m.cdi, m.uf, m.votos[a] ?? 0, m.votos[b] ?? 0]);
    }
    municipios.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));

    const valor: MunicipiosPresidenteBrasil = {
      ...progresso,
      candidatos: [a, b],
      municipios,
    };
    this.cacheBrasil = { chave, valor };
    return valor;
  }

  /**
   * Executa uma varredura (ou retoma a que foi pausada por falhas). Exposto
   * para testes e para o modo `once`.
   *
   * Retorna `true` quando a fila terminou (varredura completa); `false` quando
   * pausou por falhas consecutivas e ainda há municípios pendentes.
   */
  async rodarUmaVez(): Promise<boolean> {
    if (!this.listaPronta) await this.carregarLista();
    // Fila vazia = varredura anterior concluída: recomeça para atualizar os
    // dados (antes, sem este rebuild, o serviço fazia só a primeira volta).
    if (this.fila.length === 0) {
      this.montarFila();
      this.falhasConsecutivas = 0;
    }
    return this.executar();
  }

  private async loop(): Promise<void> {
    while (!this.parado) {
      const inicio = Date.now();
      let concluiu = false;
      try {
        concluiu = await this.rodarUmaVez();
      } catch (err) {
        this.deps.log.warn("falha na varredura municipal do 2º turno", {
          erro: err instanceof Error ? err.message : String(err),
        });
      }
      if (this.parado) break;
      // Em `once`, só termina quando a varredura realmente completou; se pausou
      // por falhas, espera e retoma os municípios que faltam.
      if (concluiu) {
        this.ciclos += 1;
        this.ultimaDuracaoMs = Date.now() - inicio;
        this.ultimaConclusao = new Date().toISOString();
        const total = this.totalMunicipios;
        this.deps.log.info("varredura municipal concluída", {
          municipios: total,
          duracaoMin: Number((this.ultimaDuracaoMs / 60_000).toFixed(1)),
          reqPorSegundo: Number(
            (total / Math.max(1, this.ultimaDuracaoMs / 1000)).toFixed(1),
          ),
          falhas: this.falhas,
          proximaEmMs: this.deps.once ? null : this.deps.refreshMs,
        });
      }
      if (this.deps.once && concluiu) break;
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

    const total = this.totalMunicipios;
    const workers = Math.max(1, this.deps.workers ?? 1);
    // Estimativa grosseira: intervalo + latência média de uma requisição.
    const minutos = Math.ceil(
      (total * (this.deps.intervalMs + LATENCIA_ESTIMADA_MS)) /
        workers /
        60_000,
    );
    this.deps.log.info("coleta municipal do 2º turno preparada", {
      ufs: this.ufs.length,
      municipios: total,
      workers,
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

  /** Retorna true quando a fila foi totalmente consumida. */
  private async executar(): Promise<boolean> {
    this.pausado = false;
    const workers = Math.max(1, this.deps.workers ?? 1);

    const trabalhar = async () => {
      while (!this.parado && !this.pausado && this.fila.length > 0) {
        const item = this.fila.shift();
        if (!item) break;
        const ok = await this.coletar(item);
        if (this.parado || this.pausado) break;

        if (ok) {
          this.falhasConsecutivas = 0;
          await this.esperar(this.deps.intervalMs);
          continue;
        }

        // Falha: o município volta na próxima varredura completa. A pausa por
        // falhas seguidas evita insistir quando o TSE está fora ou limitando.
        this.falhasConsecutivas += 1;
        if (this.falhasConsecutivas >= MAX_FALHAS_CONSECUTIVAS) {
          this.pausado = true;
          this.deps.log.warn("pausando a varredura municipal por falhas", {
            falhasConsecutivas: this.falhasConsecutivas,
            restantes: this.fila.length,
          });
          break;
        }
        const base = Math.max(this.deps.intervalMs, 250);
        const espera = Math.min(
          base * 2 ** Math.min(this.falhasConsecutivas, 6),
          MAX_BACKOFF_MS,
        );
        await this.esperar(espera);
      }
    };

    const quantidade = Math.min(workers, Math.max(1, this.fila.length));
    await Promise.all(
      Array.from({ length: quantidade }, () => trabalhar()),
    );
    return !this.pausado && this.fila.length === 0;
  }

  private async coletar({ uf, municipio }: Item): Promise<boolean> {
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
        this.registrar({
          cd: municipio.cd,
          cdi: municipio.cdi,
          nome: municipio.nome,
          uf,
          votos: {},
          votosValidos: 0,
          semDados: true,
          atualizadoEm: agora,
        });
        return true;
      }

      const race = normalizeResultado(raw);
      const votos: Record<string, number> = {};
      for (const candidato of race.candidatos) {
        votos[candidato.numero] = candidato.votos;
      }
      this.registrar({
        cd: municipio.cd,
        cdi: municipio.cdi,
        nome: municipio.nome,
        uf,
        votos,
        votosValidos: race.votos.validos,
        semDados: false,
        atualizadoEm: race.atualizadoEm ?? agora,
      });
      return true;
    } catch (err) {
      // Registra o município como "sem dados agora" para o progresso do mapa
      // fechar (e o front parar de buscar a cada 8 s); a próxima varredura
      // sobrescreve com o resultado real. O log é amostrado para não inundar.
      this.registrar({
        cd: municipio.cd,
        cdi: municipio.cdi,
        nome: municipio.nome,
        uf,
        votos: {},
        votosValidos: 0,
        semDados: true,
        atualizadoEm: agora,
      });
      this.falhas += 1;
      if (this.falhas === 1 || this.falhas % 20 === 0) {
        this.deps.log.warn("falhas na coleta municipal (amostra)", {
          falhas: this.falhas,
          uf,
          municipio: municipio.cd,
          erro: err instanceof Error ? err.message : String(err),
        });
      }
      return false;
    }
  }

  private registrar(municipio: MunicipioPresidente): void {
    this.dados.set(`${municipio.uf}:${municipio.cd}`, municipio);
    this.revisao += 1;
    if (
      !municipio.semDados &&
      (!this.ultimoDadoEm || municipio.atualizadoEm > this.ultimoDadoEm)
    ) {
      this.ultimoDadoEm = municipio.atualizadoEm;
    }
  }

  /** Espera interrompível (para o shutdown não ficar preso). */
  private esperar(ms: number): Promise<void> {
    if (ms <= 0 || this.parado) return Promise.resolve();
    return new Promise((resolve) => {
      const acordar = () => {
        clearTimeout(timer);
        this.dorminhocos.delete(acordar);
        resolve();
      };
      const timer = setTimeout(acordar, ms);
      this.dorminhocos.add(acordar);
    });
  }
}
