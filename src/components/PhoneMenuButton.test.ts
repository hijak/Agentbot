import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Bot } from "@/state/store";

const fixture = vi.hoisted(() => {
  return { dispatch: vi.fn(), onCall: null as string | null };
});

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

vi.mock("@/state/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/state/store")>();
  return {
    ...original,
    useStore: () => ({
      state: {
        ...original.initialState,
        config: { tts: { provider: "jax-js", ready: true, configured: true } },
      },
      dispatch: fixture.dispatch,
    }),
  };
});

vi.mock("@/lib/call", () => ({
  useOnCall: () => fixture.onCall,
  startCall: vi.fn(),
  endCall: vi.fn(),
}));

vi.mock("./DesktopCapabilities", () => ({
  useDesktopCapabilities: () => ({
    capabilities: {
      dictation: { available: true },
      host: { platform: "darwin", label: "macOS" },
    },
    ready: true,
  }),
}));

const { PhoneMenuButton } = await import("./PhoneMenuButton");
afterAll(() => vi.unstubAllGlobals());

const bot: Bot = {
  id: "test-bot",
  threadId: "test-thread",
  name: "Pepper",
  title: "",
  description: "",
  color: "green",
  notifications: true,
  unread: false,
  busy: false,
  voice: "alba",
  modelSelection: { instanceId: "test", model: "profile-default" },
  messages: [],
};

describe("PhoneMenuButton", () => {
  it("renders the phone button with accessibility attributes and title", () => {
    fixture.onCall = null;
    const html = renderToStaticMarkup(createElement(PhoneMenuButton, { bot }));
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Phone call and voice settings"');
    expect(html).toContain("<button");
  });

  it("reflects active call status when bot is on the line", () => {
    fixture.onCall = "test-bot";
    const html = renderToStaticMarkup(createElement(PhoneMenuButton, { bot }));
    expect(html).toContain("bg-danger");
    expect(html).toContain('aria-label="End call with Pepper"');
  });

  it("renders dropdown menu with Start a phonecall and Settings options when open", () => {
    fixture.onCall = null;
    const html = renderToStaticMarkup(
      createElement(PhoneMenuButton, { bot, defaultMenuOpen: true }),
    );
    expect(html).toContain('role="menu"');
    expect(html).toContain("Phone &amp; Voice");
    expect(html).toContain("Start a phonecall");
    expect(html).toContain("Settings");
  });

  it("shows End phonecall in dropdown menu when call is active", () => {
    fixture.onCall = "test-bot";
    const html = renderToStaticMarkup(
      createElement(PhoneMenuButton, { bot, defaultMenuOpen: true }),
    );
    expect(html).toContain("End phonecall");
    expect(html).toContain("Settings");
  });

  it("renders modal overlay with TTS options when settings are open", () => {
    const html = renderToStaticMarkup(
      createElement(PhoneMenuButton, { bot, defaultSettingsOpen: true }),
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Voice &amp; TTS Settings");
    expect(html).toContain("Done");
  });
});
