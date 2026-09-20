// In-browser speech synthesis using jax-js (Kyutai Pocket TTS).
//
// Key principles:
// 1. STRICT LAZY LOADING: Model weights (~100MB safetensors) and tokenizers
//    are NEVER fetched when browsing settings or opening the app. Loading
//    starts strictly on-demand on the first phone call or manual prepare.
// 2. CACHING: Model weights and voice embeddings are cached locally via
//    @jax-js/loaders OPFS/Cache API so subsequent calls are instant.
// 3. HARDWARE ACCELERATION: Automatically utilizes WebGPU with fp16 activations;
//    falls back gracefully to WebAssembly (Wasm) fp32 execution.
// 4. INSTANT INTERRUPTION: Playback and generation halt immediately on stop().

import { defaultDevice, init, numpy as np, random, tree } from "@jax-js/jax";
import { cachedFetch, safetensors, tokenizers } from "@jax-js/loaders";
import {
  createFlowLMState,
  createMimiDecodeState,
  fromSafetensors,
  runFlowLMStep,
  runMimiDecode,
  type PocketTTS,
} from "./pocket-tts";

export const SAMPLE_RATE = 24000;

export const HF_URL_PREFIX =
  "https://huggingface.co/kyutai/pocket-tts-without-voice-cloning/resolve/fbf8280";

export const WEIGHTS_URL =
  "https://huggingface.co/ekzhang/jax-js-models/resolve/main/kyutai-pocket-tts_b6369a24-fp16.safetensors";

export const TOKENIZER_URL = `${HF_URL_PREFIX}/tokenizer.model`;

export const PREDEFINED_VOICES: Record<string, string> = {
  alba: `${HF_URL_PREFIX}/embeddings/alba.safetensors`,
  azelma: `${HF_URL_PREFIX}/embeddings/azelma.safetensors`,
  cosette: `${HF_URL_PREFIX}/embeddings/cosette.safetensors`,
  eponine: `${HF_URL_PREFIX}/embeddings/eponine.safetensors`,
  fantine: `${HF_URL_PREFIX}/embeddings/fantine.safetensors`,
  javert: `${HF_URL_PREFIX}/embeddings/javert.safetensors`,
  jean: `${HF_URL_PREFIX}/embeddings/jean.safetensors`,
  marius: `${HF_URL_PREFIX}/embeddings/marius.safetensors`,
};

export type JaxVoiceName = keyof typeof PREDEFINED_VOICES;

export interface JaxProgress {
  phase: "downloading" | "initializing" | "generating" | "ready";
  loadedBytes?: number;
  totalBytes?: number;
  percent?: number;
  device?: string;
  error?: string;
}

// ── Singleton lazy state ────────────────────────────────────────────────
let _weights: safetensors.File | null = null;
let _model: PocketTTS | null = null;
let _tokenizer: tokenizers.SentencePiece | null = null;
const _voiceEmbeds = new Map<string, np.Array>();
let _deviceReady: string | null = null;

let _lastProgress: JaxProgress | null = null;
let _activePlayer: StreamingAudioPlayer | null = null;

export function isJaxVoice(voiceId?: string): boolean {
  if (!voiceId) return false;
  const normalized = voiceId.toLowerCase().trim();
  return Object.hasOwn(PREDEFINED_VOICES, normalized);
}

export function isJaxModelLoaded(): boolean {
  return _model !== null && _tokenizer !== null;
}

