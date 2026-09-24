// Piper, the fast local CPU neural voice engine — integrated.
//
// Piper is a VITS model: its input is a stream of espeak-ng phoneme ids, not
// text. Speaking one utterance in-process therefore has three stages:
//
//   text ──(piper_phonemize, espeak-ng compiled to wasm)──▶ phoneme ids
//   ids  ──(onnxruntime-node, the voice's ONNX graph)─────▶ float32 audio
//   pcm  ──(16-bit WAV at the voice's sample rate)────────▶ bytes
//
// Nothing external is consulted: no HTTP server, no Python, no subprocess.
// The phonemizer glue is vendored (third_party/piper-phonemize/), its wasm
// and espeak data download once (sha-pinned, see model-manager.ts), and each
// voice's ONNX pair downloads on first use from Hugging Face. Users who want
// to point at their own OpenAI-compatible server instead have the Custom
// provider for exactly that.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as modelManager from "./model-manager.ts";
import type { Audio, Voice } from "./elevenlabs.ts";

export const DEFAULT_PIPER_VOICE = "en_US-lessac-medium";

export const PIPER_VOICES: Voice[] = [
  { id: "en_US-lessac-medium", label: "Lessac", description: "Clear & natural (American Female)" },
  { id: "en_US-amy-medium", label: "Amy", description: "Warm & expressive (American Female)" },
  { id: "en_US-ryan-medium", label: "Ryan", description: "Smooth & articulate (American Male)" },
  { id: "en_US-danny-low", label: "Danny", description: "Fast & lightweight (American Male)" },
  { id: "en_GB-alan-medium", label: "Alan", description: "Natural & clear (British Male)" },
  { id: "en_GB-alba-medium", label: "Alba", description: "Warm & crisp (British Female)" },
];

/** The engine's fixed catalogue — the picker list and the only ids the
 * engine will synthesize, matching the download registry in the model
 * manager. */
export function listPiperVoices(): Voice[] {
  return PIPER_VOICES;
}

/** One voice's on-disk settings, from the .onnx.json that ships beside the
 * model. `espeak.voice` drives phonemization, `inference.*` are the VITS
 * scales, `audio.sample_rate` sizes the WAV header. */
export interface PiperVoiceSettings {
  espeakVoice: string;
  sampleRate: number;
  scales: [number, number, number]; // noise_scale, length_scale, noise_scale_w
}

// ── phonemizer ─────────────────────────────────────────────────────────
//
// The glue module is a MODULARIZE emscripten factory whose Node branch reads
// piper_phonemize.wasm/.data from disk (paths come from locateFile). Its
// CLI main prints one JSON document — { phoneme_ids: number[] } — per call,
// and main is single-shot per instance state, so calls serialize behind one
// queue and the print sink is a mutable holder rather than a per-call
// callback (emscripten captures the Module's print at init).

interface PhonemizeFactory {
  (options: {
    print: (line: string) => void;
    printErr: (line: string) => void;
    locateFile: (name: string) => string;
  }): Promise<{ callMain: (args: string[]) => void }>;
}

interface Phonemizer {
  /** The flat id stream (BOS 1 / EOS 2 bracketing, 0 pads between every
   * phoneme) for `text`, phonemized with the voice's espeak voice. */
  phonemize(text: string, espeakVoice: string): Promise<number[]>;
}

const TOOLING_DIR = modelManager.modelDir("piper");

function gluePaths(): string[] {
  // Packaged installs load from Resources (AGENTBOT_RESOURCES_PATH, set by
  // Electron for the harness and by the packaged-server smoke); checkouts
  // prefer the repository copy next to server/. Both are the same file.
  // The .cjs extension is load-bearing: the module is CommonJS and the
  // repository is "type": "module".
  const here = dirname(fileURLToPath(import.meta.url));
  const development = join(here, "..", "..", "third_party", "piper-phonemize", "piper_phonemize.cjs");
  const resources = process.env.AGENTBOT_RESOURCES_PATH;
  const packaged = resources ? join(resources, "piper-phonemize", "piper_phonemize.cjs") : null;
  return packaged ? [packaged, development] : [development];
}

let phonemizerPromise: Promise<Phonemizer> | null = null;

