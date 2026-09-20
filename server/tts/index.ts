// Voice, wired to config. Four engines live behind this file: ElevenLabs
// and Fish Audio (each with its own key), the Mac's built-in voices
// (system-voices.ts, no key), and a local Chatterbox server
// (chatterbox.ts, an address instead of a key). This file is only the part that reads
// ~/.agentbot/config.json, picks the engine, and decides whether there
// is a voice at all.
import type { AppConfig } from "../config.ts";
import * as chatterbox from "./chatterbox.ts";
import * as custom from "./custom.ts";
import * as elevenlabs from "./elevenlabs.ts";
import * as fish from "./fish.ts";
import * as inworld from "./inworld.ts";
import * as kokoro from "./kokoro.ts";
import * as piper from "./piper.ts";
import * as systemVoices from "./system-voices.ts";

export * as modelManager from "./model-manager.ts";
export * as custom from "./custom.ts";
export * as inworld from "./inworld.ts";
export * as kokoro from "./kokoro.ts";
export * as piper from "./piper.ts";

export type VoiceProvider =
  | "elevenlabs"
  | "fish"
  | "inworld"
  | "custom"
  | "system"
  | "chatterbox"
  | "jax-js"
  | "kokoro"
  | "piper";

export const JAX_JS_VOICES: elevenlabs.Voice[] = [
  { id: "alba", label: "Alba", description: "Balanced narrator, warm and clear" },
  { id: "azelma", label: "Azelma", description: "Expressive, animated, playful" },
  { id: "cosette", label: "Cosette", description: "Bright, youthful, clear" },
  { id: "eponine", label: "Eponine", description: "Lively, energetic, sharp" },
  { id: "fantine", label: "Fantine", description: "Soft, gentle, compassionate" },
  { id: "javert", label: "Javert", description: "Deep, stern, authoritative" },
  { id: "jean", label: "Jean", description: "Mature, thoughtful, calm" },
  { id: "marius", label: "Marius", description: "Friendly, spirited, youthful" },
];

export class NoVoiceConfigured extends Error {
  // a plain field rather than a constructor parameter property: the harness
  // runs under `node --experimental-strip-types`, which is strip-ONLY, so a
  // parameter property is rejected at load time even though it typechecks
  readonly reason: "key" | "voice";

  constructor(reason: "key" | "voice", hint?: string) {
    super(
      hint ??
        (reason === "key"
          ? "Add an ElevenLabs key in Settings on the computer to turn on voice."
          : "Pick a voice in the agent profile."),
    );
    this.reason = reason;
  }
}

export function voiceProvider(cfg: AppConfig): VoiceProvider {
  const provider = cfg.tts?.provider;
  return provider === "fish" ||
    provider === "inworld" ||
    provider === "custom" ||
    provider === "system" ||
    provider === "chatterbox" ||
    provider === "jax-js" ||
    provider === "kokoro" ||
    provider === "piper"
    ? provider
    : "elevenlabs";
}

/** The system provider needs no credential — it is only ever offered where
 * the platform actually has it, so "configured" means "this engine can
 * speak", not "a key is on file". */
export function providerConfigured(cfg: AppConfig): boolean {
  const provider = voiceProvider(cfg);
  if (provider === "jax-js") return true;
  if (provider === "system") return systemVoices.systemVoicesAvailable();
  if (provider === "kokoro") return kokoro.kokoroAvailable() && Boolean(cfg.tts?.baseUrl?.trim());
  if (provider === "piper") return true;
  if (provider === "chatterbox") return Boolean(cfg.tts?.baseUrl?.trim());
  if (provider === "fish") return Boolean(cfg.tts?.fishKey);
  if (provider === "inworld") return Boolean(cfg.tts?.inworldKey || cfg.tts?.key);
  if (provider === "custom") return Boolean(cfg.tts?.baseUrl?.trim());
  return Boolean(cfg.tts?.key);
}

