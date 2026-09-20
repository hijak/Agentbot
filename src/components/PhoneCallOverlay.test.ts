import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhoneCallOverlay } from "./PhoneCallOverlay";

const renderOverlay = (engine: string, voice: string, active = true) =>
  renderToStaticMarkup(
    createElement(PhoneCallOverlay, {
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

describe("PhoneCallOverlay", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not render when no call is active", () => {
    vi.stubGlobal("window", {});
    expect(renderOverlay("inworld", "Sarah", false)).toBe("");
  });

  it("labels the active engine by name instead of the system fallback", () => {
    vi.stubGlobal("window", {});
    // Cloud engines used to read as "System" in the call banner even while
    // their own voice was the one playing.
    expect(renderOverlay("inworld", "Sarah")).toContain("Voice: Sarah · Inworld");
    expect(renderOverlay("elevenlabs", "21m00Tcm4TlvDq8ikWAM")).toContain(
      "Voice: Rachel · ElevenLabs",
    );
    expect(renderOverlay("custom", "alloy")).toContain("Voice: Alloy · Custom");
  });

  it("falls back to the System label for an unrecognized engine", () => {
    vi.stubGlobal("window", {});
    expect(renderOverlay("not-an-engine", "azelma")).toContain("Voice: Azelma · System");
  });
});
