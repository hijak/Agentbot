import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readTtsKey, saveTtsKey } from "./tts-keys";

function stubLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (name: string) => store.get(name) ?? null,
      setItem: (name: string, value: string) => void store.set(name, value),
      removeItem: (name: string) => void store.delete(name),
    },
  });
  return store;
}

describe("local TTS key store", () => {
  beforeEach(() => {
    stubLocalStorage();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves and reads back one engine's key without touching the others", () => {
    saveTtsKey("inworld", "  inworld-key  ");
    saveTtsKey("fish", "fish-key");
    expect(readTtsKey("inworld")).toBe("inworld-key");
    expect(readTtsKey("fish")).toBe("fish-key");
    expect(readTtsKey("elevenlabs")).toBe("");
    expect(readTtsKey("custom")).toBe("");
  });

  it("clears the stored key when an empty value is saved", () => {
    saveTtsKey("inworld", "inworld-key");
    saveTtsKey("inworld", "   ");
    expect(readTtsKey("inworld")).toBe("");
  });

  it("reads an empty key from corrupt storage and recovers on the next save", () => {
    const store = stubLocalStorage();
    store.set("agentbot_tts_keys", "{not json");
    expect(readTtsKey("inworld")).toBe("");
    saveTtsKey("inworld", "inworld-key");
    expect(readTtsKey("inworld")).toBe("inworld-key");
  });

  it("ignores unknown engines and malformed values in stored data", () => {
    const store = stubLocalStorage();
    store.set(
      "agentbot_tts_keys",
      JSON.stringify({ inworld: "keep", fish: 42, elevenlabs: null, notAnEngine: "x" }),
    );
    expect(readTtsKey("inworld")).toBe("keep");
    expect(readTtsKey("fish")).toBe("");
    expect(readTtsKey("elevenlabs")).toBe("");
  });

  it("answers empty keys outside the browser", () => {
    vi.unstubAllGlobals();
    expect(readTtsKey("inworld")).toBe("");
    expect(() => saveTtsKey("inworld", "inworld-key")).not.toThrow();
    expect(readTtsKey("inworld")).toBe("");
  });
});
