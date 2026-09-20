import { describe, expect, it } from "vitest";

import {
  companionStateRefreshIsCurrent,
  mutateCompanionBridgeState,
  phonePairingManualCodeMode,
  type CompanionState,
} from "./PhoneSetupFlow";
import {
  companionPairingMode,
  deriveCompanionPanelStatus,
  deriveTailscalePairingStatus,
  loadCompanionBridgeState,
  pairingSurfaceCopy,
} from "./CompanionSection";

describe("companion status refresh", () => {
  it("omits the redundant status pill when device access is ready for its first pairing", () => {
    expect(deriveCompanionPanelStatus({
      enabled: true,
      devices: [],
    })).toBeNull();
  });

  it("does not show a healthy status when the enabled sidecar reports an error", () => {
    expect(deriveCompanionPanelStatus({
      enabled: true,
      devices: [],
      error: "sidecar stopped responding",
    })).toEqual({ label: "Remote access needs attention", good: false });
  });

  it("returns null when the local Companion status fails", async () => {
    const refreshed = await loadCompanionBridgeState(
      { state: () => Promise.reject(new Error("sidecar unavailable")) },
    );

    expect(refreshed.companion).toBeNull();
  });

  it("loads the local Companion state", async () => {
    const companion = {
      enabled: true,
      keepAwake: false,
      port: 8811,
      devices: [],
      pairing: null,
    };
    const refreshed = await loadCompanionBridgeState(
      { state: () => Promise.resolve(companion) },
    );

    expect(refreshed.companion).toBe(companion);
  });

  it("does not let a pre-mutation poll overwrite a newly opened pairing", async () => {
    const pairingToken = `omb_pair_${"a".repeat(43)}`;
    const staleState: CompanionState = {
      enabled: true,
      keepAwake: false,
      port: 8811,
      devices: [],
      pairing: null,
    };
    const pairedState: CompanionState = {
      ...staleState,
      pairing: { code: "004209", token: pairingToken, expiresAt: Date.now() + 60_000 },
    };
    let signalCompanionRead = () => {};
    const companionRead = new Promise<void>((resolve) => {
      signalCompanionRead = resolve;
    });
    const epoch = { current: 0 };
    const refreshEpoch = epoch.current;
    let visibleState: CompanionState | null = null;
    const refresh = loadCompanionBridgeState(
      {
        state: () => {
          signalCompanionRead();
          return Promise.resolve(staleState);
        },
      },
    ).then((next) => {
      if (next.companion && companionStateRefreshIsCurrent(epoch, refreshEpoch)) {
        visibleState = next.companion;
      }
      return next;
    });

    await companionRead;
    visibleState = await mutateCompanionBridgeState(epoch, () => Promise.resolve(pairedState));
    const refreshed = await refresh;

    expect(refreshed.companion).toBe(staleState);
    expect(visibleState).toBe(pairedState);
    expect(epoch.current).toBe(2);
  });
});

describe("manual pairing code placement", () => {
  it("shows the code directly when no QR link can be built", () => {
    expect(phonePairingManualCodeMode(true, null)).toBe("direct");
  });

  it("keeps the code in troubleshooting details when a QR is available", () => {
    expect(phonePairingManualCodeMode(true, "agentbot://pair?token=example")).toBe("details");
    expect(phonePairingManualCodeMode(false, null)).toBe("hidden");
  });
});

describe("companion pairing availability", () => {
  const localCompanion = (enabled: boolean) => ({ enabled, endpoints: [] });
  const hostedCompanion = {
    enabled: true,
    endpoints: [
      { kind: "hosted" as const, url: "https://device.companion.example", priority: 0 },
    ],
  };

  it("allows pairing as soon as the hosted route is published", () => {
    expect(companionPairingMode(hostedCompanion)).toBe("hosted-ready");
  });

  it("preserves local-only pairing when hosted access is not configured", () => {
    expect(companionPairingMode(localCompanion(true))).toBe("local-only");
    expect(companionPairingMode(localCompanion(false))).toBe("local-only");
    expect(companionPairingMode(null)).toBe("local-only");
  });
});

describe("Tailscale pairing onboarding", () => {
  it("keeps HTTPS as the recommended default surface", () => {
    expect(pairingSurfaceCopy({ localFallback: false, tailscaleFallback: false })).toEqual({
      title: "Secure HTTPS pairing",
      subtitle: "Recommended — the simplest setup, and it keeps working when the paired device leaves this Wi-Fi.",
    });
    expect(pairingSurfaceCopy({ localFallback: false, tailscaleFallback: true }).title).toBe(
      "Tailscale pairing",
    );
  });

  it("explains every step between unchecked and ready", () => {
    expect(deriveTailscalePairingStatus({ enabled: false }, false)).toMatchObject({
      kind: "unchecked",
      detail: expect.stringContaining("turns on Remote access"),
    });
    expect(deriveTailscalePairingStatus({ enabled: true }, false).kind).toBe("unavailable");
    expect(deriveTailscalePairingStatus({
      enabled: true,
      tailscale: "100.99.1.2",
    }, false).kind).toBe("magicdns");
    expect(deriveTailscalePairingStatus({
      enabled: true,
      tailscale: "100.99.1.2",
      tailnetName: "mac.tail1234.ts.net",
    }, true)).toMatchObject({
      kind: "ready",
      title: "Ready on mac.tail1234.ts.net",
    });
  });

  it("surfaces sidecar failures instead of pretending Tailscale is merely absent", () => {
    expect(deriveTailscalePairingStatus({
      enabled: true,
      error: "the companion is not responding",
    }, false)).toEqual({
      kind: "error",
      title: "Remote access needs attention",
      detail: "the companion is not responding",
    });
  });
});
