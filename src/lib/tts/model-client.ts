// Client-side manager for checking, activating, and downloading local TTS models.
//
// Unifies status checks and download-on-activation across in-browser (jax-js)
// and host-managed local models (Kokoro on Apple Silicon and Piper).

import {
  activateJaxModel,
  currentDownloadProgress,
  isJaxModelCached,
  isJaxModelLoaded,
  type JaxProgress,
} from "./jax-tts";
import {
  currentKokoroProgress,
  isKokoroCached,
  isKokoroLoaded,
  loadKokoro,
} from "./kokoro-tts";

export interface UnifiedModelStatus {
  provider: "jax-js" | "kokoro" | "piper";
  downloaded: boolean;
  downloading: boolean;
  progress?: {
    loadedBytes?: number;
    totalBytes?: number;
    percent?: number;
    phase?: string;
    error?: string;
  } | null;
}

export async function checkLocalModelStatus(provider: string): Promise<UnifiedModelStatus> {
  if (provider === "jax-js") {
    const loaded = isJaxModelLoaded();
    const cached = loaded || (await isJaxModelCached());
    const progress = currentDownloadProgress();
    const downloading = progress?.phase === "downloading" || progress?.phase === "initializing";
    return {
      provider: "jax-js",
      downloaded: cached,
      downloading,
      progress: progress
        ? {
            loadedBytes: progress.loadedBytes,
            totalBytes: progress.totalBytes,
            percent: progress.percent,
            phase: progress.phase,
            error: progress.error,
          }
        : null,
    };
  }

  if (provider === "kokoro") {
    const loaded = isKokoroLoaded();
    const cached = loaded || (await isKokoroCached());
    let serverDownloaded = false;
    let serverDownloading = false;
    let serverProgress = null;
    try {
      const res = await fetch(`/api/tts/models/status?provider=kokoro`);
      if (res.ok) {
        const data = await res.json();
        serverDownloaded = Boolean(data.downloaded);
        serverDownloading = Boolean(data.downloading);
        serverProgress = data.progress;
      }
    } catch {
      // ignore network errors
    }
    const downloaded = cached || serverDownloaded;
    const clientProgress = currentKokoroProgress();
    return {
      provider: "kokoro",
      downloaded,
      downloading: serverDownloading,
      progress: downloaded
        ? { percent: 100, phase: "ready" }
        : serverProgress || (clientProgress?.progress !== undefined ? { percent: clientProgress.progress, phase: clientProgress.status || "downloading" } : null),
    };
  }

  if (provider === "piper") {
    try {
      const res = await fetch(`/api/tts/models/status?provider=${encodeURIComponent(provider)}`);
      if (res.ok) {
        const data = await res.json();
        return {
          provider,
          downloaded: Boolean(data.downloaded),
          downloading: Boolean(data.downloading),
          progress: data.progress,
        };
      }
    } catch {
      // ignore network errors and fallback
    }
    return {
      provider,
      downloaded: false,
      downloading: false,
      progress: null,
    };
  }

  return {
    provider: provider as any,
    downloaded: true,
    downloading: false,
  };
}

export interface ActivationCallbacks {
  onProgress?: (progress: {
    percent?: number;
    loadedBytes?: number;
    totalBytes?: number;
    phase: string;
    error?: string;
  }) => void;
  signal?: AbortSignal;
}

export async function activateLocalModel(
  provider: string,
  callbacks: ActivationCallbacks = {},
): Promise<void> {
  if (provider === "jax-js") {
    await activateJaxModel((p: JaxProgress) => {
      callbacks.onProgress?.({
        percent: p.percent,
        loadedBytes: p.loadedBytes,
        totalBytes: p.totalBytes,
        phase: p.phase,
        error: p.error,
      });
    }, callbacks.signal);
    return;
  }

  if (provider === "kokoro") {
    const clientLoad = loadKokoro((p) => {
      if (typeof p.progress === "number") {
        callbacks.onProgress?.({
          percent: p.progress,
          loadedBytes: p.loaded,
          totalBytes: p.total,
          phase: p.status === "done" ? "ready" : "downloading",
        });
      }
    }, callbacks.signal).catch((err) => {
      console.warn("Client Kokoro load notice:", err);
    });

    try {
      await fetch("/api/tts/models/download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "kokoro" }),
        signal: callbacks.signal,
      });
    } catch {
      // ignore
    }

    await clientLoad;
    callbacks.onProgress?.({
      percent: 100,
      phase: "ready",
    });
    return;
  }

  if (provider === "piper") {
    const startRes = await fetch("/api/tts/models/download", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider }),
      signal: callbacks.signal,
    });
    if (!startRes.ok) {
      const err = await startRes.json().catch(() => ({}));
      throw new Error(err.error ?? `Download request failed (${startRes.status})`);
    }

    // Poll status until download finishes or fails
    const startTime = Date.now();
    const timeoutMs = 15 * 60_000; // 15 minutes timeout for large weights

    while (!callbacks.signal?.aborted) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error("Download timed out");
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
      if (callbacks.signal?.aborted) break;

      const pollRes = await fetch(`/api/tts/models/status?provider=${encodeURIComponent(provider)}`, {
        signal: callbacks.signal,
      });
      if (pollRes.ok) {
        const status = await pollRes.json();
        if (status.progress) {
          callbacks.onProgress?.({
            percent: status.progress.percent,
            loadedBytes: status.progress.loadedBytes,
            totalBytes: status.progress.totalBytes,
            phase: status.progress.phase,
            error: status.progress.error,
          });
        }
        if (status.downloaded) {
          callbacks.onProgress?.({
            percent: 100,
            phase: "ready",
          });
          return;
        }
        if (status.progress?.phase === "failed") {
          throw new Error(status.progress.error || "Model download failed");
        }
      }
    }

    if (callbacks.signal?.aborted) {
      void cancelLocalModelDownload(provider);
      throw new Error("Download cancelled");
    }
  }
}

export async function cancelLocalModelDownload(provider: string): Promise<void> {
  if (provider === "kokoro" || provider === "piper") {
    try {
      await fetch("/api/tts/models/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider }),
      });
    } catch {
      // ignore
    }
  }
}
