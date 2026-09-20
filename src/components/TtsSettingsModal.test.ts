import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CHARACTER_VOICES,
  CUSTOM_CHARACTER_VOICES,
  ELEVENLABS_CHARACTER_VOICES,
  FISH_CHARACTER_VOICES,
  INWORLD_CHARACTER_VOICES,
  KOKORO_CHARACTER_VOICES,
  PIPER_CHARACTER_VOICES,
  SYSTEM_CHARACTER_VOICES,
  TtsSettingsModal,
} from "./TtsSettingsModal";

describe("TtsSettingsModal", () => {
  it("renders modal dialog with TTS options including Apple Silicon and Piper when open", () => {
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
    expect(html).toContain("Kokoro (Apple Silicon MLX)");
    expect(html).toContain("Built-in Mac Voices");
    expect(html).toContain("Piper (Local)");
    expect(html).toContain("ElevenLabs (Cloud)");
    expect(html).toContain("Fish Audio (Cloud)");
    expect(html).toContain("Inworld AI (Cloud)");
    expect(html).toContain("Custom (API Endpoint)");
    expect(html).toContain("Voice Barge-In (Speech Interruption)");
    expect(html).toContain("ON");
    expect(html).toContain("Neural Audio Previews");
    expect(html).toContain("Done");
  });

  it("lists all 8 Pocket TTS character voices when jax-js is selected", () => {
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

  it("lists Kokoro neural voices when kokoro is selected", () => {
    const html = renderToStaticMarkup(
      createElement(TtsSettingsModal, {
        open: true,
        onClose: vi.fn(),
        selectedVoice: "af_heart",
        onSelectVoice: vi.fn(),
        selectedEngine: "kokoro",
        onSelectEngine: vi.fn(),
        bargeInEnabled: true,
        onToggleBargeIn: vi.fn(),
        agentName: "Pepper",
      }),
    );
    for (const v of KOKORO_CHARACTER_VOICES) {
      expect(html).toContain(v.name);
      expect(html).toContain(v.desc.replace(/&/g, "&amp;"));
    }
  });

  it("lists Piper neural voices when piper is selected", () => {
    const html = renderToStaticMarkup(
      createElement(TtsSettingsModal, {
        open: true,
        onClose: vi.fn(),
        selectedVoice: "en_US-lessac-medium",
        onSelectVoice: vi.fn(),
        selectedEngine: "piper",
        onSelectEngine: vi.fn(),
        bargeInEnabled: true,
        onToggleBargeIn: vi.fn(),
        agentName: "Pepper",
      }),
    );
    for (const v of PIPER_CHARACTER_VOICES) {
      expect(html).toContain(v.name);
      expect(html).toContain(v.desc.replace(/&/g, "&amp;"));
    }
  });

  it("lists macOS system voices when system is selected", () => {
    const html = renderToStaticMarkup(
      createElement(TtsSettingsModal, {
        open: true,
        onClose: vi.fn(),
        selectedVoice: "Samantha",
        onSelectVoice: vi.fn(),
        selectedEngine: "system",
        onSelectEngine: vi.fn(),
        bargeInEnabled: true,
        onToggleBargeIn: vi.fn(),
        agentName: "Pepper",
      }),
    );
    for (const v of SYSTEM_CHARACTER_VOICES) {
      expect(html).toContain(v.name);
      expect(html).toContain(v.desc.replace(/&/g, "&amp;"));
    }
  });

  it("lists ElevenLabs voices and shows API key input when elevenlabs is selected", () => {
    const html = renderToStaticMarkup(
      createElement(TtsSettingsModal, {
        open: true,
        onClose: vi.fn(),
        selectedVoice: "21m00Tcm4TlvDq8ikWAM",
        onSelectVoice: vi.fn(),
        selectedEngine: "elevenlabs",
        onSelectEngine: vi.fn(),
        bargeInEnabled: true,
        onToggleBargeIn: vi.fn(),
        agentName: "Pepper",
      }),
    );
    expect(html).toContain("ElevenLabs API Key");
    for (const v of ELEVENLABS_CHARACTER_VOICES) {
      expect(html).toContain(v.name);
      expect(html).toContain(v.desc.replace(/&/g, "&amp;"));
    }
  });

  it("lists Fish Audio voices and shows API key input when fish is selected", () => {
    const html = renderToStaticMarkup(
      createElement(TtsSettingsModal, {
        open: true,
        onClose: vi.fn(),
        selectedVoice: "7f4a8e0344b043f4a621757e14f4fc3a",
        onSelectVoice: vi.fn(),
        selectedEngine: "fish",
        onSelectEngine: vi.fn(),
        bargeInEnabled: true,
        onToggleBargeIn: vi.fn(),
        agentName: "Pepper",
      }),
    );
    expect(html).toContain("Fish Audio API Key");
    for (const v of FISH_CHARACTER_VOICES) {
      expect(html).toContain(v.name);
      expect(html).toContain(v.desc.replace(/&/g, "&amp;"));
    }
  });

  it("lists Inworld AI voices and shows API key input when inworld is selected", () => {
    const html = renderToStaticMarkup(
      createElement(TtsSettingsModal, {
        open: true,
        onClose: vi.fn(),
        selectedVoice: "Sarah",
        onSelectVoice: vi.fn(),
        selectedEngine: "inworld",
        onSelectEngine: vi.fn(),
        bargeInEnabled: true,
        onToggleBargeIn: vi.fn(),
        agentName: "Pepper",
      }),
    );
    expect(html).toContain("Inworld API Key");
    expect(html).toContain("Model (optional)");
    for (const v of INWORLD_CHARACTER_VOICES) {
      expect(html).toContain(v.name);
      expect(html).toContain(v.desc.replace(/&/g, "&amp;"));
    }
  });

  it("lists Custom voices and shows endpoint URL input when custom is selected", () => {
    const html = renderToStaticMarkup(
      createElement(TtsSettingsModal, {
        open: true,
        onClose: vi.fn(),
        selectedVoice: "alloy",
        onSelectVoice: vi.fn(),
        selectedEngine: "custom",
        onSelectEngine: vi.fn(),
        bargeInEnabled: true,
        onToggleBargeIn: vi.fn(),
        agentName: "Pepper",
      }),
    );
    expect(html).toContain("Custom Speech Endpoint URL");
    expect(html).toContain("API Key (optional)");
    expect(html).toContain("Model ID (optional)");
    for (const v of CUSTOM_CHARACTER_VOICES) {
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

  it("repopulates the API key inputs from this machine's local key store", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (name: string) =>
          name === "agentbot_tts_keys" ? JSON.stringify({ elevenlabs: "el-local-key" }) : null,
        setItem: () => {},
        removeItem: () => {},
      },
    });
    try {
      const html = renderToStaticMarkup(
        createElement(TtsSettingsModal, {
          open: true,
          onClose: vi.fn(),
          selectedVoice: "21m00Tcm4TlvDq8ikWAM",
          onSelectVoice: vi.fn(),
          selectedEngine: "elevenlabs",
          onSelectEngine: vi.fn(),
          bargeInEnabled: true,
          onToggleBargeIn: vi.fn(),
          agentName: "Pepper",
        }),
      );
      expect(html).toContain('value="el-local-key"');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("greys out Apple Silicon and macOS options on other platforms (e.g. Windows)", () => {
    const originalWindow = globalThis.window;
    try {
      (globalThis as any).window = { ogb: { platform: "win32" } };
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
        }),
      );
      expect(html).toContain("macOS ONLY");
      expect(html).toContain("opacity-40 cursor-not-allowed");
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
