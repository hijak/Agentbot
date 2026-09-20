// Kokoro, the high-speed Apple Silicon local voice engine.
//
// Powered by Kokoro-82M on Apple Silicon (via Apple MLX / mlx-audio or
// kokoro-fastapi). Achieves >30x real-time generation speed by running
// natively on the M-series unified memory and Metal GPU / Neural Engine.
// Speaks through an OpenAI-compatible /v1/audio/speech endpoint (default
// port 8880).
//
// The server address and model id are settings, not secrets: there is no
// key because the server runs on the user's own machine, so both are shown
// in Settings in full.
import type { Audio, Voice } from "./elevenlabs.ts";

export const DEFAULT_KOKORO_URL = "http://127.0.0.1:8880";
export const DEFAULT_MODEL = "kokoro-82m";

export const KOKORO_VOICES: Voice[] = [
  { id: "af_heart", label: "Heart", description: "Warm, natural narrator (American Female)" },
  { id: "af_bella", label: "Bella", description: "Energetic & expressive (American Female)" },
  { id: "af_nicole", label: "Nicole", description: "Clear & crisp (American Female)" },
  { id: "af_sarah", label: "Sarah", description: "Gentle & calm (American Female)" },
  { id: "am_adam", label: "Adam", description: "Warm & conversational (American Male)" },
  { id: "am_michael", label: "Michael", description: "Rich & authoritative (American Male)" },
  { id: "bf_emma", label: "Emma", description: "Bright & articulate (British Female)" },
  { id: "bf_isabella", label: "Isabella", description: "Warm & refined (British Female)" },
  { id: "bm_george", label: "George", description: "Resonant & friendly (British Male)" },
  { id: "bm_lewis", label: "Lewis", description: "Thoughtful & measured (British Male)" },
];

export function kokoroAvailable(platform: string = process.platform): boolean {
  return platform === "darwin";
}

export function apiRoot(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return /\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function message(status: number, what: string, body: any): string {
  const theirs =
    (typeof body?.error === "string" && body.error.trim()) ||
    (typeof body?.detail === "string" && body.detail.trim()) ||
    (typeof body?.message === "string" && body.message.trim()) ||
    "";
  return theirs ? `${what} failed: ${theirs}` : `${what} failed (${status})`;
}

async function request(url: string, init: RequestInit, what: string, baseUrl: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error(`${what} timed out — the Kokoro MLX server at ${baseUrl.trim()} did not answer`);
    }
    throw new Error(`couldn't reach the Kokoro MLX server at ${baseUrl.trim()} — check that it is running`);
  }
}

export async function listKokoroVoices(baseUrl: string): Promise<Voice[]> {
  try {
    // Try /v1/audio/voices first (kokoro-fastapi endpoint)
    const voicesRes = await request(
      `${apiRoot(baseUrl)}/audio/voices`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5_000) },
      "listing voices",
      baseUrl,
    );
    if (voicesRes.ok) {
      const body = await safeJson(voicesRes);
      const rawList = Array.isArray(body?.voices) ? body.voices : Array.isArray(body) ? body : null;
      if (rawList && rawList.length > 0) {
        return rawList
          .map((v: any): Voice => {
            const id = typeof v === "string" ? v : String(v?.id || v?.name || "");
            const matching = KOKORO_VOICES.find((kv) => kv.id === id);
            return {
              id,
              label: matching?.label || id,
              description: matching?.description || (typeof v?.description === "string" ? v.description : undefined),
            };
          })
          .filter((v: Voice) => v.id);
      }
    }
  } catch {
    // try models next
  }

  try {
    // Fall back to /v1/models
    const res = await request(
      `${apiRoot(baseUrl)}/models`,
      { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5_000) },
      "listing voices",
      baseUrl,
    );
    if (res.ok) {
      const body = await safeJson(res);
      const models = (body?.data ?? [])
        .map((m: any): Voice => ({ id: String(m?.id ?? ""), label: String(m?.id ?? "") }))
        .filter((v: Voice) => v.id);
      if (models.length) return models;
    }
  } catch {
    // fall through to curated list
  }

  return KOKORO_VOICES;
}

export async function synthesizeKokoro(
  text: string,
  voiceId: string,
  baseUrl: string,
  model?: string,
): Promise<Audio> {
  const res = await request(
    `${apiRoot(baseUrl)}/audio/speech`,
    {
      method: "POST",
      headers: { "content-type": "application/json", accept: "audio/wav" },
      body: JSON.stringify({
        model: model?.trim() || DEFAULT_MODEL,
        input: text,
        voice: voiceId,
        response_format: "wav",
      }),
      signal: AbortSignal.timeout(60_000),
    },
    "speaking",
    baseUrl,
  );
  if (!res.ok) throw new Error(message(res.status, "speaking", await safeJson(res)));
  const header = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const mime =
    header === "audio/mpeg" || header === "audio/mp3"
      ? "audio/mpeg"
      : header === "audio/x-wav"
        ? "audio/wav"
        : header.startsWith("audio/")
          ? header
          : "audio/wav";
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime };
}
