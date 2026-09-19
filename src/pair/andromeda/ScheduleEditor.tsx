import { useState } from "react";
import {
  describeHostedCron,
  HOSTED_SCHEDULE_PRESETS,
  type HostedBotRoutine,
} from "@/lib/agenthosting/client";
import { CornerMarkers } from "./CornerMarkers";

export type ScheduleDraft = {
  name: string;
  schedule: string;
  prompt: string;
  presetId: string;
};

export function emptyScheduleDraft(presetId = "daily-morning"): ScheduleDraft {
  const preset = HOSTED_SCHEDULE_PRESETS.find((p) => p.id === presetId) ?? HOSTED_SCHEDULE_PRESETS[0];
  return {
    name: "",
    schedule: preset.value,
    prompt: "",
    presetId: preset.id,
  };
}

export function cleanRoutines(routines: HostedBotRoutine[]): HostedBotRoutine[] {
  return routines.filter(
    (routine) => routine.name.trim() && routine.schedule.trim() && routine.prompt.trim(),
  );
}

function presetCellClass(index: number, total: number): string {
  const twoColLastRowStart = total % 2 === 0 ? total - 2 : total - 1;
  const threeColLastRowStart = total % 3 === 0 ? total - 3 : total - (total % 3);
  const parts = ["relative border-0 bg-[var(--ah-surface-base)]/80"];
  if (index < twoColLastRowStart) parts.push("border-b border-[var(--ah-border-subtle)] sm:border-b-0");
  if (index < threeColLastRowStart) parts.push("sm:border-b sm:border-[var(--ah-border-subtle)]");
  if (index % 2 === 0 && index < total - 1) parts.push("border-r border-[var(--ah-border-subtle)] sm:border-r-0");
  if (index % 3 !== 2 && index < total - 1) parts.push("sm:border-r sm:border-[var(--ah-border-subtle)]");
  return parts.join(" ");
}

