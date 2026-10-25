# Apuração 2026

Acompanhamento **em tempo real** da apuração das Eleições Gerais de 2026 com dados
**oficiais e verificados** do TSE. O site tem **uma única página**: o **2º turno
presidencial** (25/10/2026), com os dois candidatos em destaque e o mapa de
apuração por município logo abaixo. O tema claro/escuro segue a configuração do
dispositivo.

- **Web**: Next.js 16 (App Router) + React 19 + Tailwind v4 + TanStack Query + Recharts.
- **Collector**: worker Node 26 (Fastify) que faz polling dos arquivos do TSE, valida a
  assinatura digital (JWS/Ed25519) e entrega por REST + SSE.
- **Tempo real**: `Server-Sent Events` — o cliente recebe cada nova geração (`idg`)
  assim que o coletor a detecta, com fallback para polling.

> Projeto independente, sem vínculo com o TSE. Os dados são públicos
> (`resultados.tse.jus.br`) e a integridade é conferida pela assinatura do próprio TSE.

## Arquitetura

```
TSE (arquivos .json/.jws)  ──polling adaptativo──►  apps/collector (Fastify)
                                                    │ verifica JWS (Ed25519)
                                                    │ normaliza (Zod) + cache
                                                    ├─► Redis (opcional: fan-out)
                                                    ├─► Postgres (opcional: histórico)
                                                    ▼
                                        REST /api/*  +  SSE /api/live
                                                    ▼
                                        apps/web (Next.js 16)
```

## Estrutura

```
apuracao-2026/
├─ apps/
│  ├─ web/          # Next.js 16 (Tailwind v4, shadcn-style, Recharts, d3-geo)
│  └─ collector/    # Fastify: poller + REST + SSE
├─ packages/
│  ├─ shared/       # UFs, cargos e constantes do TSE
│  ├─ domain/       # schemas Zod (dados brutos) + normalização + tipos
│  └─ tse-client/   # URLs oficiais, fetch com cache-bust e verificação JWS
├─ ecosystem.config.cjs   # processos PM2 (collector + web)
└─ .env.example
```

## Requisitos

- **Node.js 26** (o projeto usa _type stripping_ nativo; nada é compilado para o collector).
- **npm 11** (já vem com o Node 26). O repositório usa **npm workspaces**.

```bash
fnm use            # lê o .node-version (26.10.0)
npm install
```

> Se o npm reclamar de scripts de instalação (`esbuild`), rode
> `npm install-scripts approve esbuild` uma vez — a aprovação fica registrada
> em `allowScripts` no `package.json`.

## Rodando localmente

Em dois terminais:

```bash
# collector (API + SSE em http://127.0.0.1:8787)
npm run dev:collector

# web (http://localhost:3000) — o Next proxya /api para o collector
npm run dev:web
```

Ou tudo junto com `npm run dev` (usa `concurrently`). Não é preciso configurar
URL: o navegador sempre fala na mesma origem (`/api`) e o Next proxi­a para o
collector (`API_PROXY_TARGET`, padrão `http://127.0.0.1:8787`).

### Variáveis de ambiente

Copie `.env.example` e ajuste. As principais:

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `PORT` / `HOST` | Bind do collector | `8787` / `127.0.0.1` |
| `LOG_LEVEL` / `LOG_FORMAT` | Log (`pretty`/`json`) | `info` / `pretty` |
| `TSE_VERIFY_JWS` | Verifica assinatura Ed25519 dos `.jws` | `true` |
| `TSE_ELEICOES_AUTO` | Resolve eleições (e 2º turno) do config do TSE | `true` |
| `POLL_ACTIVE_MS` / `POLL_IDLE_MS` | Cadência **rápida** (Presidente nacional) ativa/ociosa (ms) | `15000` / `60000` |
| `POLL_SLOW_MS` / `POLL_SLOW_IDLE_MS` | Cadência **lenta** (mapa por UF, governadores, cargos decididos) | `60000` / `300000` |
| `POLL_MAX_BACKOFF_MS` | Teto de backoff quando o TSE falha | `300000` |
| `POLL_MODE` | `continuous` (coleta contínua) ou `once` (uma rodada no boot e para) | `continuous` |
| `MUNICIPIOS_POLL` | Liga a varredura municipal do 2º turno | `true` |
| `MUNICIPIOS_WORKERS` | Requisições simultâneas na varredura municipal (1–4) | `2` |
| `MUNICIPIOS_POLL_INTERVAL_MS` | Intervalo entre requisições de um worker (ms) | `150` |
| `MUNICIPIOS_REFRESH_MS` | Espera entre o fim de uma varredura e a próxima (ms) | `30000` |
| `CORS_ORIGIN` | Origem(ns) permitida(s), separadas por vírgula | `http://localhost:3000` |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | Rate limit global por IP | `300` / `60000` |
| `MAX_SSE_PER_IP` | Conexões SSE simultâneas por IP | `10` |
| `REDIS_URL` | Habilita pub/sub (múltiplas instâncias) | — |
| `DATABASE_URL` | Persiste snapshots (histórico durável) | — |
| `HISTORY_RETENTION_DAYS` / `HISTORY_MAX_POINTS` | Retenção e limite de pontos do histórico | `7` / `5000` |
| `API_PROXY_TARGET` | Alvo do proxy `/api` do Next (**build-time**) | `http://127.0.0.1:8787` |

