import { speakKokoroUtterance } from "./kokoro-tts";
import { isTtsKeyEngine, readTtsKey } from "./tts-keys";

export type ServerCallEngine = "kokoro" | "piper" | "system" | "elevenlabs" | "fish" | "inworld" | "custom";

async function synthesizeOnServer(
  text: string,
  voice: string,
  provider: ServerCallEngine,
  signal?: AbortSignal,
): Promise<Blob> {
  // A cloud key rides with the request. The server keeps one on file too,
  // but a fresh or hosted server without it must not leave the call
  // keyless — the provider would refuse and the turn would play no audio.
  const key = isTtsKeyEngine(provider) ? readTtsKey(provider) : "";
  const res = await fetch("/api/tts/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text,
      voiceId: voice,
      provider,
      ...(key ? { key } : {}),
    }),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${provider} synthesis failed (${res.status})`);
  }
  return res.blob();
}

export async function synthesizeCallAudio(
  text: string,
  voice: string,
  engine: ServerCallEngine,
  signal?: AbortSignal,
): Promise<Blob> {
  if (engine === "kokoro") {
    try {
      return await speakKokoroUtterance(text, { voice, signal });
    } catch (err) {
      if (signal?.aborted) throw err;
      return synthesizeOnServer(text, voice, engine, signal);
    }
  }
  return synthesizeOnServer(text, voice, engine, signal);
}
