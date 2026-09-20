import type RFB from "@novnc/novnc";
import {
  mintOpenComputerSession,
  openComputerDesktopWsUrl,
  type HostedSession,
} from "./client";
import { frameLooksBlank } from "./open-computer-frame";

export { frameLooksBlank } from "./open-computer-frame";

const DEFAULT_TIMEOUT_MS = 20_000;
const XK_Shift_L = 0xffe1;

type SnapshotRfb = RFB & {
  toDataURL?: (type?: string, encoderOptions?: number) => string;
};

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Snapshot cancelled", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Snapshot cancelled", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",", 2);
  const mime = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function waitForCanvas(
  host: HTMLElement,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let timer = 0;

    const fail = (error: Error) => {
      window.clearInterval(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(error);
    };

    const onAbort = () => fail(new DOMException("Snapshot cancelled", "AbortError"));

    const tick = () => {
      const canvas = host.querySelector("canvas");
      if (canvas && canvas.width > 1 && canvas.height > 1) {
        window.clearInterval(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve(canvas);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        fail(new Error("Timed out waiting for desktop frame"));
      }
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = window.setInterval(tick, 80);
    tick();
  });
}

function wakeDesktop(rfb: SnapshotRfb): void {
  // Shift alone usually drops xscreensaver / DPMS without clicking anything.
  rfb.viewOnly = false;
  rfb.focus?.({ preventScroll: true });
  rfb.sendKey(XK_Shift_L, "ShiftLeft", true);
  rfb.sendKey(XK_Shift_L, "ShiftLeft", false);
}

async function waitForReadableFrame(
  host: HTMLElement,
  rfb: SnapshotRfb,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<HTMLCanvasElement> {
  const deadline = Date.now() + timeoutMs;
  let lastNudge = 0;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException("Snapshot cancelled", "AbortError");
    const canvas = host.querySelector("canvas");
    if (canvas && canvas.width > 1 && canvas.height > 1 && !frameLooksBlank(canvas)) {
      return canvas;
    }
    if (Date.now() - lastNudge > 1_500) {
      wakeDesktop(rfb);
      lastNudge = Date.now();
    }
    await delay(350, signal);
  }
  // Prefer a late blank frame over failing hard — caller still shows something.
  const fallback = host.querySelector("canvas");
  if (fallback && fallback.width > 1 && fallback.height > 1) return fallback;
  throw new Error("Timed out waiting for desktop frame");
}

function canvasToJpegBlob(source: HTMLCanvasElement, quality = 0.72): Promise<Blob> {
  const maxWidth = 1280;
  const scale = Math.min(1, maxWidth / source.width);
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(source.width * scale));
  output.height = Math.max(1, Math.round(source.height * scale));
  const context = output.getContext("2d");
  if (!context) return Promise.reject(new Error("Could not capture desktop frame"));
  context.drawImage(source, 0, 0, output.width, output.height);
  return new Promise((resolve, reject) => {
    output.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode desktop frame"))),
      "image/jpeg",
      quality,
    );
  });
}

/** Briefly connect over VNC, wake idle/screensaver if needed, grab one JPEG. */
export async function captureOpenComputerSnapshot(
  session: HostedSession,
  surfaceId: string,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<Blob> {
  const signal = options?.signal;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (signal?.aborted) throw new DOMException("Snapshot cancelled", "AbortError");

  const { url } = await mintOpenComputerSession(session, surfaceId);
  if (signal?.aborted) throw new DOMException("Snapshot cancelled", "AbortError");

  // Keep the host in the viewport. Offscreen / display:none hosts often never
  // paint a real framebuffer in Chromium/Electron.
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:0;top:0;width:1280px;height:800px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden;";
  document.body.appendChild(host);

  const { default: RFB } = await import("@novnc/novnc");
  let rfb: SnapshotRfb | null = null;
  try {
    const desktopWsUrl = openComputerDesktopWsUrl(session, url);
    rfb = new RFB(host, desktopWsUrl, { credentials: {} }) as SnapshotRfb;
    rfb.scaleViewport = false;
    rfb.resizeSession = false;
    rfb.viewOnly = false;
    rfb.background = "#0E0E0F";

    await new Promise<void>((resolve, reject) => {
      const onAbort = () => reject(new DOMException("Snapshot cancelled", "AbortError"));
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener("abort", onAbort, { once: true });
      const timer = window.setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        reject(new Error("Timed out connecting to desktop"));
      }, timeoutMs);
      rfb!.addEventListener("connect", () => {
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve();
      });
      rfb!.addEventListener("disconnect", () => {
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(new Error("Desktop disconnected before a frame arrived"));
      });
    });

    await waitForCanvas(host, signal, Math.min(timeoutMs, 8_000));
    wakeDesktop(rfb);
    // Screensaver / DPMS often needs a beat after the wake key before redrawing.
    await delay(600, signal);
    const canvas = await waitForReadableFrame(host, rfb, signal, Math.min(timeoutMs, 12_000));

    if (typeof rfb.toDataURL === "function") {
      try {
        return dataUrlToBlob(rfb.toDataURL("image/jpeg", 0.72));
      } catch {
        // Fall through to canvas encode.
      }
    }
    return await canvasToJpegBlob(canvas);
  } finally {
    try {
      rfb?.disconnect();
    } catch {
      // ignore teardown races
    }
    host.remove();
  }
}

export function canvasElementToJpegBlob(source: HTMLCanvasElement): Promise<Blob> {
  return canvasToJpegBlob(source);
}
