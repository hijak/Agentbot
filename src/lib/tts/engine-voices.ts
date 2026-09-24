// Voice lists the harness reports for each provider (GET /api/tts/voices).
// One window-wide cache, so the voice settings modal and the phone-call
// banner offer the same voices.
import { useEffect, useSyncExternalStore } from "react";

export type TtsVoiceOption = { id: string; name: string; desc: string; sample: string };

export type FetchedVoiceEngine = "system" | "elevenlabs" | "fish" | "inworld" | "custom" | "piper";

const FETCHED_ENGINES = new Set<string>(["system", "elevenlabs", "fish", "inworld", "custom", "piper"]);

export function isFetchedVoiceEngine(engine: string): engine is FetchedVoiceEngine {
  return FETCHED_ENGINES.has(engine);
}

let cache: Record<string, TtsVoiceOption[]> = {};
const inFlight = new Set<string>();
const watchers = new Set<() => void>();

function publish(next: Record<string, TtsVoiceOption[]>) {
  cache = next;
  for (const watcher of Array.from(watchers)) watcher();
}

/** Refetches one provider's list. Resolves true when the harness returned
 * voices, which also means the provider's key works. */
export async function refreshEngineVoices(engine: FetchedVoiceEngine): Promise<boolean> {
  try {
    const res = await fetch(`/api/tts/voices?provider=${engine}`);
    const data = await res.json();
    if (!Array.isArray(data?.voices) || data.voices.length === 0) return false;
    const mapped: TtsVoiceOption[] = data.voices.map((v: { id: string; label?: string; description?: string }) => ({
      id: v.id,
      name: v.label || v.id,
      desc: v.description || v.id,
      sample: `Hello, I'm ${v.label || v.id}. Ready for our call.`,
    }));
    publish({ ...cache, [engine]: mapped });
    return true;
  } catch {
    return false;
  }
}

/** Loads a provider's list once per window; a key Save refetches it. */
export function ensureEngineVoices(engine: string): void {
  if (!isFetchedVoiceEngine(engine) || cache[engine]?.length || inFlight.has(engine)) return;
  inFlight.add(engine);
  void refreshEngineVoices(engine).finally(() => inFlight.delete(engine));
}

function subscribe(fn: () => void) {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

export function useFetchedVoices(engine: string, enabled = true): Record<string, TtsVoiceOption[]> {
  useEffect(() => {
    if (enabled) ensureEngineVoices(engine);
  }, [engine, enabled]);
  return useSyncExternalStore(subscribe, () => cache, () => cache);
}
