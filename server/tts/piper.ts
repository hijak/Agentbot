// Piper, the fast local CPU neural voice engine.
//
// Speaks through an OpenAI-compatible /v1/audio/speech endpoint (default
// port 5000). Highly efficient VITS-based neural synthesis designed for
// low latency and minimal resource consumption.
import type { Audio, Voice } from "./elevenlabs.ts";

export const DEFAULT_PIPER_URL = "http://127.0.0.1:5000";
export const DEFAULT_MODEL = "piper";

export const PIPER_VOICES: Voice[] = [
  { id: "en_US-lessac-medium", label: "Lessac", description: "Clear & natural (American Female)" },
  { id: "en_US-amy-medium", label: "Amy", description: "Warm & expressive (American Female)" },
  { id: "en_US-ryan-medium", label: "Ryan", description: "Smooth & articulate (American Male)" },
  { id: "en_US-danny-low", label: "Danny", description: "Fast & lightweight (American Male)" },
  { id: "en_GB-alan-medium", label: "Alan", description: "Natural & clear (British Male)" },
  { id: "en_GB-alba-medium", label: "Alba", description: "Warm & crisp (British Female)" },
];

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
      throw new Error(`${what} timed out — the Piper server at ${baseUrl.trim()} did not answer`);
    }
    throw new Error(`couldn't reach the Piper server at ${baseUrl.trim()} — check that it is running`);
  }
}

export async function listPiperVoices(baseUrl: string): Promise<Voice[]> {
  try {
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
    // fall through
  }
  return PIPER_VOICES;
}

export async function synthesizePiper(
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
