import { useEffect, useMemo, useState } from "react";
import {
  cancelHostedTeachSession,
  getActiveHostedTeachSession,
  getHostedTeachSession,
  startHostedTeachSession,
  stopHostedTeachSession,
  type HostedSession,
  type HostedTeachSession,
} from "@/lib/agenthosting/client";
import { teachTaskElapsed, teachTaskStatusLabel } from "@/lib/agenthosting/teach-a-task";

export type HostedTeachTaskApi = {
  start(input: { name: string; notes?: string }): Promise<HostedTeachSession>;
  active(): Promise<HostedTeachSession | null>;
  status(sessionId: string): Promise<HostedTeachSession>;
  stop(sessionId: string): Promise<HostedTeachSession>;
  cancel(sessionId: string): Promise<void>;
};

function productionApi(session: HostedSession, surfaceId: string): HostedTeachTaskApi {
  return {
    start: (input) => startHostedTeachSession(session, surfaceId, input),
    active: () => getActiveHostedTeachSession(session, surfaceId),
    status: (sessionId) => getHostedTeachSession(session, surfaceId, sessionId),
    stop: (sessionId) => stopHostedTeachSession(session, surfaceId, sessionId),
    cancel: (sessionId) => cancelHostedTeachSession(session, surfaceId, sessionId),
  };
}

function storedSessionKey(surfaceId: string): string {
  return `agentbot.teach-task.${surfaceId}`;
}

