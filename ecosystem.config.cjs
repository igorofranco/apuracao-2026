// Configuração do PM2 para o deploy (sem Docker).
// Uso: pm2 start ecosystem.config.cjs
// Requer Node 26 e npm instalados no servidor, e o build do web já executado.
//
// Variáveis vindas do ambiente (exporte antes de subir, ou use um .env com
// `set -a; source .env; set +a`). Os valores abaixo são apenas fallbacks.

module.exports = {
  apps: [
    {
      name: "apuracao-collector",
      cwd: __dirname,
      // Node 26 executa TypeScript nativamente (type stripping).
      script: "apps/collector/src/index.ts",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        HOST: process.env.HOST || "127.0.0.1",
        PORT: process.env.PORT || "8787",
        TSE_BASE_URL: process.env.TSE_BASE_URL || "https://resultados.tse.jus.br/",
        TSE_AMBIENTE: process.env.TSE_AMBIENTE || "oficial",
        TSE_VERIFY_JWS: process.env.TSE_VERIFY_JWS || "true",
        TSE_TIMEOUT_MS: process.env.TSE_TIMEOUT_MS || "15000",
        POLL_ACTIVE_MS: process.env.POLL_ACTIVE_MS || "15000",
        POLL_IDLE_MS: process.env.POLL_IDLE_MS || "60000",
        POLL_CONCURRENCY: process.env.POLL_CONCURRENCY || "8",
        REDIS_URL: process.env.REDIS_URL || "",
        DATABASE_URL: process.env.DATABASE_URL || "",
        CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
      },
    },
    {
      name: "apuracao-web",
      cwd: __dirname,
      // Com npm workspaces o `next` fica hoisted no node_modules da raiz.
      script: "node_modules/next/dist/bin/next",
      args: "start apps/web -p " + (process.env.WEB_PORT || "3000"),
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.WEB_PORT || "3000",
      },
    },
  ],
};
