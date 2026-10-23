/**
 * Fotos oficiais dos candidatos, publicadas pelo TSE no pacote de dados abertos
 * (`foto_cand2026_<UF>_div.zip`). O nome do arquivo é o `sqcand` do resultado.
 *
 * Neste projeto as fotos da Presidência (abrangência `br`) ficam em
 * `public/fotos/2026/br/<sqcand>.jpg`.
 */
export function fotoCandidato(
  sqcand: string | null | undefined,
  uf = "br",
): string | null {
  if (!sqcand || !/^\d+$/.test(sqcand)) return null;
  const sigla = uf.toLowerCase();
  return `/fotos/2026/${sigla}/${sqcand}.jpg`;
}
