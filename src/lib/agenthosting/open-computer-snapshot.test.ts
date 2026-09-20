import { describe, expect, it } from "vitest";
import { wakeDesktop } from "./open-computer-snapshot";

type SentKey = [number, string | null, boolean | undefined];

describe("open-computer-snapshot", () => {
  describe("wakeDesktop", () => {
    it("wakes the desktop with Shift over VNC without taking DOM focus", () => {
      const sent: SentKey[] = [];
      const focused: Array<FocusOptions | undefined> = [];
      const rfb = {
        viewOnly: true,
        sendKey(keysym: number, code: string | null, down?: boolean) {
          sent.push([keysym, code, down]);
        },
        focus(options?: FocusOptions) {
          focused.push(options);
        },
      };

      wakeDesktop(rfb);

      // Regression: wakeDesktop used to focus the hidden VNC canvas, which
      // unselected the prompt bar mid-typing on every docked preview refresh.
      expect(focused).toEqual([]);
      // sendKey is gated on viewOnly inside noVNC, so the wake must clear it.
      expect(rfb.viewOnly).toBe(false);
      expect(sent).toEqual([
        [0xffe1, "ShiftLeft", true],
        [0xffe1, "ShiftLeft", false],
      ]);
    });
  });
});
