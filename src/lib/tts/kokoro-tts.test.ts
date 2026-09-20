import { describe, expect, it } from "vitest";
import { isKokoroLoaded, isKokoroCached, speakKokoroUtterance } from "./kokoro-tts";
import { checkLocalModelStatus } from "./model-client";

describe("Kokoro TTS", () => {
  it("reports loaded and cached status gracefully without errors", async () => {
    expect(typeof isKokoroLoaded()).toBe("boolean");
    const cached = await isKokoroCached();
    expect(typeof cached).toBe("boolean");
  });

  it("checks unified local model status for kokoro", async () => {
    const status = await checkLocalModelStatus("kokoro");
    expect(status.provider).toBe("kokoro");
    expect(typeof status.downloaded).toBe("boolean");
    expect(typeof status.downloading).toBe("boolean");
  });

  it("synthesizes speech using local Kokoro engine", async () => {
    const blob = await speakKokoroUtterance("Testing preview voice", { voice: "af_heart" });
    expect(blob).toBeDefined();
    expect(blob.size).toBeGreaterThan(1000);
  });
});