export async function isJaxModelCached(): Promise<boolean> {
  if (_model && _tokenizer) return true;
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const match = await window.caches.match(WEIGHTS_URL);
      if (match) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export function currentDownloadProgress(): JaxProgress | null {
  return _lastProgress;
}

/** Reset internal cached model for testing purposes. */
export function resetJaxState(): void {
  _weights = null;
  _model = null;
  _tokenizer = null;
  for (const embed of _voiceEmbeds.values()) {
    try {
      embed.dispose();
    } catch {
      // ignore
    }
  }
  _voiceEmbeds.clear();
  _deviceReady = null;
  _lastProgress = null;
}

/** Select fastest available compute device (WebGPU -> Wasm -> cpu). */
export async function initJaxDevice(): Promise<string> {
  if (_deviceReady) return _deviceReady;
  try {
    const devices = await init("webgpu", "wasm");
    if (devices.includes("webgpu")) {
      defaultDevice("webgpu");
      _deviceReady = "webgpu";
    } else if (devices.includes("wasm")) {
      defaultDevice("wasm");
      _deviceReady = "wasm";
    } else {
      defaultDevice("cpu");
      _deviceReady = "cpu";
    }
  } catch (err) {
    console.warn("initJaxDevice fallback to cpu:", err);
    defaultDevice("cpu");
    _deviceReady = "cpu";
  }
  return _deviceReady;
}

/**
 * Lazily download and load model weights on demand.
 * Cached in OPFS / Cache API so it only downloads once.
 */
export async function loadJaxModel(
  onProgress?: (p: JaxProgress) => void,
  signal?: AbortSignal,
): Promise<{ model: PocketTTS; tokenizer: tokenizers.SentencePiece }> {
  if (_model && _tokenizer) {
    return { model: _model, tokenizer: _tokenizer };
  }

  const device = await initJaxDevice();
  if (signal?.aborted) throw new Error("Cancelled");

  if (!_weights) {
    const progressEvent: JaxProgress = { phase: "downloading", loadedBytes: 0, percent: 0 };
    _lastProgress = progressEvent;
    onProgress?.(progressEvent);

    const data = await cachedFetch(
      WEIGHTS_URL,
      { signal },
      (p) => {
        const percent = p.totalBytes ? Math.min(100, Math.round((p.loadedBytes / p.totalBytes) * 100)) : undefined;
        const ev: JaxProgress = {
          phase: "downloading",
          loadedBytes: p.loadedBytes,
          totalBytes: p.totalBytes,
          percent,
        };
        _lastProgress = ev;
        onProgress?.(ev);
      },
    );

    if (signal?.aborted) throw new Error("Cancelled");
    _weights = safetensors.parse(data);
  }

  const initEvent: JaxProgress = { phase: "initializing", device };
  _lastProgress = initEvent;
  onProgress?.(initEvent);

  const weightDtype = device === "wasm" || device === "cpu" ? np.float32 : np.float16;

  if (!_model) {
    _model = fromSafetensors(_weights, weightDtype);
  }

  if (!_tokenizer) {
    _tokenizer = await tokenizers.loadSentencePiece(TOKENIZER_URL);
  }

  return { model: _model, tokenizer: _tokenizer };
}

/**
 * Download and activate model weights on activation.
 * Cached in OPFS / Cache API so it only downloads once.
 */
export async function activateJaxModel(
  onProgress?: (p: JaxProgress) => void,
  signal?: AbortSignal,
): Promise<{ model: PocketTTS; tokenizer: tokenizers.SentencePiece }> {
  const result = await loadJaxModel(onProgress, signal);
  try {
    await loadVoiceEmbedding("azelma", signal);
  } catch {
    // ignore
  }
  const readyEvent: JaxProgress = {
    phase: "ready",
    percent: 100,
    device: _deviceReady ?? undefined,
  };
  _lastProgress = readyEvent;
  onProgress?.(readyEvent);
  return result;
}

/**
 * Load voice embedding for a character voice (alba, azelma, etc.).
 * Cached locally once fetched.
 */
export async function loadVoiceEmbedding(voiceName: string, signal?: AbortSignal): Promise<np.Array> {
  const normalized = voiceName.toLowerCase().trim();
  const voice = Object.hasOwn(PREDEFINED_VOICES, normalized) ? normalized : "azelma";

  const cached = _voiceEmbeds.get(voice);
  if (cached) return cached;

  const url = PREDEFINED_VOICES[voice]!;
  const data = await cachedFetch(url, { signal });
  const parsed = safetensors.parse(data);
  const audioPrompt = parsed.tensors.audio_prompt;
  if (!audioPrompt) throw new Error(`Invalid voice embedding for ${voice}`);

  const device = await initJaxDevice();
  const embedDtype = device === "wasm" || device === "cpu" ? np.float32 : np.float16;

  const embed = np
    .array(audioPrompt.data as Float32Array<ArrayBuffer>, {
      shape: audioPrompt.shape,
      dtype: np.float32,
    })
    .slice(0)
    .astype(embedDtype);

  _voiceEmbeds.set(voice, embed);
  return embed;
}

/**
 * Text preparation ported from Kyutai Pocket TTS.
 * Ensures initial capital letter, punctuation ending, and min-token padding.
 */
export function prepareTextPrompt(text: string): [string, number] {
  text = text.trim();
  if (text === "") throw new Error("Prompt cannot be empty");
  text = text.replace(/\s+/g, " ");
  const words = text.split(" ");
  let framesAfterEosGuess = 3;
  if (words.length <= 4) {
    framesAfterEosGuess = 5;
  }

  // Capitalize first letter
  text = text.replace(/^(\p{Ll})/u, (c) => c.toLocaleUpperCase());

  // Ensure trailing punctuation
  if (/[\p{L}\p{N}]$/u.test(text)) {
    text = text + ".";
  }

  // Pocket TTS performs better when token count isn't too short
  if (words.length < 5) {
    text = " ".repeat(8) + text;
  }

  return [text, framesAfterEosGuess];
}

/** Build the text + speaker conditioning sequence without invalidating token indices. */
export function createConditioningEmbeds(
  conditionerEmbed: np.Array,
  voiceEmbed: np.Array,
  tokens: number[],
): np.Array {
  const tokensAr = np.array(tokens, { dtype: np.uint32 });
  // Array operations consume their arguments. Keep our local token array alive
  // through the gather by passing an extra reference, then release our owner.
  const textEmbeds = conditionerEmbed.ref.slice(tokensAr.ref);
  tokensAr.dispose();
  return np.concatenate([voiceEmbed.ref, textEmbeds]);
}

export interface StreamingAudioPlayer {
  playChunk(samples: Float32Array): Promise<void>;
  stop(): void;
  close(): Promise<void>;
  readonly context: AudioContext | null;
}

export function createStreamingPlayer(existingCtx?: AudioContext | null): StreamingAudioPlayer {
  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      : null;

  const audioCtx = existingCtx ?? (AudioCtx ? new AudioCtx({ sampleRate: SAMPLE_RATE }) : null);

  if (!audioCtx) {
    return {
      playChunk: () => Promise.resolve(),
      stop() {},
      close: () => Promise.resolve(),
      context: null,
    };
  }

  // If audio context is suspended, attempt immediate resume (best when called on click)
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }

  let nextStartTime = audioCtx.currentTime;
  let lastEndedPromise: Promise<void> = Promise.resolve();
  const activeSources = new Set<AudioBufferSourceNode>();
  let stopped = false;

  return {
    async playChunk(samples: Float32Array) {
      if (stopped) return;
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const buffer = audioCtx.createBuffer(1, samples.length, SAMPLE_RATE);
      buffer.getChannelData(0).set(samples);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);

      const startTime = Math.max(nextStartTime, audioCtx.currentTime);
      source.start(startTime);
      nextStartTime = startTime + buffer.duration;

      activeSources.add(source);
      const endedPromise = new Promise<void>((resolve) => {
        source.onended = () => {
          activeSources.delete(source);
          resolve();
        };
      });
      lastEndedPromise = Promise.all([lastEndedPromise, endedPromise]).then(() => {});
    },

    stop() {
      stopped = true;
      for (const src of Array.from(activeSources)) {
        try {
          src.stop();
          src.disconnect();
        } catch {
          // ignore
        }
      }
      activeSources.clear();
      try {
        void audioCtx.close();
      } catch {
        // ignore
      }
    },

    async close() {
      await lastEndedPromise;
      if (!stopped) {
        stopped = true;
        try {
          await audioCtx.close();
        } catch {
          // ignore
        }
      }
    },

    get context() {
      return audioCtx;
    },
  };
}