export function voiceConfigured(cfg: AppConfig): boolean {
  const provider = voiceProvider(cfg);
  if (provider === "jax-js") return Boolean(cfg.tts?.voice);
  if (provider === "system") {
    return systemVoices.systemVoicesAvailable() && Boolean(cfg.tts?.voice);
  }
  if (provider === "kokoro") {
    return kokoro.kokoroAvailable() && Boolean(cfg.tts?.baseUrl?.trim() && cfg.tts?.voice);
  }
  if (provider === "piper") return Boolean(cfg.tts?.voice);
  if (provider === "chatterbox") return Boolean(cfg.tts?.baseUrl?.trim() && cfg.tts?.voice);
  if (provider === "fish") return Boolean(cfg.tts?.fishKey && cfg.tts?.voice);
  if (provider === "inworld") return Boolean((cfg.tts?.inworldKey || cfg.tts?.key) && cfg.tts?.voice);
  if (provider === "custom") return Boolean(cfg.tts?.baseUrl?.trim() && cfg.tts?.voice);
  return Boolean(cfg.tts?.key && cfg.tts?.voice);
}

/** A per-bot voice is a complete choice too; it should not be blocked just
 * because the app-wide fallback has not been selected yet. */
export function voiceReady(cfg: AppConfig, voiceId?: string): boolean {
  const provider = voiceProvider(cfg);
  if (provider === "jax-js") return Boolean(voiceId || cfg.tts?.voice);
  if (provider === "system") {
    return systemVoices.systemVoicesAvailable() && Boolean(voiceId || cfg.tts?.voice);
  }
  if (provider === "kokoro") {
    return kokoro.kokoroAvailable() && Boolean(cfg.tts?.baseUrl?.trim() && (voiceId || cfg.tts?.voice));
  }
  if (provider === "piper") return Boolean(voiceId || cfg.tts?.voice);
  if (provider === "chatterbox") return Boolean(cfg.tts?.baseUrl?.trim() && (voiceId || cfg.tts?.voice));
  if (provider === "fish") return Boolean(cfg.tts?.fishKey && (voiceId || cfg.tts?.voice));
  if (provider === "inworld") return Boolean((cfg.tts?.inworldKey || cfg.tts?.key) && (voiceId || cfg.tts?.voice));
  if (provider === "custom") return Boolean(cfg.tts?.baseUrl?.trim() && (voiceId || cfg.tts?.voice));
  return Boolean(cfg.tts?.key && (voiceId || cfg.tts?.voice));
}

/** What the settings panel needs. Never includes the key — same write-only
 * rule as every other credential. baseUrl and model are Chatterbox/Kokoro/Piper/Custom
 * settings, not credentials, so they come back in full. */
export function describeVoice(cfg: AppConfig) {
  const provider = voiceProvider(cfg);
  const isServerUrlProvider =
    provider === "chatterbox" || provider === "kokoro" || provider === "piper" || provider === "custom";
  return {
    configured: providerConfigured(cfg),
    ready: voiceConfigured(cfg),
    voice: cfg.tts?.voice ?? "",
    provider,
    baseUrl: isServerUrlProvider ? (cfg.tts?.baseUrl ?? "") : "",
    model: isServerUrlProvider ? (cfg.tts?.model ?? "") : "",
  };
}

export function verifyKey(provider: "elevenlabs" | "fish", key: string) {
  return provider === "fish" ? fish.verifyKey(key) : elevenlabs.verifyKey(key);
}

export async function listVoices(cfg: AppConfig, run?: systemVoices.Runner): Promise<elevenlabs.Voice[]> {
  const provider = voiceProvider(cfg);
  if (provider === "jax-js") return JAX_JS_VOICES;
  if (provider === "system") return systemVoices.listSystemVoices(run);
  if (provider === "kokoro") {
    const baseUrl = cfg.tts?.baseUrl?.trim();
    return baseUrl ? kokoro.listKokoroVoices(baseUrl) : [];
  }
  if (provider === "piper") {
    const baseUrl = cfg.tts?.baseUrl?.trim() || piper.DEFAULT_PIPER_URL;
    return piper.listPiperVoices(baseUrl);
  }
  if (provider === "chatterbox") {
    const baseUrl = cfg.tts?.baseUrl?.trim();
    return baseUrl ? chatterbox.listChatterboxVoices(baseUrl) : [];
  }
  if (provider === "fish") {
    const key = cfg.tts?.fishKey;
    return key ? fish.listVoices(key) : [];
  }
  if (provider === "inworld") {
    const key = cfg.tts?.inworldKey || cfg.tts?.key;
    return inworld.listInworldVoices(key);
  }
  if (provider === "custom") {
    const baseUrl = cfg.tts?.baseUrl?.trim();
    return baseUrl ? custom.listCustomVoices(baseUrl, cfg.tts?.customKey || cfg.tts?.key) : custom.CUSTOM_FALLBACK_VOICES;
  }
  const key = cfg.tts?.key;
  if (!key) return [];
  return elevenlabs.listVoices(key);
}

