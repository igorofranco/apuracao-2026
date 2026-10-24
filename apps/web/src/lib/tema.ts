/**
 * Tema claro/escuro.
 *
 * A escolha fica no `localStorage`; sem escolha salva, o site segue o sistema.
 * O script abaixo roda no `<head>`, antes do primeiro paint, para que a classe
 * `.dark` já esteja no `<html>` quando a página aparecer (sem flash de tema
 * claro). A mesma chave é usada pelo botão do cabeçalho.
 */
export const TEMA_CHAVE = "apuracao-theme";

/**
 * Script inline (string) aplicado no layout raiz com `beforeInteractive`.
 * Mantido sem dependências e com try/catch porque `localStorage` pode lançar
 * (ex.: navegação privada com armazenamento bloqueado).
 */
export const TEMA_SCRIPT = `(function(){try{var salvo=localStorage.getItem(${JSON.stringify(
  TEMA_CHAVE,
)});var escuro=salvo?salvo==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",escuro);}catch(e){}})();`;
