import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  desktopHasKeyboardFocus,
  isPasteKeyEvent,
  readClipboardText,
  typeTextAsKeystrokes,
  type RfbKeyTarget,
} from "./open-computer-paste";

type UseDesktopPasteOptions = {
  rfbRef: RefObject<RfbKeyTarget | null>;
  hostRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onNeedPasteBox?: () => void;
};

export function useDesktopPaste({
  rfbRef,
  hostRef,
  enabled,
  onNeedPasteBox,
}: UseDesktopPasteOptions) {
  const typingRef = useRef<AbortController | null>(null);
  const pasteGuardRef = useRef(0);
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Callers pass inline arrows; keep the latest one in a ref so the listener
  // effect below does not re-run (and tear down) on every render.
  const onNeedPasteBoxRef = useRef(onNeedPasteBox);
  onNeedPasteBoxRef.current = onNeedPasteBox;

  const typeIntoDesktop = useCallback(
    async (text: string) => {
      const rfb = rfbRef.current;
      if (!rfb || !text) return false;

      // A newer paste supersedes one still in flight. Nothing else aborts it:
      // in particular, re-renders caused by setTyping must not cancel typing.
      typingRef.current?.abort();
      const controller = new AbortController();
      typingRef.current = controller;
      setTyping(true);
      setStatus(null);
      try {
        const { typed } = await typeTextAsKeystrokes(rfb, text, {
          signal: controller.signal,
          onProgress: (done, total) => {
            if (total > 64) setStatus(`Typing ${done}/${total}…`);
          },
        });
        setStatus(typed > 0 ? `Typed ${typed} character${typed === 1 ? "" : "s"}` : null);
        return typed > 0;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setStatus("Paste cancelled");
          return false;
        }
        setStatus(err instanceof Error ? err.message : "Paste failed");
        return false;
      } finally {
        if (typingRef.current === controller) typingRef.current = null;
        setTyping(false);
      }
    },
    [rfbRef],
  );

  const pasteFromClipboard = useCallback(async () => {
    const text = await readClipboardText();
    if (!text) {
      onNeedPasteBoxRef.current?.();
      setStatus("Clipboard unavailable — paste into the box instead");
      return false;
    }
    return typeIntoDesktop(text);
  }, [typeIntoDesktop]);

  useEffect(() => {
    if (!enabled) return;

    const beginPaste = (text: string | null) => {
      // Cmd/Ctrl+V can surface as both keydown and paste; handle it once.
      const now = Date.now();
      if (now - pasteGuardRef.current < 250) return;
      pasteGuardRef.current = now;
      if (text) void typeIntoDesktop(text);
      else void pasteFromClipboard();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPasteKeyEvent(event)) return;
      if (!desktopHasKeyboardFocus(hostRef.current)) return;
      if (!rfbRef.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      beginPaste(null);
    };

    const onPaste = (event: ClipboardEvent) => {
      if (!desktopHasKeyboardFocus(hostRef.current)) return;
      if (!rfbRef.current) return;
      const text = event.clipboardData?.getData("text/plain");
      if (!text) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      beginPaste(text);
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("paste", onPaste, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("paste", onPaste, true);
    };
  }, [enabled, hostRef, pasteFromClipboard, rfbRef, typeIntoDesktop]);

  // Only unmount cancels an in-flight paste.
  useEffect(() => () => typingRef.current?.abort(), []);

  return { typing, status, setStatus, typeIntoDesktop, pasteFromClipboard };
}