/** Synthesize one utterance. Throws NoVoiceConfigured when there is nothing
 * to speak with, which the route turns into a 409 the client can explain. */
export function speak(cfg: AppConfig, text: string, voiceId?: string, run?: systemVoices.Runner) {
  const provider = voiceProvider(cfg);
  if (provider === "jax-js") {
    const voice = voiceId || cfg.tts?.voice;
    if (!voice) throw new NoVoiceConfigured("voice");
    throw new Error("jax-js synthesizes speech in-browser on the client side.");
  }
  if (provider === "system") {
    const voice = voiceId || cfg.tts?.voice;
    // An injected runner is the cross-platform test seam for `/usr/bin/say`;
    // production calls omit it and remain strictly Darwin-gated.
    if (!systemVoices.systemVoicesAvailable() && !run) throw new NoVoiceConfigured("key");
    if (!voice) throw new NoVoiceConfigured("voice");
    return systemVoices.synthesizeSystem(text, voice, run);
  }
  if (provider === "kokoro") {
    if (!kokoro.kokoroAvailable(run ? "darwin" : undefined)) {
      throw new NoVoiceConfigured("key", "Kokoro MLX voice synthesis requires macOS with Apple Silicon.");
    }
    const baseUrl = cfg.tts?.baseUrl?.trim();
    if (!baseUrl) {
      throw new NoVoiceConfigured(
        "key",
        "Add the address of your Kokoro MLX server in Settings on the computer to turn on voice.",
      );
    }
    const voice = voiceId || cfg.tts?.voice;
    if (!voice) throw new NoVoiceConfigured("voice");
    return kokoro.synthesizeKokoro(text, voice, baseUrl, cfg.tts?.model);
  }
  if (provider === "piper") {
    const baseUrl = cfg.tts?.baseUrl?.trim() || piper.DEFAULT_PIPER_URL;
    const voice = voiceId || cfg.tts?.voice;
    if (!voice) throw new NoVoiceConfigured("voice");
    return piper.synthesizePiper(text, voice, baseUrl, cfg.tts?.model);
  }
  if (provider === "chatterbox") {
    const baseUrl = cfg.tts?.baseUrl?.trim();
    if (!baseUrl) {
      throw new NoVoiceConfigured(
        "key",
        "Add the address of your Chatterbox server in Settings on the computer to turn on voice.",
      );
    }
    const voice = voiceId || cfg.tts?.voice;
    if (!voice) throw new NoVoiceConfigured("voice");
    return chatterbox.synthesizeChatterbox(text, voice, baseUrl, cfg.tts?.model);
  }
  if (provider === "fish") {
    const key = cfg.tts?.fishKey;
    if (!key) {
      throw new NoVoiceConfigured(
        "key",
        "Add a Fish Audio key in Settings on the computer to turn on voice.",
      );
    }
    const voice = voiceId || cfg.tts?.voice;
    if (!voice) throw new NoVoiceConfigured("voice");
    return fish.synthesize(text, voice, key);
  }
  if (provider === "inworld") {
    const key = cfg.tts?.inworldKey || cfg.tts?.key;
    if (!key) {
      throw new NoVoiceConfigured(
        "key",
        "Add an Inworld API key in Settings on the computer to turn on voice.",
      );
    }
    const voice = voiceId || cfg.tts?.voice;
    if (!voice) throw new NoVoiceConfigured("voice");
    return inworld.synthesizeInworld(text, voice, key, cfg.tts?.model);
  }
  if (provider === "custom") {
    const baseUrl = cfg.tts?.baseUrl?.trim();
    if (!baseUrl) {
      throw new NoVoiceConfigured(
        "key",
        "Add the address of your custom TTS endpoint in Settings on the computer to turn on voice.",
      );
    }
    const voice = voiceId || cfg.tts?.voice;
    if (!voice) throw new NoVoiceConfigured("voice");
    return custom.synthesizeCustom(text, voice, baseUrl, cfg.tts?.customKey || cfg.tts?.key, cfg.tts?.model);
  }
  const key = cfg.tts?.key;
  if (!key) throw new NoVoiceConfigured("key");
  const voice = voiceId || cfg.tts?.voice;
  if (!voice) throw new NoVoiceConfigured("voice");
  return elevenlabs.synthesize(text, voice, key);
}

export type { Voice } from "./elevenlabs.ts";