Sem Redis/Postgres o collector funciona normalmente com cache em memória
(histórico em ring buffer e SSE local).

### Postgres e Redis (opcionais)

- **Postgres (`DATABASE_URL`)** — *recomendado*: histórico **durável**. Cada nova
  geração é gravada e `/api/historico` passa a consultar por período (sobrevive a
  restart). Há **retenção automática** (`HISTORY_RETENTION_DAYS`, padrão 7 dias,
  limpeza a cada `HISTORY_PRUNE_INTERVAL_MS`). A tabela/índice são criados no boot.
- **Redis (`REDIS_URL`)**: pub/sub para **fan-out de SSE quando houver mais de uma
  instância do collector**. Com uma única instância não há ganho — pode ficar
  desligado. O status aparece em `/api/status` (`redis`, `redisConectado`).

O `web` é stateless e escala horizontalmente sem configuração extra.

## API do collector

| Rota | Descrição |
| --- | --- |
| `GET /health` | Liveness (para pm2/nginx) |
| `GET /api/status` | Saúde, eleições, pollers (rápido/lento) e progresso municipal |
| `GET /api/metrics` | Métricas Prometheus (texto) |
| `GET /api/config` | UFs, cargos e identificadores da eleição |
| `GET /api/resumo` | Resumo de todas as corridas (painel inicial) |
| `GET /api/resultado?eleicao&cargo&uf[&municipio&zona]` | Resultado (store; município/zona usa cache TTL e busca no TSE) |
| `GET /api/historico?eleicao&cargo&uf` | Snapshots (evolução temporal) |
| `GET /api/municipios?eleicao&uf` | Municípios e zonas da UF |
| `GET /api/presidente/municipios?eleicao&a&b` | **Snapshot nacional compacto** do 2º turno (`[cdi, uf, votosA, votosB]`), com ETag/cache/gzip |
| `GET /api/presidente/municipios?eleicao&uf` | Snapshot detalhado de uma UF (compatibilidade/depuração) |
| `GET /api/live` | **SSE**: `update` a cada nova geração e `municipios` ao fim de cada varredura (limite por IP) |

## Como os dados são obtidos

Descoberto e validado direto no app oficial do TSE:

- Config global: `oficial/comum/config/ele-c.jws` → ciclo `ele2026`, pleito `3220`,
  eleições `6257` (Federal/Presidente), `6259` (Estadual) e `6261` (Municipal).
- Resultados: `oficial/ele2026/<cd_eleicao>/dados/<uf>/<uf>[-<municipio5>][-z<zona4>]-c<cargo4>-e<cd6>-u.json`
  - Presidente: `6257/dados/br/br-c0001-e006257-u.json`
  - SP: Gov `c0003`, Sen `c0005`, Dep. Federal `c0006`, Dep. Estadual `c0007`
- Municípios: `oficial/ele2026/<cd_eleicao>/config/mun-e<cd6>-cm.json`
- Assinatura: arquivos `.jws` (EdDSA) verificados com a chave pública do TSE
  (`packages/shared/src/constants.ts`).

## Deploy com PM2 (sem Docker)

No servidor (Node 26 + npm + pm2):

