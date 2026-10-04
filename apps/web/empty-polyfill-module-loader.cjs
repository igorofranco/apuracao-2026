"use strict";

/**
 * Esvazia o `next-polyfill-module` injetado pelo Next.
 *
 * O Next embute esse módulo em todo build de cliente, independentemente do
 * `browserslist` (ver vercel/next.js#86785). Nossos alvos (Chrome 111+,
 * Safari 16.4+) já implementam nativamente tudo o que ele fornece, então o
 * polyfill é apenas peso morto — o Lighthouse o reporta como "JavaScript
 * legado". Este loader o substitui por um módulo vazio.
 *
 * Restrito a builds de browser em produção (ver `turbopack.rules`).
 */
module.exports = function emptyPolyfillModuleLoader() {
  return "module.exports = {};\n";
};