/** Stop any currently playing jax-js audio stream. */
export function stopJaxAudio(): void {
  if (_activePlayer) {
    _activePlayer.stop();
    _activePlayer = null;
  }
}

export interface JaxSpeakOptions {
  voice?: string;
  seed?: number | null;
  temperature?: number;
  lsdDecodeSteps?: number;
  noiseClamp?: number | null;
  onProgress?: (progress: JaxProgress) => void;
  onCaption?: (utterance: string) => void;
  signal?: AbortSignal;
  player?: StreamingAudioPlayer;
}

/**
 * Synthesize speech and play it in real-time.
 * Strictly lazy: weights only downloaded here if not already cached.
 */
export async function speakJaxUtterance(
  text: string,
  options: JaxSpeakOptions = {},
): Promise<void> {
  const {
    voice = "azelma",
    seed = null,
    temperature = 0.7,
    lsdDecodeSteps = 1,
    noiseClamp = null,
    onProgress,
    onCaption,
    signal,
    player: customPlayer,
  } = options;

  if (signal?.aborted) return;

  const { model, tokenizer } = await loadJaxModel(onProgress, signal);
  if (signal?.aborted) return;

  const voiceEmbed = await loadVoiceEmbedding(voice, signal);
  if (signal?.aborted) return;

  const [promptText, framesAfterEos] = prepareTextPrompt(text);
  onCaption?.(text);

  const tokens = tokenizer.encode(promptText);
  const embeds = createConditioningEmbeds(model.flowLM.conditionerEmbed, voiceEmbed, tokens);

  const player = customPlayer ?? createStreamingPlayer();
  _activePlayer = player;

  let lastLatent = model.flowLM.bosEmb.ref.reshape([1, -1]); // [1, 32]
  let audioPromise: Promise<void> = Promise.resolve();
  let key = random.key(seed ?? Math.floor(Math.random() * 2 ** 32));

  try {
    let flowLMState = createFlowLMState(model.flowLM);
    let mimiState = createMimiDecodeState(model.mimi);
    let eosStep: number | null = null;

    onProgress?.({ phase: "generating" });

    for (let step = 0; step < 1000; step++) {
      if (signal?.aborted) break;

      let stepKey: np.Array;
      [key, stepKey] = random.split(key);
      const {
        latent,
        isEos,
        state: newFlowLMState,
      } = runFlowLMStep(
        tree.ref(model.flowLM),
        flowLMState,
        stepKey,
        lastLatent.ref,
        step === 0 ? embeds.ref : null,
        flowLMState.kvCacheLen,
        lsdDecodeSteps,
        temperature,
        noiseClamp,
      );
      flowLMState = newFlowLMState;

      const isEosData = await isEos.data();
      if (isEosData[0] && eosStep === null) {
        eosStep = step;
      }
      if (eosStep !== null && step >= eosStep + framesAfterEos) {
        latent.dispose();
        break;
      }

      const prevLatent = lastLatent;
      lastLatent = latent;
      prevLatent.dispose();

      const mimiInput = latent.ref
        .mul(model.flowLM.embStd.ref)
        .add(model.flowLM.embMean.ref);

      const [audio, newMimiState] = runMimiDecode(
        tree.ref(model.mimi),
        mimiState,
        mimiInput,
      );
      mimiState = newMimiState;

      if (signal?.aborted) {
        audio.dispose();
        break;
      }

      const prevAudioPromise = audioPromise;
      audioPromise = (async () => {
        if (signal?.aborted) return;
        const audioPcm = (await np
          .clip(audio.slice(0), -1, 1)
          .astype(np.float32)
          .data()) as Float32Array;
        await prevAudioPromise;
        if (!signal?.aborted) {
          await player.playChunk(audioPcm);
        }
      })();
    }

    await audioPromise;
    if (!signal?.aborted) {
      await player.close();
    }
  } finally {
    lastLatent.dispose();
    embeds.dispose();
    if (_activePlayer === player) {
      _activePlayer = null;
    }
  }
}