```bash
# 1) dependências
npm ci

# 2) build do web (o proxy /api é configurado no BUILD)
#    Por padrão proxiа para http://127.0.0.1:8787 — só mude se for outro host/porta.
# export API_PROXY_TARGET="http://127.0.0.1:8787"
npm run build

# 3) variáveis de ambiente do collector
cp .env.example .env
set -a; source .env; set +a

# 4) subir os dois processos
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup    # gere o autostart no boot
```

- **Collector**: `apuracao-collector` (porta `PORT`, padrão 8787, sinaliza `ready` ao pm2).
- **Web**: `apuracao-web` (`next start`, porta `WEB_PORT`, padrão 3000).
- O navegador fala na **mesma origem** (`/api`): **não há CORS nem mixed content**.
  Sem nginx, o próprio Next proxiа `/api` (inclusive o SSE). Com nginx, ele assume o proxy.

### Nginx (recomendado para TLS e volume)

```nginx
# SSE: sem buffering no endpoint ao vivo
location /api/live {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
}
location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
}
location / {
    proxy_pass http://127.0.0.1:3000;
}
```

## Operação

- **Healthcheck**: `GET /health` (collector). Ideal no pm2/`nginx`/uptime.
- **Métricas**: `GET /api/metrics` (Prometheus): corridas, SSE ativos, rodadas,
  atualizações, falhas e falhas de assinatura.
- **2º turno**: os códigos de eleição são resolvidos do config do TSE
  (`TSE_ELEICOES_AUTO=true`); ao surgir uma eleição de maior turno para o pleito,
  ela é adotada automaticamente (ou fixe via `TSE_ELEICAO_FEDERAL` / `TSE_ELEICAO_ESTADUAL`).
  O config pode repetir o mesmo pleito em mais de um bloco (o 2º turno costuma vir
  em um bloco novo); o coletor agrega todos antes de escolher o maior turno.
  Presidente e Governador passam a ser coletados no turno atual; Senador e
  Deputados continuam vindo da eleição do 1º turno — assim os dados já apurados
  não desaparecem. O web resolve os códigos em `/api/config`, sem constantes fixas.
  A Presidência **não** usa o 1º turno como fallback: enquanto o 2º turno não tem
  votos, os dois candidatos aparecem com 0% e a apuração/evolução fica oculta.
  Mesmo antes de o TSE publicar a corrida 6258, o destaque já mostra a **dupla
  conhecida do 2º turno** (fotos, nomes, partidos, número e vice) com 0 voto/0%,
  a partir de `CANDIDATOS_PRESIDENCIA_2026`; nada é inventado. Presidente também
  é coletado **por UF** (`<uf>-c0001-e<eleição>-u.json`) para alimentar o mapa
  por estado do 2º turno.
- **Início da coleta de 2026**: hardcoded para **25/10 às 16h (Brasília)** em
  `apps/collector/src/eleicoes.ts`. Antes disso o collector sobe com 6258/6260
  hardcoded, não consulta o config nem os resultados do TSE, e as rotas de
  drill-down sob demanda (`/api/municipios` e `/api/resultado` com
  `municipio`/`zona`) respondem **503**. Às 16h a coleta principal e a
  varredura municipal começam automaticamente; se o processo reiniciar depois
  das 16h, começa na hora. Para a apuração, mantenha `POLL_MODE=continuous`
  (`once` faria apenas uma rodada). O gate é específico de 2026 — troque a data
  para reutilizar em outro pleito.
- **Proteção**: rate limit global por IP e limite de conexões SSE por IP
  (`MAX_SSE_PER_IP`); CORS restrito às origens configuradas.
- **Coleta desligada**: com `POLL_MODE=once` o collector faz uma única rodada no
  boot (para repovoar a memória do painel após um restart, já que `hydrate()` só
  restaura o histórico do Postgres) e não agenda mais nenhuma coleta. O painel
  continua servindo `REST`/`SSE` normalmente.
