import { describe, expect, it, vi } from "vitest";
import { AsyncCache } from "../src/async-cache.ts";

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("AsyncCache", () => {
  it("deduplica requisições em voo (produz uma vez)", async () => {
    const cache = new AsyncCache<string, number>();
    const produzir = vi.fn(async () => {
      await dormir(5);
      return 1;
    });

    const [a, b, c] = await Promise.all([
      cache.get("k", produzir),
      cache.get("k", produzir),
      cache.get("k", produzir),
    ]);

    expect([a, b, c]).toEqual([1, 1, 1]);
    expect(produzir).toHaveBeenCalledTimes(1);
  });

  it("reaproveita o valor em cache", async () => {
    const cache = new AsyncCache<string, number>();
    const produzir = vi.fn(async () => 7);

    expect(await cache.get("k", produzir)).toBe(7);
    expect(await cache.get("k", produzir)).toBe(7);
    expect(produzir).toHaveBeenCalledTimes(1);
    expect(cache.tamanho).toBe(1);
  });

  it("recalcula após o TTL", async () => {
    const cache = new AsyncCache<string, number>({ ttlMs: 5 });
    let n = 0;
    const produzir = async () => ++n;

    expect(await cache.get("k", produzir)).toBe(1);
    await dormir(10);
    expect(await cache.get("k", produzir)).toBe(2);
  });

  it("remove o inflight quando o produtor falha", async () => {
    const cache = new AsyncCache<string, number>();
    await expect(
      cache.get("k", async () => {
        throw new Error("falhou");
      }),
    ).rejects.toThrow("falhou");

    expect(await cache.get("k", async () => 9)).toBe(9);
  });
});
