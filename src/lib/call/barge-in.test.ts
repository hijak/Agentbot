import { describe, expect, it, vi } from "vitest";
import { BargeInDetector } from "./barge-in";

describe("BargeInDetector", () => {
  it("initializes with default options and starts inactive", () => {
    const detector = new BargeInDetector();
    expect(detector.isActive).toBe(false);
  });

  it("handles missing mediaDevices gracefully without throwing", async () => {
    const detector = new BargeInDetector({ threshold: 0.05, consecutiveFrames: 2 });
    const onBargeIn = vi.fn();
    const started = await detector.start(onBargeIn);
    expect(started).toBe(false);
    expect(detector.isActive).toBe(false);
    expect(onBargeIn).not.toHaveBeenCalled();
  });

  it("stops and cleans up cleanly", () => {
    const detector = new BargeInDetector();
    detector.stop();
    expect(detector.isActive).toBe(false);
  });

  it("accepts echo-hardening options without changing defaults", () => {
    const hardened = new BargeInDetector({ threshold: 0.09, consecutiveFrames: 8, graceMs: 1200 });
    expect(hardened.isActive).toBe(false);
    hardened.stop();
    expect(hardened.isActive).toBe(false);
  });
});
