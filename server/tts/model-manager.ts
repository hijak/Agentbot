// Local TTS model weights manager.
//
// Handles checking, downloading, and storing model weights for local neural TTS
// engines (such as Kokoro on Apple Silicon or Piper) into ~/.agentbot/models/<provider>/.
//
// Downloads are initiated when an engine is activated. Concurrent activation
// requests share the same active download task.
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import { DATA_DIR } from "../config.ts";

export interface ModelFile {
  name: string;
  url: string;
  expectedSize: number;
  /** For files the engine loads as code or data with real trust weight
   * (the Piper phonemizer wasm): pin the sha256 of the exact bytes we
   * ship against. A mismatch fails the download loudly. */
  sha256?: string;
}

export interface ModelDefinition {
  /** The download key this definition answers to: an engine name ("kokoro",
   * "piper") or a per-voice key ("piper-voice/<id>"). */
  provider: string;
  name: string;
  description: string;
  files: ModelFile[];
  totalBytes: number;
}

export interface DownloadProgress {
  provider: string;
  phase: "downloading" | "verifying" | "ready" | "failed";
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  error?: string;
}

export interface ModelFileStatus {
  name: string;
  exists: boolean;
  size?: number;
}

export interface ModelStatus {
  provider: string;
  name: string;
  downloaded: boolean;
  downloading: boolean;
  progress?: DownloadProgress | null;
  path: string;
  files: ModelFileStatus[];
  totalBytes: number;
}

export const LOCAL_MODELS: Record<string, ModelDefinition> = {
  kokoro: {
    provider: "kokoro",
    name: "Kokoro-82M",
    description: "Kokoro-82M model weights for high-speed Apple Silicon synthesis",
    files: [
      {
        name: "config.json",
        url: "https://huggingface.co/hexgrad/Kokoro-82M/raw/main/config.json",
        expectedSize: 2_000,
      },
      {
        name: "kokoro-v1_0.pth",
        url: "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/kokoro-v1_0.pth",
        expectedSize: 327_000_000,
      },
    ],
    totalBytes: 327_002_000,
  },
  piper: {
    provider: "piper",
    name: "Piper (Lessac)",
    description: "Piper phonemizer tooling and the default Lessac ONNX voice",
    // The phonemizer files are downloaded from unpkg, NOT jsDelivr: jsDelivr
    // serves a transformed wasm (observed sha256 mismatch) and 403s the
    // 18 MB espeak data file. unpkg serves the registry tarball's bytes
    // exactly; the pins below are the authority. Provenance lives in
    // third_party/piper-phonemize/README.md.
    files: [
      {
        name: "piper_phonemize.wasm",
        url: "https://unpkg.com/piper-tts-web@1.1.2/dist/piper/piper_phonemize.wasm",
        expectedSize: 629_166,
        sha256: "2189e43490744c95445e251c38a47063f2ca266bcc30bbb18f692c47ff2bfd23",
      },
      {
        name: "piper_phonemize.data",
        url: "https://unpkg.com/piper-tts-web@1.1.2/dist/piper/piper_phonemize.data",
        expectedSize: 18_077_249,
        sha256: "a9879123581336fc36ae3706ae81c9e67becc388b80b8a4943cef2a78542e6aa",
      },
      {
        name: "en_US-lessac-medium.onnx.json",
        url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json",
        expectedSize: 5_000,
      },
      {
        name: "en_US-lessac-medium.onnx",
        url: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
        expectedSize: 63_000_000,
      },
    ],
    totalBytes: 81_711_415,
  },
};

/** The curated Piper voice catalogue. Voice ids are also file names under
 * models/piper/ and URL path segments on Hugging Face, so this table is the
 * single source of truth — an id that is not listed here is rejected before
 * any download URL is built. */
