// Custom HTTP / OpenAI-compatible Text-to-Speech client.
//
// Supports custom endpoints such as OpenAI /v1/audio/speech, LocalAI, vLLM,
// LM Studio, self-hosted CosyVoice/XTTS/ChatTTS, and arbitrary TTS gateways.
import type { Audio, Voice } from "./elevenlabs.ts";

export const DEFAULT_CUSTOM_MODEL = "tts-1";

export const CUSTOM_FALLBACK_VOICES: Voice[] = [
  { id: "alloy", label: "Alloy", description: "Neutral, balanced and clear" },
  { id: "echo", label: "Echo", description: "Smooth, warm and conversational" },
  { id: "fable", label: "Fable", description: "Expressive with British accent" },
  { id: "onyx", label: "Onyx", description: "Deep, authoritative and resonant" },
  { id: "nova", label: "Nova", description: "Energetic, bright and friendly" },
  { id: "shimmer", label: "Shimmer", description: "Clear, expressive and crisp" },
];

export function normalizeCustomUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "http://127.0.0.1:8000/v1/audio/speech";
  if (/\/audio\/speech$/i.test(trimmed) || /\/speech$/i.test(trimmed)) {
    return trimmed;
  }
  if (/\/v1$/i.test(trimmed)) {
    return `${trimmed}/audio/speech`;
  }
  return `${trimmed}/v1/audio/speech`;
}

function getApiBase(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/audio\/speech$/i, "").replace(/\/speech$/i, "");
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function formatErrorMessage(status: number, body: any, url: string): string {
  const msg =
    (typeof body?.error === "string" && body.error.trim()) ||
    (typeof body?.error?.message === "string" && body.error.message.trim()) ||
    (typeof body?.detail === "string" && body.detail.trim()) ||
    (typeof body?.message === "string" && body.message.trim()) ||
    "";
  if (status === 401 || status === 403) {
    return `Custom TTS endpoint rejected the request (${status}) — check your API key if one is required.`;
  }
  if (status === 404) {
    return `Custom TTS endpoint not found (404 at ${url}) — ensure the address points to a valid speech API.`;
  }
  return msg ? `Custom TTS error: ${msg}` : `Custom TTS request failed (${status})`;
}

export async function listCustomVoices(baseUrl: string, key?: string): Promise<Voice[]> {
  const base = getApiBase(baseUrl);
  if (!base) return CUSTOM_FALLBACK_VOICES;

  const headers: Record<string, string> = { accept: "application/json" };
  if (key?.trim()) {
    headers["Authorization"] = key.trim().startsWith("Bearer ") ? key.trim() : `Bearer ${key.trim()}`;
  }

  // Try /voices or /v1/voices first, then /models
  const endpoints = [`${base}/voices`, `${base}/audio/voices`, `${base}/models`];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers,
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const body = await safeJson(res);
        const list = body?.voices ?? body?.data;
        if (Array.isArray(list) && list.length > 0) {
          const voices = list
            .map((v: any): Voice => ({
              id: String(v?.id ?? v?.voice_id ?? v?.name ?? ""),
              label: String(v?.name ?? v?.label ?? v?.id ?? ""),
              description: v?.description ? String(v.description) : undefined,
            }))
            .filter((v: Voice) => v.id);
          if (voices.length > 0) return voices;
        }
      }
    } catch {
      // Continue to next probe
    }
  }

  return CUSTOM_FALLBACK_VOICES;
}

export async function synthesizeCustom(
  text: string,
  voiceId: string,
  baseUrl: string,
  key?: string,
  model?: string,
): Promise<Audio> {
  const trimmed = text.trim();
  if (!trimmed) return { bytes: new Uint8Array(), mime: "audio/mpeg" };
  if (!baseUrl?.trim()) {
    throw new Error("Add a custom API endpoint address in Settings to turn on voice.");
  }

  const endpointUrl = normalizeCustomUrl(baseUrl);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "audio/mpeg, audio/wav, audio/*, application/json",
  };
  if (key?.trim()) {
    headers["Authorization"] = key.trim().startsWith("Bearer ") ? key.trim() : `Bearer ${key.trim()}`;
  }

  const payload = {
    model: model?.trim() || DEFAULT_CUSTOM_MODEL,
    input: trimmed,
    text: trimmed,
    voice: voiceId || "alloy",
    response_format: "mp3",
  };

  let res: Response;
  try {
    res = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error(`Custom TTS request timed out at ${endpointUrl}`);
    }
    throw new Error(`Could not reach Custom TTS endpoint (${endpointUrl}): ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    const errBody = await safeJson(res);
    throw new Error(formatErrorMessage(res.status, errBody, endpointUrl));
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await safeJson(res);
    const b64 = json?.audioContent || json?.audio;
    if (typeof b64 === "string" && b64) {
      return { bytes: new Uint8Array(Buffer.from(b64, "base64")), mime: "audio/mpeg" };
    }
    throw new Error("Custom TTS response was JSON without audioContent or audio field");
  }

  const arrayBuffer = await res.arrayBuffer();
  return {
    bytes: new Uint8Array(arrayBuffer),
    mime: contentType || "audio/mpeg",
  };
}
