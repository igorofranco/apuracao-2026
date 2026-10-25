/**
 * Tema claro/escuro.
 *
 * O tema segue **exclusivamente** a preferência do dispositivo
 * (`prefers-color-scheme`), definida em `app/globals.css`: as variáveis de cor
 * trocam por media query, sem classe `.dark`, sem script no `<head>` e sem
 * `localStorage`. Não há seletor manual nem escolha persistida.
 *
 * A chave abaixo é mantida apenas para o componente legado `SiteHeader`, que
 * não é mais renderizado.
 */
export const TEMA_CHAVE = "apuracao-theme";