export const PIPER_VOICE_MODEL_URLS: Record<string, { onnx: string; json: string; approxBytes: number }> = {
  "en_US-lessac-medium": {
    onnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
    json: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json",
    approxBytes: 63_000_000,
  },
  "en_US-amy-medium": {
    onnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx",
    json: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json",
    approxBytes: 63_000_000,
  },
  "en_US-ryan-medium": {
    onnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx",
    json: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/en_US-ryan-medium.onnx.json",
    approxBytes: 63_000_000,
  },
  "en_US-danny-low": {
    onnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/danny/low/en_US-danny-low.onnx",
    json: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/danny/low/en_US-danny-low.onnx.json",
    approxBytes: 30_000_000,
  },
  "en_GB-alan-medium": {
    onnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx",
    json: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json",
    approxBytes: 63_000_000,
  },
  "en_GB-alba-medium": {
    onnx: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alba/medium/en_GB-alba-medium.onnx",
    json: "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alba/medium/en_GB-alba-medium.onnx.json",
    approxBytes: 63_000_000,
  },
};

export function isPiperVoiceId(voiceId: string): boolean {
  return Object.hasOwn(PIPER_VOICE_MODEL_URLS, voiceId);
}

/** Download key for one voice's model pair (tooling itself is part of the
 * `piper` definition and only downloads once). */
export function piperVoiceDownloadKey(voiceId: string): string {
  return `piper-voice/${voiceId}`;
}

/** Definitions are addressable by download key: the two engines above, plus
 * one entry per Piper voice. */
function definitionFor(provider: string): ModelDefinition | null {
  if (Object.hasOwn(LOCAL_MODELS, provider)) return LOCAL_MODELS[provider]!;
  if (provider.startsWith("piper-voice/")) {
    const voiceId = provider.slice("piper-voice/".length);
    const urls = PIPER_VOICE_MODEL_URLS[voiceId];
    if (!urls) return null;
    return {
      provider,
      name: `Piper voice ${voiceId}`,
      description: `Piper ONNX voice model and configuration for ${voiceId}`,
      files: [
        { name: `${voiceId}.onnx.json`, url: urls.json, expectedSize: 5_000 },
        { name: `${voiceId}.onnx`, url: urls.onnx, expectedSize: urls.approxBytes },
      ],
      totalBytes: urls.approxBytes + 5_000,
    };
  }
  return null;
}

export function modelsBaseDir(baseDir: string = DATA_DIR): string {
  return join(baseDir, "models");
}

export function modelDir(provider: string, baseDir: string = DATA_DIR): string {
  return join(modelsBaseDir(baseDir), provider);
}

export function isLocalModelProvider(provider: string): provider is "kokoro" | "piper" {
  return Object.hasOwn(LOCAL_MODELS, provider);
}

/** Voice model pairs land beside the engine's own files under models/piper/,
 * so a voice download key resolves to the engine's directory. */
function modelTargetDir(provider: string, baseDir: string): string {
  return modelDir(provider.startsWith("piper-voice/") ? "piper" : provider, baseDir);
}

export function getModelStatus(provider: string, baseDir: string = DATA_DIR): ModelStatus | null {
  const model = definitionFor(provider);
  if (!model) return null;

  const dir = modelTargetDir(provider, baseDir);
  const fileStatuses: ModelFileStatus[] = model.files.map((f) => {
    const filePath = join(dir, f.name);
    if (existsSync(filePath)) {
      try {
        const stats = statSync(filePath);
        return { name: f.name, exists: true, size: stats.size };
      } catch {
        return { name: f.name, exists: true };
      }
    }
    return { name: f.name, exists: false };
  });

  const downloaded = fileStatuses.every((f) => f.exists && (f.size === undefined || f.size > 0));
  const active = activeDownloads.get(provider);

  return {
    provider,
    name: model.name,
    downloaded,
    downloading: Boolean(active),
    progress: active?.progress ?? null,
    path: dir,
    files: fileStatuses,
    totalBytes: model.totalBytes,
  };
}

