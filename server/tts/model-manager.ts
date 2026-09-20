// Local TTS model weights manager.
//
// Handles checking, downloading, and storing model weights for local neural TTS
// engines (such as Kokoro on Apple Silicon or Piper) into ~/.agentbot/models/<provider>/.
//
// Downloads are initiated when an engine is activated. Concurrent activation
// requests share the same active download task.
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import { DATA_DIR } from "../config.ts";

export interface ModelFile {
  name: string;
  url: string;
  expectedSize: number;
}

export interface ModelDefinition {
  provider: "kokoro" | "piper";
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
    description: "Piper ONNX neural voice model and configuration",
    files: [
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
    totalBytes: 63_005_000,
  },
};

export function modelsBaseDir(baseDir: string = DATA_DIR): string {
  return join(baseDir, "models");
}

export function modelDir(provider: string, baseDir: string = DATA_DIR): string {
  return join(modelsBaseDir(baseDir), provider);
}

export function isLocalModelProvider(provider: string): provider is "kokoro" | "piper" {
  return Object.hasOwn(LOCAL_MODELS, provider);
}

export function getModelStatus(provider: string, baseDir: string = DATA_DIR): ModelStatus | null {
  const model = LOCAL_MODELS[provider];
  if (!model) return null;

  const dir = modelDir(provider, baseDir);
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
  const model = LOCAL_MODELS[provider];
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
    const targetDir = modelDir(provider, options.baseDir ?? DATA_DIR);
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
