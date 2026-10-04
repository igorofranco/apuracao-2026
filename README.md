# Apuração 2026

Acompanhamento **em tempo real** da apuração das Eleições Gerais de 2026 (1º turno,
04/10/2026) com dados **oficiais e verificados** do TSE.

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
| `POLL_ACTIVE_MS` / `POLL_IDLE_MS` | Cadência com apuração ativa / ociosa (ms) | `15000` / `60000` |
| `POLL_MAX_BACKOFF_MS` | Teto de backoff quando o TSE falha | `300000` |
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
| `GET /api/status` | Saúde, eleições resolvidas e estatísticas do poller |
| `GET /api/metrics` | Métricas Prometheus (texto) |
| `GET /api/config` | UFs, cargos e identificadores da eleição |
| `GET /api/resumo` | Resumo de todas as corridas (painel inicial) |
| `GET /api/resultado?eleicao&cargo&uf[&municipio&zona]` | Resultado (store; município/zona usa cache TTL e busca no TSE) |
| `GET /api/historico?eleicao&cargo&uf` | Snapshots (evolução temporal) |
| `GET /api/municipios?eleicao&uf` | Municípios e zonas da UF |
| `GET /api/live` | **SSE**: evento `update` a cada nova geração (limite por IP) |

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
- **Proteção**: rate limit global por IP e limite de conexões SSE por IP
  (`MAX_SSE_PER_IP`); CORS restrito às origens configuradas.
- **Segurança (web)**: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy` e `Strict-Transport-Security` aplicados
  pelo Next.

## Qualidade

```bash
npm run check     # typecheck + lint + test
```

- **32 testes**: normalização dos dados do TSE (inclusive conversores numéricos),
  verificação JWS (fixtures reais), cache assíncrono com dedupe e integração HTTP
  do collector (rotas, cache de localidade, 404 e rate limit).
- Typecheck estrito em todos os pacotes; ESLint (flat config).

## Escopo atual

- ✅ Presidente (Brasil) + Governador, Senador, Dep. Federal, Dep. Estadual/Distrital por UF.
- ✅ Painel com mapa do Brasil (por partido líder), ranking e andamento por estado.
- ✅ Drill-down: UF → município → zona.
- ✅ Tempo real via SSE; histórico e evolução temporal.
- ✅ 2º turno: projeção **matemática** (quem já não pode ser alcançado) e marca
  **oficial** do TSE, com os dois candidatos em destaque no placar.
- ✅ Same-origin (proxy Next/nginx), rate limit, métricas, headers de segurança e 2º turno automático.
- ⏭️ BU por seção (boletim de urna por seção).
