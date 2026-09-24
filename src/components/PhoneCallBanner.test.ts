import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshEngineVoices } from "@/lib/tts/engine-voices";
import { PhoneCallBanner } from "./PhoneCallBanner";

const renderBanner = (engine: string, voice: string, active = true) =>
  renderToStaticMarkup(
    createElement(PhoneCallBanner, {
      active,
      onEndCall: vi.fn(),
      onSendMessage: vi.fn(),
      agentName: "Pepper",
      voice,
      onVoiceChange: vi.fn(),
      engine,
      bargeInEnabled: true,
      onToggleBargeIn: vi.fn(),
    }),
  );

describe("PhoneCallBanner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not render when no call is active", () => {
    vi.stubGlobal("window", {});
    expect(renderBanner("inworld", "Sarah", false)).toBe("");
  });

  it("renders as an inline banner, not a full-screen overlay with its own transcript", () => {
    vi.stubGlobal("window", {});
    const html = renderBanner("inworld", "Sarah");
    expect(html).toContain("On call with Pepper");
    expect(html).not.toContain("fixed inset-0");
    expect(html).not.toContain("<textarea");
  });

  it("labels the active engine by name instead of the system fallback", () => {
    vi.stubGlobal("window", {});
    // Cloud engines used to read as "System" in the call banner even while
    // their own voice was the one playing.
    expect(renderBanner("inworld", "Sarah")).toContain("Voice: Sarah · Inworld");
    expect(renderBanner("elevenlabs", "21m00Tcm4TlvDq8ikWAM")).toContain(
      "Voice: Rachel · ElevenLabs",
    );
    expect(renderBanner("custom", "alloy")).toContain("Voice: Alloy · Custom");
  });

  it("falls back to the System label for an unrecognized engine", () => {
    vi.stubGlobal("window", {});
    expect(renderBanner("not-an-engine", "azelma")).toContain("Voice: Azelma · System");
  });

  it("keeps a voice missing from the list selected instead of showing the first option", () => {
    vi.stubGlobal("window", {});
    const html = renderBanner("fish", "my-cloned-voice");
    expect(html).toContain('<option value="my-cloned-voice" selected="">my-cloned-voice</option>');
  });

  it("offers the provider's own voices, the same list the voice settings show", async () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ voices: [{ id: "voice-george", label: "George", description: "Warm" }] }),
      })),
    );
    expect(await refreshEngineVoices("elevenlabs")).toBe(true);
    const html = renderBanner("elevenlabs", "voice-george");
    expect(html).toContain("Voice: George · ElevenLabs");
    expect(html).toContain('<option value="voice-george" selected="">George</option>');
    // The built-in ElevenLabs list is replaced, not appended to.
    expect(html).not.toContain(">Rachel</option>");
  });
});