interface ActiveDownload {
  promise: Promise<void>;
  controller: AbortController;
  progress: DownloadProgress;
}

const activeDownloads = new Map<string, ActiveDownload>();

export interface DownloadOptions {
  baseDir?: string;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

export function cancelDownload(provider: string): boolean {
  const active = activeDownloads.get(provider);
  if (!active) return false;
  active.controller.abort();
  activeDownloads.delete(provider);
  return true;
}

export function downloadModel(provider: string, options: DownloadOptions = {}): Promise<void> {
  const model = definitionFor(provider);
  if (!model) {
    return Promise.reject(new Error(`Unknown local model provider: ${provider}`));
  }

  const existing = activeDownloads.get(provider);
  if (existing) {
    if (options.onProgress) {
      options.onProgress(existing.progress);
    }
    return existing.promise;
  }

  const controller = new AbortController();
  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  const initialProgress: DownloadProgress = {
    provider,
    phase: "downloading",
    loadedBytes: 0,
    totalBytes: model.totalBytes,
    percent: 0,
  };

  const active: ActiveDownload = {
    controller,
    progress: initialProgress,
    promise: Promise.resolve(),
  };

  const run = (async () => {
    const targetDir = modelTargetDir(provider, options.baseDir ?? DATA_DIR);
    mkdirSync(targetDir, { recursive: true });

    const fetchFn = options.fetcher ?? fetch;
    let accumulatedBytes = 0;

    for (const file of model.files) {
      if (controller.signal.aborted) {
        throw new Error("Download aborted");
      }

      const destPath = join(targetDir, file.name);
      const partPath = `${destPath}.part`;

      // Check if already downloaded and valid size
      if (existsSync(destPath)) {
        try {
          const stats = statSync(destPath);
          if (stats.size > 0) {
            accumulatedBytes += stats.size;
            continue;
          }
        } catch {
          // re-download
        }
      }

      const res = await fetchFn(file.url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Failed to download ${file.name}: HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error(`Empty response body for ${file.name}`);
      }

      const outStream = createWriteStream(partPath);
      const nodeReadable = Readable.fromWeb(res.body as any);

      nodeReadable.on("data", (chunk: Buffer) => {
        accumulatedBytes += chunk.length;
        const percent = Math.min(100, Math.round((accumulatedBytes / model.totalBytes) * 100));
        active.progress = {
          provider,
          phase: "downloading",
          loadedBytes: accumulatedBytes,
          totalBytes: model.totalBytes,
          percent,
        };
        options.onProgress?.(active.progress);
      });

      try {
        await pipeline(nodeReadable, outStream);
        renameSync(partPath, destPath);
        // A pinned file is one we treat as trusted input; a byte that
        // disagrees with the pin means the source changed under us and the
        // file must not survive to be loaded.
        if (file.sha256) {
          const digest = createHash("sha256").update(readFileSync(destPath)).digest("hex");
          if (digest !== file.sha256) {
            rmSync(destPath, { force: true });
            throw new Error(
              `checksum mismatch for ${file.name}: the download does not match the pinned build — refetch or update the pin`,
            );
          }
        }
      } catch (err) {
        try {
          rmSync(partPath, { force: true });
        } catch {
          // ignore
        }
        throw err;
      }
    }

    active.progress = {
      provider,
      phase: "ready",
      loadedBytes: model.totalBytes,
      totalBytes: model.totalBytes,
      percent: 100,
    };
    options.onProgress?.(active.progress);
  })()
    .catch((err) => {
      active.progress = {
        provider,
        phase: "failed",
        loadedBytes: active.progress.loadedBytes,
        totalBytes: model.totalBytes,
        percent: active.progress.percent,
        error: err instanceof Error ? err.message : String(err),
      };
      options.onProgress?.(active.progress);
      throw err;
    })
    .finally(() => {
      activeDownloads.delete(provider);
    });

  active.promise = run;
  activeDownloads.set(provider, active);
  return run;
}
