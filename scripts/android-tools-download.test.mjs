import { describe, expect, it, vi } from "vitest";
import { downloadAndroidToolsArchive } from "./android-tools-download.mjs";

describe("Android Platform Tools download", () => {
  it("retries transient fetch failures and returns the successful archive", async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: { code: "ETIMEDOUT" } }))
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: { code: "ECONNRESET" } }))
      .mockResolvedValueOnce(new Response(Uint8Array.from([1, 2, 3])));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onRetry = vi.fn();

    await expect(downloadAndroidToolsArchive("https://example.test/tools.zip", {
      fetchImpl,
      sleep,
      onRetry,
    })).resolves.toEqual(Buffer.from([1, 2, 3]));
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[1_000], [2_000]]);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("retries server errors but fails immediately for client errors", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(Uint8Array.from([4]), { status: 200 }));
    await expect(downloadAndroidToolsArchive("https://example.test/tools.zip", {
      fetchImpl,
      sleep: async () => {},
    })).resolves.toEqual(Buffer.from([4]));

    const clientErrorFetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    await expect(downloadAndroidToolsArchive("https://example.test/tools.zip", {
      fetchImpl: clientErrorFetch,
      sleep: async () => {},
    })).rejects.toThrow(/HTTP 404/);
    expect(clientErrorFetch).toHaveBeenCalledTimes(1);
  });

  it("reports the final network cause after bounded retries", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(
      new TypeError("fetch failed", { cause: { code: "ETIMEDOUT" } }),
    );
    await expect(downloadAndroidToolsArchive("https://example.test/tools.zip", {
      fetchImpl,
      sleep: async () => {},
    })).rejects.toThrow(/after 3 attempts: fetch failed \(ETIMEDOUT\)/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
