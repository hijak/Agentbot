import { useEffect, useState } from "react";
import {
  createHostedSchedule,
  describeHostedCron,
  pauseHostedSchedule,
  removeHostedSchedule,
  resumeHostedSchedule,
  runHostedSchedule,
  updateHostedBot,
  updateHostedSchedule,
  type HostedBot,
  type HostedBotRoutine,
  type HostedSchedule,
  type HostedSession,
} from "@/lib/agenthosting/client";
import { StatusBadge } from "./andromeda/StatusBadge";
import {
  emptyScheduleDraft,
  ScheduleCreateForm,
  ScheduleInlineEdit,
  type ScheduleDraft,
} from "./andromeda/ScheduleEditor";

type ScheduleTab = "main" | string;

/** Dashboard-parity schedule UI: Main agent jobs + per-bot routine tabs. */
export function SchedulePanel({
  session,
  agentId,
  schedules,
  bots,
  onRefresh,
  onError,
}: {
  session: HostedSession;
  agentId: string;
  schedules: HostedSchedule[];
  bots: HostedBot[];
  onRefresh: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [tab, setTab] = useState<ScheduleTab>("main");
  const [draft, setDraft] = useState<ScheduleDraft>(() => emptyScheduleDraft());
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [editPrompt, setEditPrompt] = useState("");

  const [botRoutines, setBotRoutines] = useState<HostedBotRoutine[]>([]);
  const [editingRoutineIndex, setEditingRoutineIndex] = useState<number | null>(null);

  const activeBot = tab === "main" ? null : bots.find((b) => b.name === tab) ?? null;

  useEffect(() => {
    if (tab !== "main" && !bots.some((b) => b.name === tab)) setTab("main");
  }, [bots, tab]);

  useEffect(() => {
    setBotRoutines(activeBot?.routines ?? []);
    setDraft(emptyScheduleDraft());
    setFormError(null);
    setEditingId(null);
    setEditingRoutineIndex(null);
  }, [activeBot?.name, activeBot?.routines]);

  const persistBotRoutines = async (next: HostedBotRoutine[], after?: () => void) => {
    if (!activeBot) return;
    setBusy(true);
    setFormError(null);
    onError(null);
    setBotRoutines(next);
    try {
      await updateHostedBot(session, agentId, activeBot.name, { routines: next });
      await onRefresh();
      after?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message);
      onError(message);
      setBotRoutines(activeBot.routines ?? []);
    } finally {
      setBusy(false);
    }
  };

  const addMainSchedule = async () => {
    setBusy(true);
    setFormError(null);
    onError(null);
    try {
      await createHostedSchedule(session, agentId, {
        name: draft.name.trim() || undefined,
        schedule: draft.schedule.trim(),
        prompt: draft.prompt.trim(),
      });
      setDraft(emptyScheduleDraft());
      await onRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  };

  const addBotRoutine = async () => {
    if (!activeBot) return;
    await persistBotRoutines(
      [
        ...botRoutines,
        {
          name: draft.name.trim() || `Routine ${botRoutines.length + 1}`,
          schedule: draft.schedule.trim(),
          prompt: draft.prompt.trim(),
        },
      ],
      () => setDraft(emptyScheduleDraft()),
    );
  };

  const saveMainEdit = async () => {
    if (!editingId) return;
    setBusy(true);
    setFormError(null);
    onError(null);
    try {
      await updateHostedSchedule(session, agentId, editingId, {
        name: editName.trim() || undefined,
        schedule: editSchedule.trim(),
        prompt: editPrompt.trim(),
      });
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  };

  const saveRoutineEdit = async () => {
    if (editingRoutineIndex === null) return;
    const next = [...botRoutines];
    next[editingRoutineIndex] = {
      name: editName.trim(),
      schedule: editSchedule.trim(),
      prompt: editPrompt.trim(),
    };
    await persistBotRoutines(next, () => setEditingRoutineIndex(null));
  };

  const runAction = async (fn: () => Promise<void>) => {
    setBusy(true);
    onError(null);
    try {
      await fn();
      await onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="ah-page-title text-lg sm:text-xl">Schedule</h2>
        <p className="text-sm text-[var(--ah-text-secondary)]">
          Cron jobs the agent and its bots run themselves.
        </p>
      </div>

      {bots.length > 0 && (
        <div className="flex flex-wrap gap-1 border border-[var(--ah-border-subtle)] p-1">
          <button
            type="button"
            className={`ah-mono px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
              tab === "main"
                ? "bg-[var(--ah-surface-active)] text-[var(--ah-accent-300)]"
                : "text-[var(--ah-text-secondary)] hover:bg-[var(--ah-surface-hover)]"
            }`}
            onClick={() => setTab("main")}
          >
            Main
          </button>
          {bots.map((bot) => (
            <button
              key={bot.name}
              type="button"
              className={`ah-mono px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
                tab === bot.name
                  ? "bg-[var(--ah-surface-active)] text-[var(--ah-accent-300)]"
                  : "text-[var(--ah-text-secondary)] hover:bg-[var(--ah-surface-hover)]"
              }`}
              onClick={() => setTab(bot.name)}
            >
              {bot.title || bot.name}
            </button>
          ))}
        </div>
      )}

      <ScheduleCreateForm
        draft={draft}
        onChange={setDraft}
        onSubmit={() => void (tab === "main" ? addMainSchedule() : addBotRoutine())}
        busy={busy}
        error={formError}
        subjectLabel={activeBot ? activeBot.title || activeBot.name : "the agent"}
      />

      <div className="ah-card-bordered">
        <div className="space-y-1 border-b border-[var(--ah-border-subtle)] px-5 py-4">
          <p className="ah-mono text-sm font-medium uppercase tracking-wider">Active tasks</p>
          <p className="text-xs text-[var(--ah-text-faint)]">
            {activeBot
              ? `Hermes runs these on ${activeBot.title}'s own scheduler. Changes apply with a short runtime restart.`
              : "Hermes runs these on its own scheduler."}
          </p>
        </div>

        {tab === "main" ? (
          schedules.length === 0 ? (
            <p className="px-5 py-6 text-xs text-[var(--ah-text-faint)]">
              No scheduled tasks yet. Create one above.
            </p>
          ) : (
            <ul>
              {schedules.map((job, index) => (
                <li
                  key={job.id}
                  className={`flex items-start justify-between gap-3 px-5 py-4 ${
                    index > 0 ? "border-t border-[var(--ah-border-subtle)]" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {editingId === job.id ? (
                      <ScheduleInlineEdit
                        name={editName}
                        schedule={editSchedule}
                        prompt={editPrompt}
                        busy={busy}
                        onChange={(patch) => {
                          if (patch.name !== undefined) setEditName(patch.name);
                          if (patch.schedule !== undefined) setEditSchedule(patch.schedule);
                          if (patch.prompt !== undefined) setEditPrompt(patch.prompt);
                        }}
                        onSave={() => void saveMainEdit()}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="ah-mono text-sm font-medium uppercase tracking-wider">
                            {job.name || "Untitled"}
                          </span>
                          <span className="border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-overlay)] px-1.5 py-0.5 ah-mono text-[10px] uppercase tracking-wider text-[var(--ah-text-muted)]">
                            {describeHostedCron(job.schedule) || job.schedule}
                          </span>
                          <StatusBadge
                            variant={job.enabled ? "accent" : "subtle"}
                            label={job.enabled ? "Active" : "Paused"}
                          />
                          {job.lastStatus ? (
                            <StatusBadge variant="outline" label={job.lastStatus} />
                          ) : null}
                        </div>
                        {job.prompt ? (
                          <p className="line-clamp-2 text-xs text-[var(--ah-text-secondary)]">
                            {job.prompt}
                          </p>
                        ) : null}
                        {job.nextRun ? (
                          <p className="text-[11px] text-[var(--ah-text-faint)]">
                            Next run: {new Date(job.nextRun).toLocaleString()}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 text-xs">
                    {editingId === job.id ? null : (
                      <>
                        <button
                          type="button"
                          className="ah-link"
                          disabled={busy}
                          onClick={() =>
                            void runAction(() => runHostedSchedule(session, agentId, job.id))
                          }
                        >
                          Run now
                        </button>
                        <button
                          type="button"
                          className="ah-link"
                          disabled={busy}
                          onClick={() =>
                            void runAction(() =>
                              job.enabled
                                ? pauseHostedSchedule(session, agentId, job.id)
                                : resumeHostedSchedule(session, agentId, job.id),
                            )
                          }
                        >
                          {job.enabled ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          className="ah-link"
                          disabled={busy}
                          onClick={() => {
                            setEditingId(job.id);
                            setEditName(job.name || "");
                            setEditSchedule(job.schedule);
                            setEditPrompt(job.prompt);
                          }}
                        >
                          Edit
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="ah-link ah-fault"
                      disabled={busy}
                      onClick={() =>
                        void runAction(() => removeHostedSchedule(session, agentId, job.id))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : botRoutines.length === 0 ? (
          <p className="px-5 py-6 text-xs text-[var(--ah-text-faint)]">
            No scheduled tasks yet. Create one above.
          </p>
        ) : (
          <ul>
            {botRoutines.map((routine, index) => (
              <li
                key={`${index}-${routine.name}`}
                className={`flex items-start justify-between gap-3 px-5 py-4 ${
                  index > 0 ? "border-t border-[var(--ah-border-subtle)]" : ""
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  {editingRoutineIndex === index ? (
                    <ScheduleInlineEdit
                      name={editName}
                      schedule={editSchedule}
                      prompt={editPrompt}
                      busy={busy}
                      requireName
                      onChange={(patch) => {
                        if (patch.name !== undefined) setEditName(patch.name);
                        if (patch.schedule !== undefined) setEditSchedule(patch.schedule);
                        if (patch.prompt !== undefined) setEditPrompt(patch.prompt);
                      }}
                      onSave={() => void saveRoutineEdit()}
                      onCancel={() => setEditingRoutineIndex(null)}
                    />
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="ah-mono text-sm font-medium uppercase tracking-wider">
                          {routine.name || "Untitled"}
                        </span>
                        <span className="border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-overlay)] px-1.5 py-0.5 ah-mono text-[10px] uppercase tracking-wider text-[var(--ah-text-muted)]">
                          {describeHostedCron(routine.schedule) || routine.schedule}
                        </span>
                      </div>
                      {routine.prompt ? (
                        <p className="line-clamp-2 text-xs text-[var(--ah-text-secondary)]">
                          {routine.prompt}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 text-xs">
                  {editingRoutineIndex === index ? null : (
                    <button
                      type="button"
                      className="ah-link"
                      disabled={busy}
                      onClick={() => {
                        setEditingRoutineIndex(index);
                        setEditName(routine.name);
                        setEditSchedule(routine.schedule);
                        setEditPrompt(routine.prompt);
                      }}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    className="ah-link ah-fault"
                    disabled={busy}
                    onClick={() =>
                      void persistBotRoutines(botRoutines.filter((_, i) => i !== index))
                    }
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export const HostedSchedulePanel = SchedulePanel;