- **Coleta municipal do 2º turno**: em segundo plano, **sem prioridade de UF**,
  o collector percorre os municípios com 2 workers e 150 ms entre requisições
  (`MUNICIPIOS_WORKERS`, `MUNICIPIOS_POLL_INTERVAL_MS`), completando os ~5.500
  em **~13 min** (depende da latência do TSE). O web lê um **único snapshot
  nacional compacto** em `/api/presidente/municipios` (tuplas
  `[cdi, uf, votosA, votosB]`), já montado/cacheado no servidor, com **ETag,
  cache HTTP e gzip**; a UF detalhada reaproveita o mesmo payload. Um evento SSE
  `municipios` avisa quando cada ciclo termina; o browser não faz fan-out por
  UF nem fala com o TSE. Com `MUNICIPIOS_POLL=false` a coleta é desligada; no
  `POLL_MODE=once` é uma única varredura completa.
  Em falhas seguidas (TSE fora/limitando), a varredura pausa, espera
  `MUNICIPIOS_REFRESH_MS` e retoma de onde parou, sem retry em rajada.
  Orçamento aproximado durante a apuração:
  - poller **rápido** (Presidente nacional): 1 alvo/15 s (~0,07 req/s);
  - poller **lento** (mapa por UF, governadores e cargos decididos):
    162 alvos/60 s (~2,7 req/s);
  - varredura municipal: ~7 req/s (2 workers, 150 ms + latência);
  ou seja, **~10 req/s** no total. O browser não participa desse orçamento —
  só lê o cache do collector.
- **Segurança (web)**: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy` e `Strict-Transport-Security` aplicados
  pelo Next.

## Qualidade

```bash
npm run check     # typecheck + lint + test
```

- **Testes unitários** em todos os pacotes: normalização dos dados do TSE
  (inclusive conversores numéricos), verificação JWS (fixtures reais), cache
  assíncrono com dedupe, integração HTTP do collector (rotas, cache de
  localidade, 404 e rate limit) e escalas do mapa presidencial.
- Typecheck estrito em todos os pacotes; ESLint (flat config).
- E2E/screenshots com Playwright: `npm run test:e2e -w @apuracao/web`. O mock
  reproduz o cenário real (0 voto no 2º turno); para pré-visualizar o mapa
  colorido antes da votação, rode o mock com `MOCK_RUNOFF_VOTOS=1`.

## Escopo atual

- ✅ Página única (home), sem menu superior: destaque dos presidentes no 2º turno
  e mapa de apuração por município.
- ✅ Tema claro/escuro definido só por `prefers-color-scheme` (sem seletor e sem
  `localStorage`).
- ✅ Fotos oficiais dos candidatos no destaque presidencial, pelo `sqcand` do TSE
  (dados abertos `foto_cand2026_<UF>_div.zip`), com fallback para o número.
- ✅ Mapa do Brasil do 2º turno (logo abaixo dos presidentes) mostrando **todos
  os municípios já na visão nacional**, cada um colorido pela própria votação.
  A escala **relativa** (padrão) normaliza entre os municípios do país; a
  **absoluta** usa a diferença real de votos. A paleta pode ser **com neutro**
  (azul → neutro → vermelho) ou **sem neutro** (azul → vermelho). Na visão
  Brasil os municípios não têm hover/clique nem divisas internas; os estados
  ficam por cima, com borda grossa, hover e clique. Sem votos, o mapa fica
  neutro com aviso de espera.
- ✅ Drill-down **por município no mesmo card** (clique no estado): malha
  detalhada da UF, municípios sem divisas internas, contorno da UF em traço
  grosso, hover e a mesma escala/paleta (relativa normaliza dentro da UF).
  A malha municipal do Brasil é pré-projetada em
  `apps/web/public/geo/municipios-brasil.json` a partir de
  `apps/web/public/geo/municipios/<uf>.json` (IBGE via `geodata-br`,
  simplificada para ~10% dos pontos); gere com
  `npm run geo:brasil -w @apuracao/web`. O dataset tem 5.564 municípios, dos
  quais 5.526 têm polígono válido (38 vêm com geometria vazia na fonte); os 7
  criados depois de 2022 não estão na malha.
- ✅ Tempo real via SSE (indicador “Ao vivo”).
- ✅ 2º turno: painel inicial com os **dois candidatos à Presidência em destaque**
  ocupando a primeira seção (desktop e mobile), sem o painel de acompanhamento
  personalizado. Aceita a eleição oficial do 2º turno ou a projeção
  **matemática** (os dois primeiros inalcançáveis pelo 3º e o 1º sem 50%+1).
  As fotos e nomes da dupla aparecem **desde antes da apuração**, com 0 voto/0%
  e o mapa no estado de espera, sem reaproveitar números do 1º turno.
- ✅ Same-origin (proxy Next/nginx), rate limit, métricas, headers de segurança e 2º turno automático.
- ⏭️ BU por seção (boletim de urna por seção).
