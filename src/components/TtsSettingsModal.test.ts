import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CHARACTER_VOICES, TtsSettingsModal } from "./TtsSettingsModal";

describe("TtsSettingsModal", () => {
  it("renders modal dialog with TTS options when open", () => {
    const html = renderToStaticMarkup(
      createElement(TtsSettingsModal, {
        open: true,
        onClose: vi.fn(),
        selectedVoice: "azelma",
        onSelectVoice: vi.fn(),
        selectedEngine: "jax-js",
        onSelectEngine: vi.fn(),
        bargeInEnabled: true,
        onToggleBargeIn: vi.fn(),
        agentName: "Pepper",
      }),
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Voice &amp; TTS Settings");
    expect(html).toContain("In-Browser (jax-js)");
    expect(html).toContain("Web Speech / System");
    expect(html).toContain("Voice Barge-In (Speech Interruption)");
    expect(html).toContain("ON");
    expect(html).toContain("Neural Audio Previews");
    expect(html).toContain("Done");
  });

  it("lists all 8 character voices with their names and descriptions", () => {
    const html = renderToStaticMarkup(
      createElement(TtsSettingsModal, {
        open: true,
        onClose: vi.fn(),
        selectedVoice: "azelma",
        onSelectVoice: vi.fn(),
        selectedEngine: "jax-js",
        onSelectEngine: vi.fn(),
        bargeInEnabled: true,
        onToggleBargeIn: vi.fn(),
        agentName: "Pepper",
      }),
    );
    for (const v of CHARACTER_VOICES) {
      expect(html).toContain(v.name);
      expect(html).toContain(v.desc.replace(/&/g, "&amp;"));
    }
  });

  it("does not render when open is false", () => {
    const html = renderToStaticMarkup(
      createElement(TtsSettingsModal, {
        open: false,
        onClose: vi.fn(),
        selectedVoice: "azelma",
        onSelectVoice: vi.fn(),
        selectedEngine: "jax-js",
        onSelectEngine: vi.fn(),
        bargeInEnabled: true,
        onToggleBargeIn: vi.fn(),
      }),
    );
    expect(html).toBe("");
  });
});