async function loadPhonemizer(): Promise<Phonemizer> {
  const path = gluePaths().find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error("the Piper phonemizer glue is missing from this install — reinstall the app");
  }
  const load = createRequire(path);
  const factory = load(path) as PhonemizeFactory;
  let sink: ((line: string) => void) | null = null;
  const mod = await factory({
    print: (line) => sink?.(line),
    // espeak diagnostics are not actionable from the app; a failure shows
    // up as the phonemize call below producing no output instead.
    printErr: () => {},
    locateFile: (name) => join(TOOLING_DIR, name),
  });
  // emscripten's callMain is not reentrant across concurrent calls; one
  // queue keeps every utterance on the single instance.
  let queue: Promise<unknown> = Promise.resolve();
  return {
    phonemize: (text, espeakVoice) => {
      const run = queue.then(
        () =>
          new Promise<number[]>((resolve, reject) => {
            let settled = false;
            sink = (line) => {
              if (settled) return;
              settled = true;
              try {
                resolve(JSON.parse(line).phoneme_ids);
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            };
            try {
              mod.callMain([
                "-l",
                espeakVoice,
                "--input",
                JSON.stringify([{ text }]),
                "--espeak_data",
                "/espeak-ng-data",
              ]);
              // Empty output means espeak could not phonemize this text
              // (or the wasm assets are missing); both are real failures.
              if (!settled) reject(new Error("the Piper phonemizer produced no phonemes for this text"));
            } catch (e) {
              if (!settled) {
                settled = true;
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            }
          }),
      );
      queue = run.catch(() => {});
      return run;
    },
  };
}

function phonemizer(): Promise<Phonemizer> {
  phonemizerPromise ??= loadPhonemizer();
  return phonemizerPromise;
}

/** Split the phonemizer's flat id stream into per-sentence id blocks. The
 * stream is already fully formed — the voice's phoneme map carries its own
 * padding ids — so a sentence is exactly the ids from BOS(1) through
 * EOS(2), passed to the graph verbatim. One inference per sentence is how
 * Piper itself speaks, so long text cannot blow up one graph run. */
export function splitIntoSentences(ids: number[]): number[][] {
  const sentences: number[][] = [];
  let current: number[] | null = null;
  for (const id of ids) {
    if (id === 1) {
      current = [1];
    } else if (current) {
      current.push(id);
      if (id === 2) {
        sentences.push(current);
        current = null;
      }
    }
  }
  return sentences;
}

// ── inference ──────────────────────────────────────────────────────────
//
// onnxruntime-node is a native module: present in node_modules during
// development and tests, staged into Resources (outside ASAR) by
// scripts/prepare-ort.mjs in packaged installs.

type InferenceSessionLike = {
  inputNames: string[];
  outputNames: string[];
  run: (feeds: Record<string, unknown>) => Promise<{ [name: string]: { data: Float32Array } }>;
};

type OrtLike = {
  InferenceSession: { create: (path: string) => Promise<InferenceSessionLike> };
  Tensor: {
    new (type: "int64" | "float32", data: BigInt64Array | Float32Array, dims: number[]): unknown;
  };
};

let ortPromise: Promise<OrtLike> | null = null;

function loadOrt(): Promise<OrtLike> {
  ortPromise ??= (async () => {
    const require = createRequire(import.meta.url);
    try {
      return require("onnxruntime-node") as OrtLike;
    } catch {
      // not in node_modules — packaged installs stage it beside the app
      const resources = process.env.AGENTBOT_RESOURCES_PATH;
      const staged = resources ? join(resources, "onnxruntime", "dist", "index.js") : null;
      if (staged && existsSync(staged)) return require(staged) as OrtLike;
      throw new Error("onnxruntime-node is missing — reinstall the app (the Piper engine needs it)");
    }
  })();
  return ortPromise;
}

const sessions = new Map<string, Promise<InferenceSessionLike>>();

function sessionFor(voiceId: string): Promise<InferenceSessionLike> {
  let session = sessions.get(voiceId);
  if (!session) {
    session = loadOrt().then((ort) =>
      ort.InferenceSession.create(join(TOOLING_DIR, `${voiceId}.onnx`)),
    );
    sessions.set(voiceId, session);
  }
  return session;
}

async function runInference(voiceId: string, ids: number[], scales: [number, number, number]): Promise<Float32Array> {
  const [ort, session] = await Promise.all([loadOrt(), sessionFor(voiceId)]);
  const feeds: Record<string, unknown> = {
    input: new ort.Tensor("int64", BigInt64Array.from(ids.map((id) => BigInt(id))), [1, ids.length]),
    input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
  };
  // Every published Piper export packs the three scales into one [3] float
  // tensor; older graphs name them separately. Match whichever we loaded.
  const names = new Set(session.inputNames);
  if (names.has("scales")) {
    feeds.scales = new ort.Tensor("float32", Float32Array.from(scales), [3]);
  } else if (names.has("noise_scale") && names.has("length_scale") && names.has("noise_scale_w")) {
    feeds.noise_scale = new ort.Tensor("float32", Float32Array.from([scales[0]]), [1]);
    feeds.length_scale = new ort.Tensor("float32", Float32Array.from([scales[1]]), [1]);
    feeds.noise_scale_w = new ort.Tensor("float32", Float32Array.from([scales[2]]), [1]);
  } else {
    throw new Error(`this Piper voice graph has unexpected inputs: ${session.inputNames.join(", ")}`);
  }
  const results = await session.run(feeds);
  const audio = results[session.outputNames[0]]?.data;
  if (!audio || !audio.length) throw new Error("this Piper voice graph produced no audio");
  return audio;
}

// ── assets & settings ─────────────────────────────────────────────────

const voiceSettings = new Map<string, Promise<PiperVoiceSettings>>();

function readVoiceSettings(voiceId: string): Promise<PiperVoiceSettings> {
  let settings = voiceSettings.get(voiceId);
  if (!settings) {
    settings = (async () => {
      const raw = JSON.parse(readFileSync(join(TOOLING_DIR, `${voiceId}.onnx.json`), "utf8")) as {
        espeak?: { voice?: string };
        audio?: { sample_rate?: number };
        inference?: { noise_scale?: number; length_scale?: number; noise_w?: number };
      };
      const espeakVoice = raw.espeak?.voice;
      const sampleRate = raw.audio?.sample_rate;
      if (!espeakVoice || !sampleRate) {
        throw new Error(`the voice configuration for ${voiceId} is missing its espeak voice or sample rate`);
      }
      return {
        espeakVoice,
        sampleRate,
        scales: [raw.inference?.noise_scale ?? 0.667, raw.inference?.length_scale ?? 1, raw.inference?.noise_w ?? 0.8],
      };
    })();
    voiceSettings.set(voiceId, settings);
  }
  return settings;
}

/** Make sure the engine can synthesize with this voice: the phonemizer
 * tooling (part of the `piper` definition) plus the voice's own model
 * pair. The default voice's pair is inside the `piper` definition, so most
 * users download exactly once. */
export async function ensurePiperAssets(voiceId: string): Promise<void> {
  if (!modelManager.isPiperVoiceId(voiceId)) {
    throw new Error(`unknown Piper voice: ${voiceId}`);
  }
  await modelManager.downloadModel("piper");
  if (voiceId !== DEFAULT_PIPER_VOICE) {
    await modelManager.downloadModel(modelManager.piperVoiceDownloadKey(voiceId));
  }
}

// ── synthesis ──────────────────────────────────────────────────────────

/** Test seams for the engine's three moving parts; production omits them
 * and exercises the real chain. */
export interface PiperSeams {
  ensureAssets?: (voiceId: string) => Promise<void>;
  phonemize?: (text: string, espeakVoice: string) => Promise<number[]>;
  infer?: (voiceId: string, ids: number[], scales: [number, number, number]) => Promise<Float32Array>;
  settings?: (voiceId: string) => Promise<PiperVoiceSettings>;
}

/** float32 samples in [-1, 1] to a 44-byte-header mono 16-bit WAV. */
export function wavBytes(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, Math.round(clamped * 32767), true);
  }
  return bytes;
}

export async function synthesizePiper(text: string, voiceId: string, seams: PiperSeams = {}): Promise<Audio> {
  if (!modelManager.isPiperVoiceId(voiceId)) {
    throw new Error(`unknown Piper voice: ${voiceId}`);
  }
  const ensure = seams.ensureAssets ?? ensurePiperAssets;
  await ensure(voiceId);

  const settingsOf = seams.settings ?? readVoiceSettings;
  const { espeakVoice, sampleRate, scales } = await settingsOf(voiceId);

  const phonemize = seams.phonemize ?? ((t: string, v: string) => phonemizer().then((p) => p.phonemize(t, v)));
  const ids = await phonemize(text, espeakVoice);
  const sentences = splitIntoSentences(ids);
  if (!sentences.length) throw new Error("this text phonemized to nothing Piper can speak");

  const infer = seams.infer ?? runInference;
  const chunks: Float32Array[] = [];
  for (const sentence of sentences) {
    chunks.push(await infer(voiceId, sentence, scales));
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const samples = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }
  return { bytes: wavBytes(samples, sampleRate), mime: "audio/wav" };
}
