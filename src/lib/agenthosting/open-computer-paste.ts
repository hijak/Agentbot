/** Type local clipboard text into an Open Computer noVNC session as keystrokes. */

export type RfbKeyTarget = {
  sendKey(keysym: number, code: string | null, down?: boolean): void;
  focus?: (options?: FocusOptions) => void;
};

const XK_Tab = 0xff09;
const XK_Return = 0xff0d;
const XK_Shift_L = 0xffe1;
const XK_Control_L = 0xffe3;
const XK_Meta_L = 0xffe7;
const XK_Alt_L = 0xffe9;
const XK_Super_L = 0xffeb;

// noVNC remaps Cmd to Alt_L on macOS before sending, so Alt is included here:
// intercepting Cmd+V leaves the remote Alt held until we release it.
const MODIFIERS: Array<{ keysym: number; code: string }> = [
  { keysym: XK_Shift_L, code: "ShiftLeft" },
  { keysym: XK_Control_L, code: "ControlLeft" },
  { keysym: XK_Alt_L, code: "AltLeft" },
  { keysym: XK_Meta_L, code: "MetaLeft" },
  { keysym: XK_Super_L, code: "OSLeft" },
];

/** Map a Unicode code point to an RFB/X11 keysym (Latin-1 + Unicode plane). */
export function unicodeToKeysym(codePoint: number): number {
  if (codePoint === 0x0a || codePoint === 0x0d) return XK_Return;
  if (codePoint === 0x09) return XK_Tab;
  if (codePoint >= 0x20 && codePoint <= 0xff) return codePoint;
  return 0x01000000 | codePoint;
}

/** Release modifiers the remote may still think are held after Ctrl/Cmd+V. */
export function releaseModifierKeys(rfb: RfbKeyTarget): void {
  for (const mod of MODIFIERS) {
    rfb.sendKey(mod.keysym, mod.code, false);
  }
}

export function isPasteKeyEvent(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.altKey || event.repeat) return false;
  if (!(event.ctrlKey || event.metaKey)) return false;
  return event.key.toLowerCase() === "v" || event.code === "KeyV";
}

export async function readClipboardText(): Promise<string | null> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      return text.length > 0 ? text : null;
    }
  } catch {
    // Permission denied or insecure context — caller should open the paste box.
  }
  return null;
}

export type TypeAsKeystrokesOptions = {
  /** Pause between characters. x11vnc accepts bursts; this only keeps long pastes cancellable. */
  delayMs?: number;
  signal?: AbortSignal;
  onProgress?: (typed: number, total: number) => void;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/**
 * Inject `text` into the remote desktop as RFB key events.
 * Bypasses the VNC clipboard, so it works even when guest clipboard sync is broken.
 */
export async function typeTextAsKeystrokes(
  rfb: RfbKeyTarget,
  text: string,
  options: TypeAsKeystrokesOptions = {},
): Promise<{ typed: number }> {
  const chars = [...text];
  if (chars.length === 0) return { typed: 0 };

  releaseModifierKeys(rfb);
  rfb.focus?.();

  const delayMs = options.delayMs ?? (chars.length > 64 ? 2 : 0);
  let typed = 0;

  for (const char of chars) {
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const codePoint = char.codePointAt(0);
    if (codePoint == null) continue;
    rfb.sendKey(unicodeToKeysym(codePoint), null);
    typed += 1;
    options.onProgress?.(typed, chars.length);
    if (delayMs > 0) await sleep(delayMs, options.signal);
  }

  return { typed };
}

/** True when the active element is the noVNC canvas (or inside the desktop host). */
export function desktopHasKeyboardFocus(host: HTMLElement | null): boolean {
  if (!host) return false;
  const active = document.activeElement;
  if (!active) return false;
  return active === host || host.contains(active);
}
