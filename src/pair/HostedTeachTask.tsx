import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { desktopHasKeyboardFocus } from "@/lib/agenthosting/open-computer-paste";
import { canvasToHostedJpeg } from "@/lib/agenthosting/image-files";
import {
  describeDesktopClick,
  describeDesktopKey,
  type TaughtTaskDemonstration,
  type TaughtTaskEvent,
} from "@/lib/agenthosting/teach-a-task";

const MAX_SCREENSHOTS = 5;
const MAX_RECORDED_EVENTS = 80;

async function captureDesktop(
  host: HTMLElement | null,
  index: number,
): Promise<File | null> {
  const source = host?.querySelector("canvas");
  if (!(source instanceof HTMLCanvasElement) || source.width < 1 || source.height < 1) return null;
  return canvasToHostedJpeg(source, `teach-task-${index + 1}.jpg`);
}

export function HostedTeachTask({
  desktopRef,
  connected,
  disabled,
  onStart,
  onComplete,
}: {
  desktopRef: RefObject<HTMLElement | null>;
  connected: boolean;
  disabled?: boolean;
  onStart?: () => void;
  onComplete: (demo: TaughtTaskDemonstration) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<"setup" | "recording" | "review">("setup");
  const [eventCount, setEventCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [screenshotCount, setScreenshotCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const eventsRef = useRef<TaughtTaskEvent[]>([]);
  const screenshotsRef = useRef<File[]>([]);
  const startedAtRef = useRef(0);
  const lastEventRef = useRef<{ description: string; at: number } | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const captureGenerationRef = useRef(0);
  const captureQueueRef = useRef<Promise<void>>(Promise.resolve());

  const record = useCallback((description: string) => {
    const at = Date.now();
    const previous = lastEventRef.current;
    if (
      description === "Typed text (content withheld)." &&
      previous?.description === description &&
      at - previous.at < 900
    ) {
      return;
    }
    if (
      description.startsWith("Scrolled") &&
      previous?.description.startsWith("Scrolled") &&
      at - previous.at < 500
    ) {
      return;
    }
    if (eventsRef.current.length >= MAX_RECORDED_EVENTS) return;
    lastEventRef.current = { description, at };
    eventsRef.current.push({ atMs: at - startedAtRef.current, description });
    setEventCount(eventsRef.current.length);
  }, []);

  const takeScreenshot = useCallback(() => {
    const generation = captureGenerationRef.current;
    captureQueueRef.current = captureQueueRef.current.then(async () => {
      if (
        generation !== captureGenerationRef.current ||
        screenshotsRef.current.length >= MAX_SCREENSHOTS
      ) {
        return;
      }
      const screenshot = await captureDesktop(
        desktopRef.current,
        screenshotsRef.current.length,
      );
      if (
        !screenshot ||
        generation !== captureGenerationRef.current ||
        screenshotsRef.current.length >= MAX_SCREENSHOTS
      ) {
        return;
      }
      screenshotsRef.current.push(screenshot);
      setScreenshotCount(screenshotsRef.current.length);
    });
    return captureQueueRef.current;
  }, [desktopRef]);

  const scheduleScreenshot = useCallback(() => {
    if (screenshotsRef.current.length >= MAX_SCREENSHOTS || captureTimerRef.current != null) return;
    captureTimerRef.current = window.setTimeout(() => {
      captureTimerRef.current = null;
      void takeScreenshot();
    }, 700);
  }, [takeScreenshot]);

  useEffect(() => {
    if (phase !== "recording") return;
    const host = desktopRef.current;
    if (!host) return;

    const onPointerDown = (event: PointerEvent) => {
      record(describeDesktopClick(event.clientX, event.clientY, host.getBoundingClientRect()));
      scheduleScreenshot();
    };
    const onWheel = (event: WheelEvent) => {
      record(`Scrolled ${Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? (event.deltaY > 0 ? "down" : "up") : (event.deltaX > 0 ? "right" : "left")}.`);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!desktopHasKeyboardFocus(host)) return;
      const description = describeDesktopKey(event);
      if (description) record(description);
      if (event.key === "Enter" || event.key === "Tab") scheduleScreenshot();
    };
    const ticker = window.setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);

    host.addEventListener("pointerdown", onPointerDown, true);
    host.addEventListener("wheel", onWheel, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.clearInterval(ticker);
      host.removeEventListener("pointerdown", onPointerDown, true);
      host.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [desktopRef, phase, record, scheduleScreenshot]);

  useEffect(
    () => () => {
      if (captureTimerRef.current != null) window.clearTimeout(captureTimerRef.current);
    },
    [],
  );

  const reset = () => {
    captureGenerationRef.current += 1;
    if (captureTimerRef.current != null) window.clearTimeout(captureTimerRef.current);
    captureTimerRef.current = null;
    eventsRef.current = [];
    screenshotsRef.current = [];
    lastEventRef.current = null;
    setEventCount(0);
    setElapsedMs(0);
    setScreenshotCount(0);
    setPhase("setup");
  };

  const close = () => {
    reset();
    setOpen(false);
  };

  const start = () => {
    if (!name.trim() || !connected || disabled) return;
    setSubmitError(null);
    reset();
    startedAtRef.current = Date.now();
    setPhase("recording");
    onStart?.();
    void takeScreenshot();
  };

  const finish = async () => {
    if (phase !== "recording") return;
    if (captureTimerRef.current != null) window.clearTimeout(captureTimerRef.current);
    captureTimerRef.current = null;
    const duration = Date.now() - startedAtRef.current;
    setElapsedMs(duration);
    setPhase("review");
    await takeScreenshot();
  };

  const submit = async () => {
    if (!name.trim() || submitting) return;
    if (disabled) {
      setSubmitError("Wait for the current chat to finish, then create the skill.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await captureQueueRef.current;
      await onComplete({
        name: name.trim(),
        notes: notes.trim(),
        durationMs: elapsedMs,
        events: [...eventsRef.current],
        screenshots: [...screenshotsRef.current],
      });
      setName("");
      setNotes("");
      close();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not create the teaching chat.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        className="ah-btn ah-btn-outline ah-btn-sm"
        onClick={() => setOpen(true)}
        disabled={!connected || disabled}
        title={
          connected
            ? "Demonstrate a workflow and turn it into a skill"
            : "Connect Open Computer first"
        }
      >
        Teach a Task
      </button>
    );
  }

  return (
    <div className="w-full space-y-2 border-t border-[var(--ah-border-subtle)] pt-2">
      {phase === "setup" ? (
        <>
          <p className="text-[11px] text-[var(--ah-text-secondary)]">
            Name the outcome, then demonstrate it in Open Computer. The agent will turn the
            demonstration into semantic steps, not a coordinate macro.
          </p>
          <input
            className="ah-input w-full text-xs"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Submit the weekly expense report"
            aria-label="Task to teach"
            autoFocus
          />
          <textarea
            className="ah-textarea min-h-[3.5rem] w-full resize-y text-xs"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional guidance, prerequisites, or expected result"
            aria-label="Task guidance"
          />
          <p className="text-[10px] text-[var(--ah-text-faint)]">
            Screen snapshots are attached to the teaching chat. Keep passwords, tokens, and
            personal data off screen.
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              className="ah-btn ah-btn-default ah-btn-sm"
              disabled={!name.trim() || !connected || disabled}
              onClick={start}
            >
              Start demonstration
            </button>
            <button type="button" className="ah-btn ah-btn-ghost ah-btn-sm" onClick={close}>
              Cancel
            </button>
          </div>
        </>
      ) : phase === "recording" ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--ah-text-primary)]">Demonstrating: {name}</p>
            <span className="ah-micro text-[var(--ah-fault-300)]">Recording</span>
          </div>
          <p className="text-[10px] text-[var(--ah-text-faint)]">
            {(elapsedMs / 1000).toFixed(1)}s · {eventCount} event{eventCount === 1 ? "" : "s"} ·{" "}
            {screenshotCount}/{MAX_SCREENSHOTS} snapshots
          </p>
          <div className="flex gap-1.5">
            <button type="button" className="ah-btn ah-btn-default ah-btn-sm" onClick={() => void finish()}>
              Finish demonstration
            </button>
            <button type="button" className="ah-btn ah-btn-ghost ah-btn-sm" onClick={close}>
              Discard
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs font-medium text-[var(--ah-text-primary)]">Create this skill?</p>
          <p className="text-[11px] text-[var(--ah-text-secondary)]">
            The teaching chat will include {eventCount} observed event{eventCount === 1 ? "" : "s"} and{" "}
            {screenshotCount} screen snapshot{screenshotCount === 1 ? "" : "s"}. Review the generated
            skill before relying on it.
          </p>
          {submitError ? <p className="text-[11px] ah-fault">{submitError}</p> : null}
          <div className="flex gap-1.5">
            <button
              type="button"
              className="ah-btn ah-btn-default ah-btn-sm"
              disabled={submitting || disabled}
              onClick={() => void submit()}
            >
              {submitting ? "Creating chat…" : "Create skill"}
            </button>
            <button
              type="button"
              className="ah-btn ah-btn-ghost ah-btn-sm"
              disabled={submitting}
              onClick={() => setPhase("setup")}
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}
