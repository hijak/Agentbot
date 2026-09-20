import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PhoneMenu } from "./PhoneMenu";

describe("PhoneMenu", () => {
  it("renders the phone button with title and accessibility attributes", () => {
    const html = renderToStaticMarkup(
      createElement(PhoneMenu, {
        onCall: false,
        onCreateCall: vi.fn(),
        onOpenCall: vi.fn(),
        onEndCall: vi.fn(),
        onOpenSettings: vi.fn(),
        agentName: "Pepper",
      }),
    );
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Phone call options for Pepper"');
    expect(html).toContain("<button");
  });

  it("reflects active call status when a call is ongoing", () => {
    const html = renderToStaticMarkup(
      createElement(PhoneMenu, {
        onCall: true,
        onCreateCall: vi.fn(),
        onOpenCall: vi.fn(),
        onEndCall: vi.fn(),
        onOpenSettings: vi.fn(),
        agentName: "Pepper",
      }),
    );
    expect(html).toContain("bg-[var(--ah-fault-400)]");
    expect(html).toContain('aria-label="End call with Pepper"');
  });

  it("renders create and open call actions with Settings when open", () => {
    const html = renderToStaticMarkup(
      createElement(PhoneMenu, {
        onCall: false,
        onCreateCall: vi.fn(),
        onOpenCall: vi.fn(),
        onEndCall: vi.fn(),
        onOpenSettings: vi.fn(),
        agentName: "Pepper",
        defaultMenuOpen: true,
      }),
    );
    expect(html).toContain('role="menu"');
    expect(html).toContain("Phone &amp; Voice");
    expect(html).toContain("Create new call");
    expect(html).toContain("Open call");
    expect(html).toContain("Settings");
  });

  it("disables Open call when there is no active session", () => {
    const html = renderToStaticMarkup(
      createElement(PhoneMenu, {
        onCall: false,
        onCreateCall: vi.fn(),
        onOpenCall: vi.fn(),
        onEndCall: vi.fn(),
        onOpenSettings: vi.fn(),
        canOpenCall: false,
        defaultMenuOpen: true,
      }),
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain("Open call");
  });

  it("shows End phone call in dropdown menu when on a call", () => {
    const html = renderToStaticMarkup(
      createElement(PhoneMenu, {
        onCall: true,
        onCreateCall: vi.fn(),
        onOpenCall: vi.fn(),
        onEndCall: vi.fn(),
        onOpenSettings: vi.fn(),
        agentName: "Pepper",
        defaultMenuOpen: true,
      }),
    );
    expect(html).toContain("End phone call");
    expect(html).not.toContain("Create new call");
    expect(html).not.toContain("Open call");
    expect(html).toContain("Settings");
  });
});
