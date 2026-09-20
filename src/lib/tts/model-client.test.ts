import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  activateLocalModel,
  cancelLocalModelDownload,
  checkLocalModelStatus,
} from "./model-client";
import * as jaxTts from "./jax-tts";

describe("model-client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("checks jax-js status from jax-tts state", async () => {
    vi.spyOn(jaxTts, "isJaxModelLoaded").mockReturnValue(false);
    vi.spyOn(jaxTts, "isJaxModelCached").mockResolvedValue(false);
    vi.spyOn(jaxTts, "currentDownloadProgress").mockReturnValue(null);

    const status = await checkLocalModelStatus("jax-js");
    expect(status.provider).toBe("jax-js");
    expect(status.downloaded).toBe(false);
    expect(status.downloading).toBe(false);

    vi.spyOn(jaxTts, "isJaxModelCached").mockResolvedValue(true);
    const cachedStatus = await checkLocalModelStatus("jax-js");
    expect(cachedStatus.downloaded).toBe(true);
  });

  it("checks kokoro and piper status from server API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          provider: "kokoro",
          downloaded: true,
          downloading: false,
        }),
        { status: 200 },
      ),
    );

    const status = await checkLocalModelStatus("kokoro");
    expect(status.provider).toBe("kokoro");
    expect(status.downloaded).toBe(true);
    expect(status.downloading).toBe(false);
    expect(fetchSpy).toHaveBeenCalledWith("/api/tts/models/status?provider=kokoro");
  });

  it("activates jax-js model weights by calling activateJaxModel", async () => {
    const activateSpy = vi.spyOn(jaxTts, "activateJaxModel").mockImplementation(async (onProgress) => {
      onProgress?.({ phase: "downloading", loadedBytes: 50, totalBytes: 100, percent: 50 });
      onProgress?.({ phase: "ready", loadedBytes: 100, totalBytes: 100, percent: 100 });
      return {} as any;
    });

    const progressList: any[] = [];
    await activateLocalModel("jax-js", {
      onProgress: (p) => progressList.push(p),
    });

    expect(activateSpy).toHaveBeenCalled();
    expect(progressList).toHaveLength(2);
    expect(progressList[0].percent).toBe(50);
    expect(progressList[1].phase).toBe("ready");
  });

  it("activates kokoro model by triggering server download", async () => {
    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr === "/api/tts/models/download") {
        return new Response(JSON.stringify({ status: { downloading: true } }), { status: 200 });
      }
      if (urlStr.startsWith("/api/tts/models/status")) {
        callCount += 1;
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              downloaded: false,
              downloading: true,
              progress: { phase: "downloading", percent: 45 },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            downloaded: true,
            downloading: false,
            progress: { phase: "ready", percent: 100 },
          }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    });

    const progressList: any[] = [];
    await activateLocalModel("kokoro", {
      onProgress: (p) => progressList.push(p),
    });

    expect(progressList.length).toBeGreaterThan(0);
    expect(progressList[progressList.length - 1].phase).toBe("ready");
  });

  it("sends cancel request on cancelLocalModelDownload", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    await cancelLocalModelDownload("kokoro");
    expect(fetchSpy).toHaveBeenCalledWith("/api/tts/models/cancel", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ provider: "kokoro" }),
    }));
  });
});
