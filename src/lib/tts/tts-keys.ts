// TTS provider API keys, saved on this machine by the Voice & TTS settings
// modal. The server keeps every credential write-only, and the desktop's
// OS-encrypted store is write-only too, so the renderer needs one place to
// keep the keys the user typed: the settings inputs repopulate from it on
// reopen, and a phone call attaches the key to each synthesis request so a
// server with no key on file cannot leave the call keyless.
export type TtsKeyEngine = "elevenlabs" | "fish" | "inworld" | "custom";

const STORAGE_KEY = "agentbot_tts_keys";
const ENGINES: readonly TtsKeyEngine[] = ["elevenlabs", "fish", "inworld", "custom"];

function readAll(): Partial<Record<TtsKeyEngine, string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Partial<Record<TtsKeyEngine, string>> = {};
    for (const engine of ENGINES) {
      const value = (parsed as Record<string, unknown>)[engine];
      if (typeof value === "string" && value.trim()) out[engine] = value.trim();
    }
    return out;
  } catch {
    return {};
  }
}

/** Whether an engine is one of the four key-carrying cloud engines. */
export function isTtsKeyEngine(engine: string): engine is TtsKeyEngine {
  return (ENGINES as readonly string[]).includes(engine);
}

/** The key saved on this machine for one engine, or "" when there is none. */
export function readTtsKey(engine: TtsKeyEngine): string {
  return readAll()[engine] ?? "";
}

/** Save (or clear, with an empty value) one engine's key locally. */
export function saveTtsKey(engine: TtsKeyEngine, key: string): void {
  const trimmed = key.trim();
  const next = { ...readAll() };
  if (trimmed) next[engine] = trimmed;
  else delete next[engine];
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A full or blocked store only means the key will not repopulate after
    // a reopen; the rest of the flow still works.
  }
}
