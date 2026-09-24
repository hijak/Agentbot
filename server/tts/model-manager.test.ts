import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  cancelDownload,
  downloadModel,
  getModelStatus,
  isLocalModelProvider,
  LOCAL_MODELS,
  modelDir,
} from "./model-manager.ts";

describe("TTS Model Manager", () => {
  it("recognizes local model providers", () => {
    expect(isLocalModelProvider("kokoro")).toBe(true);
    expect(isLocalModelProvider("piper")).toBe(true);
    expect(isLocalModelProvider("elevenlabs")).toBe(false);
    expect(isLocalModelProvider("fish")).toBe(false);
    expect(isLocalModelProvider("system")).toBe(false);
  });

  it("reports missing files when model directory is empty", () => {
    const base = mkdtempSync(join(tmpdir(), "tts-test-"));
    try {
      const status = getModelStatus("kokoro", base);
      expect(status).not.toBeNull();
      expect(status?.provider).toBe("kokoro");
      expect(status?.downloaded).toBe(false);
      expect(status?.downloading).toBe(false);
      expect(status?.files.every((f) => !f.exists)).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("reports downloaded when all model files exist with size > 0", () => {
    const base = mkdtempSync(join(tmpdir(), "tts-test-"));
    try {
      const dir = modelDir("kokoro", base);
      mkdirSync(dir, { recursive: true });
      for (const f of LOCAL_MODELS.kokoro.files) {
        writeFileSync(join(dir, f.name), "mock content");
      }
      const status = getModelStatus("kokoro", base);
      expect(status?.downloaded).toBe(true);
      expect(status?.downloading).toBe(false);
      expect(status?.files.every((f) => f.exists && f.size! > 0)).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("downloads model files with progress and writes them to disk", async () => {
    const base = mkdtempSync(join(tmpdir(), "tts-test-"));
    const progressEvents: any[] = [];

    const mockFetcher: typeof fetch = async (input: any) => {
      const url = String(input);
      const content = url.endsWith(".json") ? '{"model": "kokoro"}' : "weights binary stream data";
      const encoder = new TextEncoder();
      const bytes = encoder.encode(content);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
      return new Response(stream, { status: 200, headers: { "content-length": String(bytes.byteLength) } });
    };

    try {
      await downloadModel("kokoro", {
        baseDir: base,
        fetcher: mockFetcher,
        onProgress: (p) => progressEvents.push(p),
      });

      const dir = modelDir("kokoro", base);
      expect(existsSync(join(dir, "config.json"))).toBe(true);
      expect(existsSync(join(dir, "kokoro-v1_0.pth"))).toBe(true);

      const status = getModelStatus("kokoro", base);
      expect(status?.downloaded).toBe(true);
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].phase).toBe("ready");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("handles download abort gracefully", async () => {
    const base = mkdtempSync(join(tmpdir(), "tts-test-"));
    const controller = new AbortController();

    const mockFetcher: typeof fetch = async () => {
      controller.abort();
      throw new Error("aborted");
    };

    try {
      await expect(
        downloadModel("piper", {
          baseDir: base,
          fetcher: mockFetcher,
          signal: controller.signal,
        }),
      ).rejects.toThrow();

      const status = getModelStatus("piper", base);
      expect(status?.downloading).toBe(false);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("cancels active download via cancelDownload", () => {
    expect(cancelDownload("non-existent")).toBe(false);
  });
});

describe("Piper tooling and voices", () => {
  const bytes = (text: string) => {
    const encoded = new TextEncoder().encode(text);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    });
    return new Response(stream, { status: 200 });
  };

  it("pins the phonemizer tooling behind checksums", () => {
    const pinned = LOCAL_MODELS.piper.files.filter((f) => f.sha256);
    expect(pinned.map((f) => f.name).sort()).toEqual(["piper_phonemize.data", "piper_phonemize.wasm"]);
  });

  it("rejects a tooling file that does not match its pin, and does not keep it", async () => {
    const base = mkdtempSync(join(tmpdir(), "tts-piper-pin-"));
    try {
      await expect(
        downloadModel("piper", { baseDir: base, fetcher: async () => bytes("imposter bytes") }),
      ).rejects.toThrow(/checksum mismatch/);
      expect(existsSync(join(modelDir("piper", base), "piper_phonemize.wasm"))).toBe(false);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("downloads a curated voice's model pair beside the engine's own files", async () => {
    const base = mkdtempSync(join(tmpdir(), "tts-piper-voice-"));
    try {
      await downloadModel("piper-voice/en_GB-alan-medium", { baseDir: base, fetcher: async () => bytes("{}") });
      const dir = modelDir("piper", base);
      expect(existsSync(join(dir, "en_GB-alan-medium.onnx.json"))).toBe(true);
      expect(existsSync(join(dir, "en_GB-alan-medium.onnx"))).toBe(true);

      const status = getModelStatus("piper-voice/en_GB-alan-medium", base);
      expect(status?.downloaded).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("refuses to build a download URL for a voice outside the catalogue", async () => {
    const base = mkdtempSync(join(tmpdir(), "tts-piper-voice-"));
    try {
      await expect(
        downloadModel("piper-voice/en_US-impostor-medium", { baseDir: base, fetcher: async () => bytes("{}") }),
      ).rejects.toThrow(/Unknown local model provider/);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
