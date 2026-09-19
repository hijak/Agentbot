import { describe, expect, it } from "vitest";

import {
  isPasteKeyEvent,
  typeTextAsKeystrokes,
  unicodeToKeysym,
  type RfbKeyTarget,
} from "./open-computer-paste";

function pasteEvent(partial: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    defaultPrevented: false,
    altKey: false,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    key: "",
    code: "",
    ...partial,
  } as KeyboardEvent;
}

describe("open-computer-paste", () => {
  it("maps ascii, tab, newline, and unicode to keysyms", () => {
    expect(unicodeToKeysym(0x41)).toBe(0x41);
    expect(unicodeToKeysym(0x09)).toBe(0xff09);
    expect(unicodeToKeysym(0x0a)).toBe(0xff0d);
    expect(unicodeToKeysym(0x0d)).toBe(0xff0d);
    expect(unicodeToKeysym(0x1f600)).toBe(0x01000000 | 0x1f600);
  });

  it("detects ctrl/cmd+v paste shortcuts", () => {
    expect(isPasteKeyEvent(pasteEvent({ key: "v", ctrlKey: true }))).toBe(true);
    expect(isPasteKeyEvent(pasteEvent({ key: "v", metaKey: true }))).toBe(true);
    expect(isPasteKeyEvent(pasteEvent({ key: "v", ctrlKey: true, altKey: true }))).toBe(false);
    expect(isPasteKeyEvent(pasteEvent({ key: "c", metaKey: true }))).toBe(false);
  });

  it("types every character as an RFB key press after releasing modifiers", async () => {
    const sent: Array<[number, string | null, boolean | undefined]> = [];
    const rfb: RfbKeyTarget = {
      sendKey(keysym, code, down) {
        sent.push([keysym, code, down]);
      },
      focus() {},
    };

    const text = "Ab\n" + "x".repeat(70);
    const { typed } = await typeTextAsKeystrokes(rfb, text, { delayMs: 0 });

    expect(typed).toBe(73);
    const releases = sent.filter((entry) => entry[2] === false);
    expect(releases.length).toBe(5);
    const presses = sent.filter((entry) => entry[2] === undefined).map((entry) => entry[0]);
    expect(presses.slice(0, 3)).toEqual([0x41, 0x62, 0xff0d]);
    expect(presses.length).toBe(73);
  });

  it("stops typing when aborted", async () => {
    const presses: number[] = [];
    const controller = new AbortController();
    const rfb: RfbKeyTarget = {
      sendKey(keysym, _code, down) {
        if (down === undefined) presses.push(keysym);
        if (presses.length === 3) controller.abort();
      },
    };
    await expect(
      typeTextAsKeystrokes(rfb, "abcdefgh", { delayMs: 1, signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(presses.length).toBe(3);
  });
});
