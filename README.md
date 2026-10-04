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
# collector (API + SSE em http://localhost:8787)
npm run dev:collector

# web (http://localhost:3000)
NEXT_PUBLIC_API_URL=http://localhost:8787 npm run dev:web
```

Ou tudo junto com `npm run dev` (usa `concurrently`).

### Variáveis de ambiente

Copie `.env.example` e ajuste. As principais:

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `PORT` | Porta do collector | `8787` |
| `TSE_VERIFY_JWS` | Verifica assinatura Ed25519 dos `.jws` | `true` |
| `POLL_ACTIVE_MS` / `POLL_IDLE_MS` | Cadência com apuração ativa / ociosa (ms) | `15000` / `60000` |
| `CORS_ORIGIN` | Origem(ns) permitida(s) no collector | `*` |
| `REDIS_URL` | Habilita pub/sub (múltiplas instâncias) | — |
| `DATABASE_URL` | Persiste snapshots (histórico durável) | — |
| `NEXT_PUBLIC_API_URL` | URL do collector usada pelo **browser** (embutida no build) | `http://localhost:8787` |

Sem Redis/Postgres o collector funciona normalmente com cache em memória
(histórico em ring buffer e SSE local).

## API do collector

| Rota | Descrição |
| --- | --- |
| `GET /api/status` | Saúde, última coleta e estatísticas do poller |
| `GET /api/config` | UFs, cargos e identificadores da eleição |
| `GET /api/resumo` | Resumo de todas as corridas (painel inicial) |
| `GET /api/resultado?eleicao&cargo&uf[&municipio&zona]` | Resultado completo (store; com município/zona, busca sob demanda no TSE) |
| `GET /api/historico?eleicao&cargo&uf` | Snapshots (evolução temporal) |
| `GET /api/municipios?eleicao&uf` | Municípios e zonas da UF |
| `GET /api/live` | **SSE**: evento `update` a cada nova geração |

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

# 2) build do web (a URL da API é embutida aqui)
export NEXT_PUBLIC_API_URL="https://api.seudominio.com"   # ou http://IP:8787
npm run build

# 3) variáveis de ambiente do collector
cp .env.example .env
set -a; source .env; set +a

# 4) subir os dois processos
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup    # gere o autostart no boot
```

- **Collector**: `apuracao-collector` (porta `PORT`, padrão 8787).
- **Web**: `apuracao-web` (`next start`, porta `WEB_PORT`, padrão 3000).
- Lembre-se: `NEXT_PUBLIC_API_URL` é do **browser** — deve ser uma URL pública
  acessível pelo cliente (não `localhost`, a menos que o proxy seja o mesmo host).

### Nginx (recomendado, para TLS e SSE)

O SSE precisa de proxy sem buffering no endpoint `/api/live`:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
}
location / {
    proxy_pass http://127.0.0.1:3000;
}
```

## Qualidade

```bash
npm run check     # typecheck + lint + test
```

- **12 testes** cobrindo normalização dos dados do TSE e verificação JWS (fixtures reais).
- Typecheck estrito em todos os pacotes; ESLint (flat config).

## Escopo atual

- ✅ Presidente (Brasil) + Governador, Senador, Dep. Federal, Dep. Estadual/Distrital por UF.
- ✅ Painel com mapa do Brasil (por partido líder), ranking e andamento por estado.
- ✅ Drill-down: UF → município → zona.
- ✅ Tempo real via SSE; histórico e evolução temporal.
- ⏭️ BU por seção, segundo turno (a arquitetura já suporta novas `cd_eleicao`).