export function TeachTask({
  session,
  surfaceId,
  connected,
  disabled,
  api: suppliedApi,
  onDryRun,
}: {
  session: HostedSession;
  surfaceId: string;
  connected: boolean;
  disabled?: boolean;
  api?: HostedTeachTaskApi;
  onDryRun?: (prompt: string) => void | Promise<void>;
}) {
  const api = useMemo(
    () => suppliedApi ?? productionApi(session, surfaceId),
    [session, suppliedApi, surfaceId],
  );
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [teachSession, setTeachSession] = useState<HostedTeachSession | null>(null);
  const [elapsedNow, setElapsedNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(storedSessionKey(surfaceId));
    void (async () => {
      if (!saved) return api.active();
      return (await api.status(saved).catch(() => null)) ?? api.active();
    })()
      .then((restored) => {
        if (!restored) {
          if (saved) window.sessionStorage.removeItem(storedSessionKey(surfaceId));
          return;
        }
        window.sessionStorage.setItem(storedSessionKey(surfaceId), restored.id);
        setOpen(true);
        setTeachSession(restored);
      });
  }, [api, surfaceId]);

  useEffect(() => {
    if (teachSession?.status !== "recording") return;
    const timer = window.setInterval(() => setElapsedNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [teachSession?.status]);

  useEffect(() => {
    if (!teachSession || !["queued", "processing"].includes(teachSession.status)) return;
    let cancelled = false;
    let timer: number | null = null;
    const refresh = async () => {
      try {
        const next = await api.status(teachSession.id);
        if (!cancelled) {
          setTeachSession((current) => (
            current?.status === next.status &&
            current.error === next.error &&
            current.result?.status === next.result?.status
              ? current
              : next
          ));
          setError((current) => current === null ? current : null);
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : "Could not refresh teaching status.");
        }
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void refresh(), 2_500);
      }
    };
    void refresh();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [api, teachSession?.id, teachSession?.status]);

  const start = async () => {
    if (!name.trim() || !connected || disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      const started = await api.start({ name: name.trim(), notes: notes.trim() });
      window.sessionStorage.setItem(storedSessionKey(surfaceId), started.id);
      setElapsedNow(Date.now());
      setTeachSession(started);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start the teaching recording.");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!teachSession || teachSession.status !== "recording" || busy) return;
    setBusy(true);
    setError(null);
    try {
      setTeachSession(await api.stop(teachSession.id));
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : "Could not stop the teaching recording.");
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!teachSession || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.cancel(teachSession.id);
      window.sessionStorage.removeItem(storedSessionKey(surfaceId));
      setTeachSession(null);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Could not discard the teaching recording.");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    window.sessionStorage.removeItem(storedSessionKey(surfaceId));
    setTeachSession(null);
    setName("");
    setNotes("");
    setError(null);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="ah-btn ah-btn-outline ah-btn-sm"
        onClick={() => setOpen(true)}
        disabled={!connected || disabled}
        title={connected ? "Record a workflow on this hosted desktop and turn it into a skill" : "Connect Open Computer first"}
      >
        Teach a Task
      </button>
    );
  }

  if (!teachSession) {
    return (
      <div className="w-80 space-y-2 border-l border-[var(--ah-border-subtle)] pl-3">
        <p className="text-[11px] text-[var(--ah-text-secondary)]">
          Name the outcome, then perform it on this hosted Linux desktop. The host records the
          desktop and reconstructs semantic steps, not mouse coordinates.
        </p>
        <input
          className="ah-input w-full text-xs"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Submit the weekly expense report"
          aria-label="Task to teach"
          maxLength={120}
          autoFocus
        />
        <textarea
          className="ah-textarea min-h-[3.5rem] w-full resize-y text-xs"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional guidance, prerequisites, or expected result"
          aria-label="Task guidance"
          maxLength={4000}
        />
        <p className="text-[10px] text-[var(--ah-text-faint)]">
          The recording is stored in the agent workspace and analyzed with its configured model.
          Credentials are excluded from the generated skill.
        </p>
        {error ? <p className="text-[11px] ah-fault">{error}</p> : null}
        <div className="flex gap-1.5">
          <button
            type="button"
            className="ah-btn ah-btn-default ah-btn-sm"
            disabled={!name.trim() || !connected || disabled || busy}
            onClick={() => void start()}
          >
            {busy ? "Starting…" : "Start recording"}
          </button>
          <button type="button" className="ah-btn ah-btn-ghost ah-btn-sm" disabled={busy} onClick={dismiss}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const result = teachSession.result;
  const completed = teachSession.status === "completed" && result?.status === "completed";
  const failed = teachSession.status === "failed" || result?.status === "failed";
  const skillUrl = result?.skill?.link && session.dashboardURL
    ? new URL(result.skill.link, `${session.dashboardURL}/`).toString()
    : result?.skill?.link;

  return (
    <div className="w-80 space-y-2 border-l border-[var(--ah-border-subtle)] pl-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-[var(--ah-text-primary)]">{teachSession.name}</p>
        <span className="ah-micro text-[var(--ah-text-faint)]">
          {teachTaskStatusLabel(teachSession.status)}
        </span>
      </div>
      {teachSession.status === "recording" ? (
        <>
          <p className="text-[10px] text-[var(--ah-text-faint)]">
            {teachTaskElapsed(teachSession.startedAt, elapsedNow)} · host screen recording
          </p>
          <p className="text-[11px] text-[var(--ah-text-secondary)]">
            Perform the workflow on the desktop, then stop when the final state is visible.
          </p>
          {error ? <p className="text-[11px] ah-fault">{error}</p> : null}
          <div className="flex gap-1.5">
            <button type="button" className="ah-btn ah-btn-default ah-btn-sm" disabled={busy} onClick={() => void finish()}>
              {busy ? "Finalizing…" : "Stop and learn"}
            </button>
            <button type="button" className="ah-btn ah-btn-ghost ah-btn-sm" disabled={busy} onClick={() => void discard()}>
              Discard
            </button>
          </div>
        </>
      ) : completed ? (
        <>
          <p className="text-[11px] text-[var(--ah-text-secondary)]">{result.summary}</p>
          {result.learnedSteps?.length ? (
            <ol className="max-h-32 list-decimal space-y-0.5 overflow-y-auto pl-4 text-[10px] text-[var(--ah-text-faint)]">
              {result.learnedSteps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}
            </ol>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {skillUrl ? (
              <a className="ah-btn ah-btn-outline ah-btn-sm" href={skillUrl} target="_blank" rel="noreferrer">
                Open skill
              </a>
            ) : null}
            {result.dryRunPrompt && onDryRun ? (
              <button type="button" className="ah-btn ah-btn-default ah-btn-sm" onClick={() => void onDryRun(result.dryRunPrompt!)}>
                Dry run
              </button>
            ) : null}
            <button type="button" className="ah-btn ah-btn-ghost ah-btn-sm" onClick={dismiss}>
              Done
            </button>
          </div>
        </>
      ) : failed ? (
        <>
          <p className="text-[11px] ah-fault">{result?.error || teachSession.error || "The demonstration could not be learned."}</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              className="ah-btn ah-btn-default ah-btn-sm"
              onClick={() => {
                window.sessionStorage.removeItem(storedSessionKey(surfaceId));
                setTeachSession(null);
              }}
            >
              Try again
            </button>
            <button type="button" className="ah-btn ah-btn-ghost ah-btn-sm" onClick={dismiss}>
              Close
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] text-[var(--ah-text-secondary)]">
            The agent is validating the recording, reconstructing the workflow with browser
            evidence, and writing a reusable skill. You can leave this view.
          </p>
          {error ? <p className="text-[11px] ah-fault">{error}</p> : null}
          <button type="button" className="ah-btn ah-btn-ghost ah-btn-sm" onClick={() => setOpen(false)}>
            Hide
          </button>
        </>
      )}
    </div>
  );
}

export const HostedTeachTask = TeachTask;
