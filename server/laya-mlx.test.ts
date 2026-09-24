import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  isLayaMlxSupported,
  layaMlxStatus,
  downloadPythonArchive,
  LAYA_PYTHON_BUILD,
  LAYA_PYTHON_SHA256,
  LAYA_PYTHON_VERSION,
  LAYA_MLX_MODEL,
  LAYA_MLX_VERSION,
  provisionLayaPython,
} from "./laya-mlx.ts";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Laya-MLX support", () => {
  it("only supports macOS Apple Silicon", () => {
    expect(isLayaMlxSupported("darwin", "arm64", "23.0.0")).toBe(true);
    expect(isLayaMlxSupported("darwin", "arm64", "22.0.0")).toBe(false);
    expect(isLayaMlxSupported("darwin", "x64")).toBe(false);
    expect(isLayaMlxSupported("linux", "arm64")).toBe(false);
  });

  it("reports the pinned runtime and opt-in install status without installing", () => {
    const root = mkdtempSync(join(tmpdir(), "agentbot-laya-status-"));
    tempRoots.push(root);
    const status = layaMlxStatus(root);

    expect(LAYA_MLX_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(LAYA_MLX_MODEL).toBe("aac6fef/laya-typed-decisions-mlx");
    expect(status.installed).toBe(false);
    expect(status.installing).toBe(false);
    expect(status.ready).toBe(false);
  });

  it("pins an app-managed Apple Silicon Python runtime", () => {
    expect(LAYA_PYTHON_VERSION).toBe("3.12.14");
    expect(LAYA_PYTHON_BUILD).toBe("20260814");
    expect(LAYA_PYTHON_SHA256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retries a transient runtime download failure without system Python", async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: { code: "ETIMEDOUT" } }))
      .mockResolvedValueOnce(new Response(Uint8Array.from([1, 2, 3])));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(downloadPythonArchive("https://example.test/python.tar.gz", {
      fetchImpl,
      sleep,
      sha256: createHash("sha256").update(Buffer.from([1, 2, 3])).digest("hex"),
    })).resolves.toEqual(Buffer.from([1, 2, 3]));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("provisions the pinned runtime into app-owned tools and reuses it", async () => {
    const root = mkdtempSync(join(tmpdir(), "agentbot-laya-python-"));
    tempRoots.push(root);
    const download = vi.fn().mockResolvedValue(Buffer.from("fixture archive"));
    const extract = vi.fn(async (_archive: string, destination: string) => {
      const bin = join(destination, "python", "bin");
      mkdirSync(bin, { recursive: true });
      const executable = join(bin, "python3.12");
      writeFileSync(executable, "#!/bin/sh\nprintf '3.12.14\\n'\n");
      chmodSync(executable, 0o700);
    });

    const executable = await provisionLayaPython(root, { download, extract });
    expect(existsSync(executable)).toBe(true);
    expect(readFileSync(join(root, "tools", "laya-mlx", "python", "bin", "python3.12"), "utf8"))
      .toContain("3.12.14");
    await expect(provisionLayaPython(root, { download, extract })).resolves.toBe(executable);
    expect(download).toHaveBeenCalledTimes(1);
    expect(extract).toHaveBeenCalledTimes(1);
  });
});
