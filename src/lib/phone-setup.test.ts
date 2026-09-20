import { describe, expect, it, vi } from "vitest";
import {
  claimPhonePairingAttempt,
  closePhonePairingIfOwned,
  completePhonePairingAttempt,
  companionPairingOpenFailure,
  companionStartFailure,
  derivePhoneSetupPhase,
  initialPhoneSetupFlowState,
  keepPhonePairingIfCurrent,
  newlyPairedDevice,
  newlyPairedDeviceForFlow,
  normalizePhoneSetupActionError,
  phonePairingGate,
  phoneSetupBaseline,
  phoneSetupReducer,
  preparePhonePairingRoute,
  invalidatePhonePairingAttempt,
  queuePhonePairingAttempt,
  releasePhonePairingAttempt,
  shouldArmPhoneSetupProvisioningTimeout,
  startNonOverlappingPhoneSetupPoll,
  type PhonePairingAttemptLock,
  type PhonePairingAttemptQueue,
} from "./phone-setup";

describe("phone setup flow", () => {
  it("refreshes Tailscale before validating an explicit tailnet route", async () => {
    const calls: string[] = [];
    const initial = { enabled: true };
    const refreshed = { enabled: true, endpoints: [] };
    const result = await preparePhonePairingRoute("tailscale", true, {
      read: vi.fn(async () => {
        calls.push("read");
        return initial;
      }),
      start: vi.fn(async () => {
        calls.push("start");
        return initial;
      }),
      refreshTailscale: vi.fn(async () => {
        calls.push("refresh");
        return refreshed;
      }),
    });

    expect(calls).toEqual(["read", "refresh"]);
    expect(result).toBe(refreshed);
  });

  it("does not probe Tailscale for HTTPS or direct Wi-Fi pairing", async () => {
    for (const route of ["automatic", "local"] as const) {
      const refreshTailscale = vi.fn(async () => ({ enabled: true }));
      await preparePhonePairingRoute(route, false, {
        read: vi.fn(async () => ({ enabled: true })),
        start: vi.fn(async () => ({ enabled: true })),
        refreshTailscale,
      });
      expect(refreshTailscale).not.toHaveBeenCalled();
    }
  });

  it("does not begin a Tailscale probe after the setup attempt is cancelled", async () => {
    const refreshTailscale = vi.fn(async () => ({ enabled: true }));
    await preparePhonePairingRoute("tailscale", true, {
      read: vi.fn(async () => ({ enabled: true })),
      start: vi.fn(async () => ({ enabled: true })),
      refreshTailscale,
      shouldContinue: () => false,
    });
    expect(refreshTailscale).not.toHaveBeenCalled();
  });

  it("starts a sidecar that stopped after the panel's last enabled snapshot", async () => {
    const calls: string[] = [];
    const result = await preparePhonePairingRoute("tailscale", true, {
      read: vi.fn(async () => {
        calls.push("read");
        return { enabled: false };
      }),
      start: vi.fn(async () => {
        calls.push("start");
        return { enabled: true };
      }),
      refreshTailscale: vi.fn(async () => {
        calls.push("refresh");
        return { enabled: true };
      }),
    });

    expect(calls).toEqual(["read", "start", "refresh"]);
    expect(result.enabled).toBe(true);
  });

  it("moves from intro to verifying and preserves the profile-independent resume path", () => {
    const started = phoneSetupReducer(initialPhoneSetupFlowState, {
      type: "start",
      deviceIds: ["existing"],
    });
    expect(
      derivePhoneSetupPhase(started, {
        provisioning: false,
        pairingOpen: false,
      }),
    ).toBe("verifying");

    const skipped = phoneSetupReducer(started, { type: "skip" });
    expect(skipped.skipped).toBe(true);
    expect(skipped.active).toBe(false);
    expect(
      derivePhoneSetupPhase(skipped, {
        provisioning: false,
        pairingOpen: false,
      }),
    ).toBe("intro");

    const resumed = phoneSetupReducer(skipped, { type: "resume", deviceIds: ["existing"] });
    expect(resumed.active).toBe(true);
    expect(resumed.skipped).toBe(false);
  });

  it("stays in verifying while provisioning without an account gate", () => {
    const started = phoneSetupReducer(initialPhoneSetupFlowState, {
      type: "start",
      deviceIds: [],
    });
    expect(
      derivePhoneSetupPhase(started, {
        provisioning: true,
        pairingOpen: false,
      }),
    ).toBe("verifying");
    expect(
      derivePhoneSetupPhase(started, {
        provisioning: true,
        provisioningTimedOut: true,
        pairingOpen: false,
      }),
    ).toBe("verifying");
  });

  it("requires the hosted route for automatic pairing even when Tailscale is already available", () => {
    const companion = {
      enabled: true,
      endpoints: [{
        kind: "tailnet" as const,
        url: "http://mac.tail1234.ts.net:8810",
        priority: 0,
      }],
    };
    expect(phonePairingGate(companion, false)).toBe("unavailable");
  });

  it("opens local pairing only after the explicit Wi-Fi fallback", () => {
    expect(
      phonePairingGate(
        { enabled: true, endpoints: [] },
        false,
      ),
    ).toBe("unavailable");
    expect(
      phonePairingGate(
        { enabled: true, endpoints: [] },
        true,
      ),
    ).toBe("open");
  });

  it("opens pairing immediately when the hosted route is ready", () => {
    expect(
      phonePairingGate(
        {
          enabled: true,
          endpoints: [{ kind: "hosted", url: "https://phone.example", priority: 0 }],
        },
        false,
      ),
    ).toBe("open");
  });

  it("opens Tailscale only after the explicit fallback is selected", () => {
    const tailnet = {
      enabled: true,
      endpoints: [{
        kind: "tailnet" as const,
        url: "http://mac.tail1234.ts.net:8810",
        priority: 100,
      }],
    };
    expect(phonePairingGate(tailnet, false)).toBe("unavailable");
    expect(phonePairingGate(tailnet, true)).toBe("open");
  });

  it("arms the timeout during companion IPC and explicit local setup", () => {
    const local = phoneSetupReducer(
      phoneSetupReducer(initialPhoneSetupFlowState, { type: "start", deviceIds: [] }),
      { type: "use-local" },
    );
    expect(shouldArmPhoneSetupProvisioningTimeout(local, {
      provisioning: true,
      provisioningTimedOut: false,
    })).toBe(true);
    expect(derivePhoneSetupPhase(local, {
      provisioning: true,
      provisioningTimedOut: true,
      pairingOpen: false,
    })).toBe("verifying");
  });

  it("closes a pairing window that resolves after cancellation", async () => {
    let current = true;
    let resolveOpen!: (value: { pairing: true }) => void;
    const open = vi.fn(() => new Promise<{ pairing: true }>((resolve) => {
      resolveOpen = resolve;
    }));
    const close = vi.fn(async () => undefined);
    const result = keepPhonePairingIfCurrent(open, close, () => current);

    current = false;
    resolveOpen({ pairing: true });
    await expect(result).resolves.toBeNull();
    expect(close).toHaveBeenCalledOnce();
  });

  it("lets a timed-out generation release the UI without a late completion releasing its replacement", () => {
    const lock: PhonePairingAttemptLock = { generation: null };
    expect(claimPhonePairingAttempt(lock, 1)).toBe(true);
    expect(releasePhonePairingAttempt(lock, 1)).toBe(true);
    expect(claimPhonePairingAttempt(lock, 2)).toBe(true);

    expect(releasePhonePairingAttempt(lock, 1)).toBe(false);
    expect(lock.generation).toBe(2);
    expect(releasePhonePairingAttempt(lock, 2)).toBe(true);
  });

  it("keeps the active mutation serialized and promotes only the newest pending generation", () => {
    const queue: PhonePairingAttemptQueue<{ generation: number }> = {
      active: null,
      pending: null,
    };
    expect(queuePhonePairingAttempt(queue, { generation: 1 })).toBe("start");
    expect(queuePhonePairingAttempt(queue, { generation: 2 })).toBe("queued");
    expect(queuePhonePairingAttempt(queue, { generation: 3 })).toBe("queued");
    expect(queue).toEqual({ active: { generation: 1 }, pending: { generation: 3 } });

    invalidatePhonePairingAttempt(queue, 1);
    expect(queue.active?.generation).toBe(1);
    expect(completePhonePairingAttempt(queue, 2)).toBeNull();
    expect(completePhonePairingAttempt(queue, 1)).toEqual({ generation: 3 });
    expect(queue).toEqual({ active: { generation: 3 }, pending: null });
  });

  it("drops a cancelled pending generation without releasing the active mutation", () => {
    const queue = {
      active: { generation: 1 },
      pending: { generation: 2 },
    };
    invalidatePhonePairingAttempt(queue, 2);
    expect(queue).toEqual({ active: { generation: 1 }, pending: null });
    expect(completePhonePairingAttempt(queue, 1)).toBeNull();
    expect(queue).toEqual({ active: null, pending: null });
  });

  it("closes only the stale attempt's exact pairing window", async () => {
    const close = vi.fn(async () => undefined);
    const opened = { pairing: { token: "old-token" } };

    await expect(closePhonePairingIfOwned(
      opened,
      async () => ({ pairing: { token: "new-token" } }),
      close,
      () => true,
    )).resolves.toBe(false);
    expect(close).not.toHaveBeenCalled();

    await expect(closePhonePairingIfOwned(
      opened,
      async () => opened,
      close,
      () => true,
    )).resolves.toBe(true);
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not overlap a slow poll with later timer ticks", async () => {
    vi.useFakeTimers();
    try {
      let release!: () => void;
      const poll = vi.fn(() => new Promise<void>((resolve) => {
        release = resolve;
      }));
      const stop = startNonOverlappingPhoneSetupPoll(poll, 1_000);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(poll).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(poll).toHaveBeenCalledTimes(1);

      release();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(poll).toHaveBeenCalledTimes(2);
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("derives paired success from a device added after setup began", () => {
    const started = phoneSetupReducer(initialPhoneSetupFlowState, {
      type: "start",
      deviceIds: ["old"],
    });
    const device = newlyPairedDevice(started.baselineDeviceIds, [
      { id: "old", name: "Old phone" },
      { id: "new", name: "Milind’s iPhone" },
    ]);
    expect(device?.name).toBe("Milind’s iPhone");

    const success = phoneSetupReducer(started, {
      type: "paired",
      deviceName: device?.name ?? "Phone",
    });
    expect(
      derivePhoneSetupPhase(success, {
        provisioning: false,
        pairingOpen: false,
      }),
    ).toBe("success");
  });

  it("rebases on historical devices when pairing opens and waits for a later device", () => {
    const preStart = phoneSetupReducer(initialPhoneSetupFlowState, {
      type: "start",
      deviceIds: [],
    });
    const historicalDevices = [
      { id: "old-1", name: "Old iPhone" },
      { id: "old-2", name: "Test iPhone" },
      { id: "old-3", name: "Previous iPhone" },
    ];

    expect(newlyPairedDeviceForFlow(preStart, historicalDevices)).toBeNull();

    const pairingOpen = phoneSetupReducer(preStart, {
      type: "pairing-opened",
      deviceIds: historicalDevices.map((device) => device.id),
    });
    expect(pairingOpen.pairingAttempted).toBe(true);
    expect(pairingOpen.baselineDeviceIds).toEqual(["old-1", "old-2", "old-3"]);
    expect(newlyPairedDeviceForFlow(pairingOpen, historicalDevices)).toBeNull();

    const newPhone = { id: "new-1", name: "Milind’s iPhone" };
    expect(newlyPairedDeviceForFlow(pairingOpen, [...historicalDevices, newPhone])).toBe(newPhone);

    const success = phoneSetupReducer(pairingOpen, {
      type: "paired",
      deviceName: newPhone.name,
    });
    expect(
      derivePhoneSetupPhase(success, {
        provisioning: false,
        pairingOpen: false,
      }),
    ).toBe("success");
  });

  it("waits for the initial device snapshot before capturing the success baseline", () => {
    expect(phoneSetupBaseline(null)).toBeNull();

    const baseline = phoneSetupBaseline([{ id: "already-paired", name: "Existing iPhone" }]);
    expect(baseline).toEqual(["already-paired"]);
    expect(
      newlyPairedDevice(baseline ?? [], [{ id: "already-paired", name: "Existing iPhone" }]),
    ).toBeNull();
  });

  it("turns a disabled start result into a stable actionable error", () => {
    expect(companionStartFailure({ enabled: true })).toBeNull();
    expect(companionStartFailure({ enabled: false })).toContain("Advanced & troubleshooting");
    expect(companionStartFailure({ enabled: false, error: "Port 8811 is already in use" })).toBe(
      "Port 8811 is already in use",
    );
  });

  it("requires pairing(true) to return a healthy live pairing window", () => {
    const token = `omb_pair_${"a".repeat(43)}`;
    const fresh = {
      code: "123456",
      token,
      expiresAt: 2_000,
    };
    expect(companionPairingOpenFailure({
      enabled: true,
      pairing: fresh,
    }, null, 1_000)).toBeNull();
    expect(companionPairingOpenFailure({ enabled: true, pairing: null }, null, 1_000)).toContain(
      "Device pairing did not open",
    );
    expect(companionPairingOpenFailure({
      enabled: true,
      pairing: fresh,
      error: "the companion stopped responding",
    }, null, 1_000)).toBe("the companion stopped responding");
    expect(companionPairingOpenFailure({
      enabled: true,
      pairing: fresh,
    }, token, 1_000)).toContain("Device pairing did not open");
    expect(companionPairingOpenFailure({
      enabled: true,
      pairing: { ...fresh, expiresAt: 999 },
    }, null, 1_000)).toContain("Device pairing did not open");
  });

  it("unwraps Electron IPC errors without exposing channel machinery", () => {
    const requestId = "c285fe8c-f6f4-41a3-a737-7a2d1faf405a";
    const message = normalizePhoneSetupActionError(
      new Error(
        `Error invoking remote method 'companion:start': Error: Too many attempts were made. Reference: ${requestId}.`,
      ),
      "Remote access could not start. Try again.",
    );
    expect(message).toBe(`Too many attempts were made. Reference: ${requestId}.`);
    expect(message).not.toContain("remote method");
    expect(message).not.toContain("companion:start");
  });

  it("replaces arbitrary IPC details with calm setup copy", () => {
    const message = normalizePhoneSetupActionError(
      new Error("Error invoking remote method 'companion:pairing': Error: /private/keychain failed"),
      "Device pairing could not be prepared. Try again.",
    );
    expect(message).toBe("Device pairing could not be prepared. Try again.");
    expect(message).not.toContain("remote method");
    expect(message).not.toContain("companion:pairing");
  });
});
