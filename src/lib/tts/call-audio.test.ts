import { beforeEach, describe, expect, it, vi } from "vitest";
import { speakKokoroUtterance } from "./kokoro-tts";
import { synthesizeCallAudio } from "./call-audio";
import { saveTtsKey } from "./tts-keys";

vi.mock("./kokoro-tts", () => ({
  speakKokoroUtterance: vi.fn(),
}));

describe("phone call audio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the same in-browser Kokoro synthesis as voice previews", async () => {
    const audio = new Blob(["kokoro"]);
    vi.mocked(speakKokoroUtterance).mockResolvedValue(audio);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(synthesizeCallAudio("Hello", "af_heart", "kokoro")).resolves.toBe(audio);
    expect(speakKokoroUtterance).toHaveBeenCalledWith("Hello", {
      voice: "af_heart",
      signal: undefined,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps Kokoro selected when browser synthesis falls back to the server", async () => {
    vi.mocked(speakKokoroUtterance).mockRejectedValue(new Error("WebGPU unavailable"));
    const audio = new Blob(["server-kokoro"]);
    const fetchSpy = vi.fn().mockResolvedValue(new Response(audio, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(synthesizeCallAudio("Hello", "af_bella", "kokoro")).resolves.toEqual(audio);
    expect(fetchSpy).toHaveBeenCalledWith("/api/tts/speak", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        text: "Hello",
        voiceId: "af_bella",
        provider: "kokoro",
      }),
    }));
  });

  it("sends the selected Piper provider to the server", async () => {
    const audio = new Blob(["piper"]);
    const fetchSpy = vi.fn().mockResolvedValue(new Response(audio, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(synthesizeCallAudio("Hello", "en_US-lessac-medium", "piper")).resolves.toEqual(audio);
    expect(fetchSpy).toHaveBeenCalledWith("/api/tts/speak", expect.objectContaining({
      body: JSON.stringify({
        text: "Hello",
        voiceId: "en_US-lessac-medium",
        provider: "piper",
      }),
    }));
  });
  it("attaches this machine's saved Inworld key to the call request", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (name: string) => storage.get(name) ?? null,
        setItem: (name: string, value: string) => void storage.set(name, value),
        removeItem: (name: string) => void storage.delete(name),
      },
    });
    saveTtsKey("inworld", "inworld-local-key");
    const audio = new Blob(["inworld"]);
    const fetchSpy = vi.fn().mockResolvedValue(new Response(audio, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    await expect(synthesizeCallAudio("Hello", "Sarah", "inworld")).resolves.toEqual(audio);
    expect(fetchSpy).toHaveBeenCalledWith("/api/tts/speak", expect.objectContaining({
      body: JSON.stringify({
        text: "Hello",
        voiceId: "Sarah",
        provider: "inworld",
        key: "inworld-local-key",
      }),
    }));
  });
  it("attaches this machine's saved custom endpoint key to the call request", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (name: string) => storage.get(name) ?? null,
        setItem: (name: string, value: string) => void storage.set(name, value),
        removeItem: (name: string) => void storage.delete(name),
      },
    });
    saveTtsKey("custom", "custom-local-key");
    const audio = new Blob(["custom"]);
    const fetchSpy = vi.fn().mockResolvedValue(new Response(audio, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    await expect(synthesizeCallAudio("Hello", "alloy", "custom")).resolves.toEqual(audio);
    expect(fetchSpy).toHaveBeenCalledWith("/api/tts/speak", expect.objectContaining({
      body: JSON.stringify({
        text: "Hello",
        voiceId: "alloy",
        provider: "custom",
        key: "custom-local-key",
      }),
    }));
  });
  it("leaves the key off when this machine has none saved", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    });
    const audio = new Blob(["keyless"]);
    const fetchSpy = vi.fn().mockResolvedValue(new Response(audio, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    await expect(synthesizeCallAudio("Hello", "Sarah", "inworld")).resolves.toEqual(audio);
    expect(fetchSpy).toHaveBeenCalledWith("/api/tts/speak", expect.objectContaining({
      body: JSON.stringify({
        text: "Hello",
        voiceId: "Sarah",
        provider: "inworld",
      }),
    }));
  });
});
