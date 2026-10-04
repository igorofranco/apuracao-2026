import { createPublicKey, verify as cryptoVerify } from "node:crypto";

/** Chave pública JWK (Ed25519) usada para validar os arquivos assinados do TSE. */
export interface JwkPublicKey {
  kty: string;
  crv: string;
  x: string;
  [k: string]: unknown;
}

export class JwsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwsError";
  }
}

function b64urlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** Decodifica o payload (2ª parte) de um JWS compacto, sem verificar. */
export function decodeJwsPayload(token: string): string {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new JwsError("JWS malformado: esperado 3 partes");
  return b64urlToBuffer(parts[1] as string).toString("utf8");
}

/** Lê o header (1ª parte) de um JWS compacto. */
export function decodeJwsHeader(token: string): Record<string, unknown> {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new JwsError("JWS malformado: esperado 3 partes");
  return JSON.parse(b64urlToBuffer(parts[0] as string).toString("utf8"));
}

/**
 * Verifica a assinatura Ed25519 de um JWS compacto e devolve o payload.
 * Lança `JwsError` se a assinatura não bater.
 */
export function verifyJws(token: string, publicKey: JwkPublicKey): string {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new JwsError("JWS malformado: esperado 3 partes");
  const [header, payload, signature] = parts as [string, string, string];

  const key = createPublicKey({
    key: { kty: publicKey.kty, crv: publicKey.crv, x: publicKey.x },
    format: "jwk",
  });

  const signingInput = Buffer.from(`${header}.${payload}`);
  const ok = cryptoVerify(null, signingInput, key, b64urlToBuffer(signature));
  if (!ok) throw new JwsError("Assinatura JWS inválida");

  return b64urlToBuffer(payload).toString("utf8");
}
