// Local Kokoro TTS runner.
//
// Synthesizes speech using Kokoro-82M on Apple Silicon (WebGPU hardware acceleration
// via Metal / Neural Engine, falling back to Wasm).
//
// Supports all Kokoro voices: af_heart, af_bella, af_nicole, am_adam, am_michael,
// bf_emma, bm_george, etc.

export const KOKORO_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

let _kokoroInstance: any = null;
let _kokoroLoadingPromise: Promise<any> | null = null;
let _lastKokoroProgress: { progress?: number; loaded?: number; total?: number; status?: string } | null = null;

export function isKokoroLoaded(): boolean {
  return _kokoroInstance !== null;
}

export async function isKokoroCached(): Promise<boolean> {
  if (isKokoroLoaded()) return true;
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cacheNames = await window.caches.keys();
      for (const name of cacheNames) {
        if (name.includes("transformers") || name.includes("kokoro")) {
          const cache = await window.caches.open(name);
          const keys = await cache.keys();
          if (keys.length > 0) return true;
        }
      }
    } catch {
      // ignore
    }
  }
  return false;
}

export function currentKokoroProgress(): typeof _lastKokoroProgress {
  return _lastKokoroProgress;
}

export async function loadKokoro(
  onProgress?: (progress: { progress?: number; loaded?: number; total?: number; status?: string }) => void,
  signal?: AbortSignal,
): Promise<any> {
  if (_kokoroInstance) return _kokoroInstance;
  if (_kokoroLoadingPromise) return _kokoroLoadingPromise;

  const promise = (async () => {
    // Dynamic import to avoid bundling penalties until Kokoro is used
    const { KokoroTTS } = await import("kokoro-js");

    if (signal?.aborted) throw new Error("Cancelled");

    // Check device capabilities (WebGPU on Apple Silicon uses Metal GPU)
    const isBrowser = typeof window !== "undefined";
    const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
    const device = hasWebGPU ? "webgpu" : isBrowser ? "wasm" : null;
    const dtype = hasWebGPU ? "fp32" : "q8";

    const tts = await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
      dtype,
      ...(device ? { device } : {}),
      progress_callback: (p: any) => {
        if (signal?.aborted) return;
        const progressInfo = {
          progress: typeof p.progress === "number" ? Math.round(p.progress) : undefined,
          loaded: p.loaded,
          total: p.total,
          status: p.status,
        };
        _lastKokoroProgress = progressInfo;
        onProgress?.(progressInfo);
      },
    });

    _kokoroInstance = tts;
    return tts;
  })().finally(() => {
    _kokoroLoadingPromise = null;
  });

  _kokoroLoadingPromise = promise;
  return promise;
}

export async function speakKokoroUtterance(
  text: string,
  options: {
    voice?: string;
    speed?: number;
    signal?: AbortSignal;
  } = {},
): Promise<Blob> {
  const tts = await loadKokoro(undefined, options.signal);
  if (options.signal?.aborted) throw new Error("Cancelled");

  const voice = options.voice || "af_heart";
  const audio = await tts.generate(text, {
    voice,
    speed: options.speed ?? 1.0,
  });

  if (options.signal?.aborted) throw new Error("Cancelled");
  return audio.toBlob();
}