/** Preset grid + prompt/name fields matching the dashboard schedule create form. */
export function ScheduleCreateForm({
  draft,
  onChange,
  onSubmit,
  busy,
  error,
  subjectLabel = "the agent",
  submitLabel = "Add task",
}: {
  draft: ScheduleDraft;
  onChange: (next: ScheduleDraft) => void;
  onSubmit: () => void;
  busy?: boolean;
  error?: string | null;
  subjectLabel?: string;
  submitLabel?: string;
}) {
  const canSubmit = draft.schedule.trim().length > 0 && draft.prompt.trim().length > 0 && !busy;

  const selectPreset = (presetId: string) => {
    const preset = HOSTED_SCHEDULE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onChange({
      ...draft,
      presetId,
      schedule: preset.value || draft.schedule,
    });
  };

  return (
    <div className="ah-card space-y-5 p-5">
      <CornerMarkers />
      <div className="relative space-y-1">
        <p className="ah-micro">New scheduled task</p>
      </div>

      <div className="relative space-y-2">
        <label className="ah-micro">
          What should {subjectLabel} do? <span className="text-[var(--ah-fault-300)]">*</span>
        </label>
        <textarea
          value={draft.prompt}
          onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
          placeholder="Summarize unread emails and post the highlights."
          rows={4}
          className="ah-textarea"
        />
        <p className="text-[11px] text-[var(--ah-text-faint)]">
          Describe the task you want {subjectLabel} to perform on a schedule.
        </p>
      </div>

      <div className="relative space-y-2">
        <label className="ah-micro">Task name (optional)</label>
        <input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder="Morning brief"
          className="ah-input"
        />
      </div>

      <div className="relative space-y-3">
        <label className="ah-micro">
          How often should it run? <span className="text-[var(--ah-fault-300)]">*</span>
        </label>
        <div className="grid grid-cols-2 border border-[var(--ah-border-base)] sm:grid-cols-3">
          {HOSTED_SCHEDULE_PRESETS.map((preset, index) => {
            const selected = draft.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => selectPreset(preset.id)}
                className={`${presetCellClass(index, HOSTED_SCHEDULE_PRESETS.length)} p-3 text-left transition-[background] duration-[140ms] ${
                  selected
                    ? "bg-[var(--ah-surface-hover)]"
                    : "hover:bg-[var(--ah-surface-hover)]/60"
                }`}
              >
                <CornerMarkers color={selected ? "var(--ah-accent-400)" : undefined} />
                <div className="relative space-y-1">
                  <div
                    className={`ah-mono text-xs font-semibold uppercase tracking-wider ${
                      selected ? "text-[var(--ah-accent-300)]" : ""
                    }`}
                  >
                    {preset.label}
                  </div>
                  <div className="text-[11px] text-[var(--ah-text-faint)]">{preset.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {draft.presetId === "custom" && (
          <div className="space-y-2 border border-dashed border-[var(--ah-border-base)] bg-[var(--ah-surface-overlay)]/40 p-3">
            <label className="ah-micro" htmlFor="hosted-custom-cron">
              Custom cron expression
            </label>
            <input
              id="hosted-custom-cron"
              value={draft.schedule}
              onChange={(e) => onChange({ ...draft, schedule: e.target.value })}
              placeholder="0 9 * * *"
              className="ah-input ah-mono text-xs"
            />
            <p className="text-[11px] text-[var(--ah-text-faint)]">
              Five-field cron (UTC).{" "}
              <a
                href="https://crontab.guru/"
                target="_blank"
                rel="noreferrer"
                className="ah-link"
              >
                Cron calculator
              </a>
            </p>
          </div>
        )}

        {draft.schedule && draft.presetId !== "custom" && (
          <p className="text-xs text-[var(--ah-text-muted)]">
            Selected: <code className="ah-mono text-[var(--ah-text-primary)]">{draft.schedule}</code>
            {describeHostedCron(draft.schedule) ? ` — ${describeHostedCron(draft.schedule)}` : ""}
          </p>
        )}
      </div>

      <div className="relative flex items-center justify-between gap-3">
        {error ? <p className="text-xs ah-fault">{error}</p> : <span />}
        <button type="button" className="ah-btn ah-btn-sm" disabled={!canSubmit} onClick={onSubmit}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

/** Inline edit fields for an existing schedule/routine row. */
export function ScheduleInlineEdit({
  name,
  schedule,
  prompt,
  onChange,
  onSave,
  onCancel,
  busy,
  requireName = false,
}: {
  name: string;
  schedule: string;
  prompt: string;
  onChange: (patch: { name?: string; schedule?: string; prompt?: string }) => void;
  onSave: () => void;
  onCancel: () => void;
  busy?: boolean;
  requireName?: boolean;
}) {
  const canSave =
    schedule.trim().length > 0 &&
    prompt.trim().length > 0 &&
    (!requireName || name.trim().length > 0) &&
    !busy;

  return (
    <div className="space-y-3 border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-overlay)]/30 p-3">
      <div className="space-y-1">
        <label className="ah-micro">Task name</label>
        <input
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="ah-input"
        />
      </div>
      <div className="space-y-1">
        <label className="ah-micro">Schedule</label>
        <input
          value={schedule}
          onChange={(e) => onChange({ schedule: e.target.value })}
          className="ah-input ah-mono text-xs"
        />
      </div>
      <div className="space-y-1">
        <label className="ah-micro">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          rows={4}
          className="ah-textarea"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="ah-btn ah-btn-sm" disabled={!canSave} onClick={onSave}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="ah-btn ah-btn-outline ah-btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Simple multi-routine editor used in the persona add/edit forms. */
export function RoutineListEditor({
  routines,
  onChange,
}: {
  routines: HostedBotRoutine[];
  onChange: (routines: HostedBotRoutine[]) => void;
}) {
  const update = (index: number, patch: Partial<HostedBotRoutine>) => {
    const next = [...routines];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="ah-micro">Scheduled routines</p>
        <button
          type="button"
          className="ah-link text-[11px]"
          onClick={() =>
            onChange([...routines, { name: "", schedule: "0 9 * * *", prompt: "" }])
          }
        >
          Add routine
        </button>
      </div>
      {routines.length === 0 ? (
        <p className="text-xs text-[var(--ah-text-faint)]">
          No routines. Add cron-driven work for this bot if needed.
        </p>
      ) : (
        routines.map((routine, index) => (
          <div
            key={`${index}-${routine.name}`}
            className="space-y-2 border border-[var(--ah-border-subtle)] p-3"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={routine.name}
                onChange={(e) => update(index, { name: e.target.value })}
                placeholder="Daily triage"
                className="ah-input"
              />
              <input
                value={routine.schedule}
                onChange={(e) => update(index, { schedule: e.target.value })}
                placeholder="0 9 * * *"
                className="ah-input ah-mono text-xs"
              />
            </div>
            <textarea
              value={routine.prompt}
              onChange={(e) => update(index, { prompt: e.target.value })}
              placeholder="Review the support inbox and report urgent items…"
              rows={3}
              className="ah-textarea"
            />
            <button
              type="button"
              className="ah-link ah-fault text-[11px]"
              onClick={() => onChange(routines.filter((_, i) => i !== index))}
            >
              Remove routine
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export function useScheduleDraft(initialPreset = "daily-morning") {
  const [draft, setDraft] = useState(() => emptyScheduleDraft(initialPreset));
  const reset = () => setDraft(emptyScheduleDraft(initialPreset));
  return { draft, setDraft, reset };
}
