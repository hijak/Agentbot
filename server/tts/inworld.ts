// Inworld AI Text-to-Speech client.
//
// Synthesizes speech using the Inworld TTS REST API (https://api.inworld.ai/tts/v1/voice).
// Authentication uses HTTP Basic auth with the Inworld API key.
import type { Audio, Voice } from "./elevenlabs.ts";

export function inworldApiUrl(): string {
  return process.env.AGENTBOT_INWORLD_API || "https://api.inworld.ai";
}
export const DEFAULT_INWORLD_MODEL = "inworld-tts-2";

export const INWORLD_FALLBACK_VOICES: Voice[] = [
  { id: "Sarah", label: "Sarah", description: "Warm, natural & engaging narrator (American Female)" },
  { id: "Alex", label: "Alex", description: "Clear, balanced & conversational (American Male)" },
  { id: "Ashley", label: "Ashley", description: "Lively, expressive & friendly (American Female)" },
  { id: "Edward", label: "Edward", description: "Deep, articulate & authoritative (British Male)" },
  { id: "Elena", label: "Elena", description: "Soft, graceful & melodic (European Female)" },
  { id: "Marcus", label: "Marcus", description: "Authoritative, smooth & resonant (American Male)" },
];

/**
 * Builds the Authorization header for Inworld API calls.
 *
 * In Inworld Portal, API keys are provided as pre-encoded Base64 credentials.
 * The official documentation specifies sending them directly as:
 * `Authorization: Basic $INWORLD_API_KEY`
 *
 * If the user enters a raw "key:secret" pair containing a colon, we base64-encode it.
 * If the key already includes the "Basic " or "Bearer " scheme, we leave it untouched.
 */
export function authHeader(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("Basic ") || trimmed.startsWith("Bearer ")) {
    return trimmed;
  }
  if (trimmed.includes(":")) {
    return `Basic ${Buffer.from(trimmed).toString("base64")}`;
  }
  return `Basic ${trimmed}`;
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function detectAudioMime(bytes: Uint8Array): string {
  if (bytes.length >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return "audio/wav";
  }
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return "audio/mpeg";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return "audio/ogg";
  }
  return "audio/mpeg";
}

function formatErrorMessage(status: number, body: any): string {
  const msg =
    (typeof body?.error === "string" && body.error.trim()) ||
    (typeof body?.error?.message === "string" && body.error.message.trim()) ||
    (typeof body?.detail === "string" && body.detail.trim()) ||
    (typeof body?.message === "string" && body.message.trim()) ||
    "";
  if (status === 401 || status === 403) {
    return msg
      ? `Inworld rejected that API key (${msg}) — check that your key is active and correctly pasted.`
      : "Inworld rejected that API key — check that your key is active and correctly pasted.";
  }
  if (status === 429) return msg || "Inworld rate limit exceeded — please try again shortly.";
  return msg ? `Inworld TTS failed: ${msg}` : `Inworld TTS failed (${status})`;
}

export async function listInworldVoices(key?: string): Promise<Voice[]> {
  if (!key?.trim()) return INWORLD_FALLBACK_VOICES;
  const root = inworldApiUrl().replace(/\/+$/, "");
  const auth = authHeader(key);

  for (const path of ["/tts/v1/voices", "/voices/v1/voices", "/v1/tts/voices"]) {
    try {
      const res = await fetch(`${root}${path}`, {
        headers: {
          Authorization: auth,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const body = await safeJson(res);
        const list = body?.voices ?? body?.data;
        if (Array.isArray(list) && list.length > 0) {
          const voices = list
            .map((v: any): Voice => {
              const id = String(v?.voiceId ?? v?.voice_id ?? v?.id ?? v?.name ?? "");
              const label = String(v?.displayName ?? v?.display_name ?? v?.name ?? v?.label ?? id);
              const descParts: string[] = [];
              if (v?.gender) descParts.push(v.gender);
              if (v?.language) descParts.push(v.language);
              if (v?.description) descParts.push(v.description);
              return {
                id,
                label,
                description: descParts.length ? descParts.join(" • ") : undefined,
              };
            })
            .filter((v: Voice) => v.id);
          if (voices.length) return voices;
        }
      }
    } catch {
      // try next endpoint
    }
  }
  return INWORLD_FALLBACK_VOICES;
}

export async function synthesizeInworld(
  text: string,
  voiceId: string,
  key: string,
  model?: string,
): Promise<Audio> {
  const trimmed = text.trim();
  if (!trimmed) return { bytes: new Uint8Array(), mime: "audio/wav" };
  const k = key.trim();
  if (!k) throw new Error("Add an Inworld API key in Settings to turn on voice.");

  const root = inworldApiUrl().replace(/\/+$/, "");
  const url = `${root}/tts/v1/voice`;

  const chosenModel = model?.trim() || DEFAULT_INWORLD_MODEL;
  const chosenVoice = voiceId.trim();
  const payload = {
    text: trimmed,
    voice_id: chosenVoice,
    model_id: chosenModel,
    audio_config: {
      audio_encoding: "LINEAR16",
      sample_rate_hertz: 48000,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader(k),
        "content-type": "application/json",
        accept: "application/json, audio/wav, audio/mpeg",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error("Inworld TTS request timed out — please try again");
    }
    throw new Error(`Could not reach Inworld API (${url}): ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    const errBody = await safeJson(res);
    throw new Error(formatErrorMessage(res.status, errBody));
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await safeJson(res);
    if (!json?.audioContent) {
      throw new Error("Inworld response missing audioContent");
    }
    const bytes = new Uint8Array(Buffer.from(json.audioContent, "base64"));
    return { bytes, mime: detectAudioMime(bytes) };
  }

  const arrayBuffer = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  return {
    bytes,
    mime: contentType || detectAudioMime(bytes),
  };
}
