import { useEffect, useState } from "react";
import {
  applyHostedBotTemplate,
  createHostedBot,
  deleteHostedBot,
  describeHostedCron,
  updateHostedBot,
  type HostedBot,
  type HostedBotRoutine,
  type HostedBotTeamTemplate,
  type HostedSession,
} from "@/lib/agenthosting/client";
import { BlobAvatar, effectiveBotAvatar } from "./andromeda/BlobAvatar";
import { CornerMarkers } from "./andromeda/CornerMarkers";
import { StatusBadge } from "./andromeda/StatusBadge";
import { cleanRoutines, RoutineListEditor } from "./andromeda/ScheduleEditor";

function slugifyBotName(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  if (/^[a-z][a-z0-9-]{1,31}$/.test(base)) return base;
  return `bot-${base.replace(/[^a-z0-9-]/g, "").slice(0, 28) || "agent"}`;
}

type PersonaDraft = {
  name: string;
  title: string;
  description: string;
  soul: string;
  avatar: string;
  routines: HostedBotRoutine[];
};

function emptyDraft(): PersonaDraft {
  return {
    name: "",
    title: "",
    description: "",
    soul: "",
    avatar: "",
    routines: [],
  };
}

function draftFromBot(bot: HostedBot): PersonaDraft {
  return {
    name: bot.name,
    title: bot.title,
    description: bot.description ?? "",
    soul: bot.soul ?? "",
    avatar: bot.avatar?.imageUrl ?? "",
    routines: bot.routines ?? [],
  };
}

/** In-app bot persona library — list, add, and edit identity/soul/avatar/routines. */
export function PersonaLibrary({
  session,
  agentId,
  bots,
  maxBots,
  templates,
  onRefresh,
  onError,
  onChat,
}: {
  session: HostedSession;
  agentId: string;
  bots: HostedBot[];
  maxBots: number;
  templates: HostedBotTeamTemplate[];
  onRefresh: () => Promise<void>;
  onError: (message: string | null) => void;
  onChat: (botName: string) => void;
}) {
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [draft, setDraft] = useState<PersonaDraft>(() => emptyDraft());
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);

  const editingBot = editingName ? bots.find((b) => b.name === editingName) ?? null : null;

  useEffect(() => {
    if (mode === "edit" && editingName && !bots.some((b) => b.name === editingName)) {
      setMode("list");
      setEditingName(null);
    }
  }, [bots, editingName, mode]);

  const openAdd = () => {
    setDraft(emptyDraft());
    setFormError(null);
    setMode("add");
  };

  const openEdit = (bot: HostedBot) => {
    setEditingName(bot.name);
    setDraft(draftFromBot(bot));
    setFormError(null);
    setMode("edit");
  };

  const closeEditor = () => {
    setMode("list");
    setEditingName(null);
    setDraft(emptyDraft());
    setFormError(null);
  };

  const saveAdd = async () => {
    const title = draft.title.trim();
    const name = (draft.name.trim() || slugifyBotName(title)).toLowerCase();
    if (!title || !name) return;
    setBusy(true);
    setFormError(null);
    onError(null);
    try {
      await createHostedBot(session, agentId, {
        name,
        title,
        description: draft.description.trim() || undefined,
        soul: draft.soul.trim() || undefined,
        avatar: draft.avatar.trim() ? { imageUrl: draft.avatar.trim() } : undefined,
        routines: cleanRoutines(draft.routines),
      });
      await onRefresh();
      closeEditor();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editingBot) return;
    const title = draft.title.trim();
    if (!title) return;
    setBusy(true);
    setFormError(null);
    onError(null);
    try {
      await updateHostedBot(session, agentId, editingBot.name, {
        title,
        description: draft.description.trim() || null,
        soul: draft.soul.trim() || null,
        avatar: draft.avatar.trim() ? { imageUrl: draft.avatar.trim() } : null,
        routines: cleanRoutines(draft.routines),
      });
      await onRefresh();
      closeEditor();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message);
      onError(message);
    } finally {
      setBusy(false);
    }
  };

  const removeBot = async (name: string) => {
    setBusy(true);
    onError(null);
    try {
      await deleteHostedBot(session, agentId, name);
      await onRefresh();
      if (editingName === name) closeEditor();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const applyTemplate = async (templateId: string) => {
    setApplyingTemplateId(templateId);
    onError(null);
    try {
      await applyHostedBotTemplate(session, agentId, templateId);
      await onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplyingTemplateId(null);
    }
  };

  if (mode === "add" || mode === "edit") {
    const seed = `${agentId}/${draft.name.trim() || editingBot?.name || "new-bot"}`;
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <button type="button" className="ah-link text-xs" onClick={closeEditor}>
              ← Back to bots
            </button>
            <h2 className="ah-page-title text-lg sm:text-xl">
              {mode === "add" ? "Add a bot" : `Edit ${editingBot?.title ?? "bot"}`}
            </h2>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="ah-card space-y-4 p-4">
            <CornerMarkers />
            <p className="ah-micro relative">Identity</p>
            {mode === "add" && (
              <div className="relative space-y-1">
                <label className="ah-micro">Bot name</label>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="support-faq"
                  className="ah-input ah-mono text-xs"
                />
                <p className="text-[11px] text-[var(--ah-text-faint)]">
                  Lowercase letters, digits, and hyphens. Becomes the hermes profile and browser
                  profile name. Leave blank to derive from the title.
                </p>
              </div>
            )}
            <div className="relative space-y-1">
              <label className="ah-micro">Title</label>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="FAQ Bot"
                className="ah-input"
              />
            </div>
            <div className="relative space-y-1">
              <label className="ah-micro">Description</label>
              <input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Answers repeat questions from the docs."
                className="ah-input"
              />
            </div>
            <div className="relative space-y-2">
              <label className="ah-micro">Avatar (URL or data URI)</label>
              <div className="flex items-center gap-3">
                <BlobAvatar
                  seed={seed}
                  src={draft.avatar.trim() || null}
                  label={draft.title.trim() || "B"}
                  size={36}
                />
                <input
                  value={draft.avatar}
                  onChange={(e) => setDraft({ ...draft, avatar: e.target.value })}
                  placeholder="https://… or data:image/… (optional)"
                  className="ah-input min-w-0 flex-1"
                />
              </div>
              <p className="text-[11px] text-[var(--ah-text-faint)]">
                Optional. Without one, every bot gets a stable generated blob from its name.
              </p>
            </div>
          </div>

          <div className="ah-card space-y-4 p-4">
            <CornerMarkers />
            <div className="relative space-y-1">
              <label className="ah-micro">Persona / standing instructions</label>
              <textarea
                value={draft.soul}
                onChange={(e) => setDraft({ ...draft, soul: e.target.value })}
                rows={12}
                placeholder="You are the FAQ Bot. Ground every answer in the company docs…"
                className="ah-textarea"
              />
            </div>
            <div className="relative">
              <RoutineListEditor
                routines={draft.routines}
                onChange={(routines) => setDraft({ ...draft, routines })}
              />
            </div>
          </div>
        </div>

        {formError ? <p className="text-sm ah-fault">{formError}</p> : null}

        <div className="flex justify-end gap-2 border-t border-[var(--ah-border-subtle)] pt-4">
          <button type="button" className="ah-btn ah-btn-outline" onClick={closeEditor}>
            Cancel
          </button>
          <button
            type="button"
            className="ah-btn"
            disabled={busy || !draft.title.trim()}
            onClick={() => void (mode === "add" ? saveAdd() : saveEdit())}
          >
            {busy ? "Saving…" : mode === "add" ? "Add bot" : "Save bot"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h2 className="ah-page-title text-lg sm:text-xl">
            Bots ({bots.length}/{maxBots})
          </h2>
          <p className="text-sm text-[var(--ah-text-secondary)]">
            Each bot has its own memory, persona, and browser profile. Edit personas in-app; setting
            changes apply instantly.
          </p>
        </div>
        <button
          type="button"
          className="ah-btn ah-btn-sm"
          disabled={bots.length >= maxBots || busy}
          onClick={openAdd}
        >
          Add bot
        </button>
      </div>

      <ul className="space-y-2">
        {bots.length === 0 ? (
          <li className="ah-card p-6 text-center text-sm text-[var(--ah-text-secondary)]">
            <CornerMarkers />
            <p className="relative">No bots yet. Start from a team template below, or add a single bot.</p>
          </li>
        ) : (
          bots.map((bot) => (
            <li key={bot.name} className="ah-card p-3">
              <CornerMarkers />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <BlobAvatar
                    seed={`${agentId}/${bot.name}`}
                    src={effectiveBotAvatar(bot)}
                    label={bot.title || bot.name}
                    size={40}
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="ah-mono text-sm font-medium uppercase tracking-wider">
                        {bot.title}
                      </div>
                      <span className="ah-mono text-[10px] uppercase tracking-wider text-[var(--ah-text-faint)]">
                        {bot.name}
                      </span>
                      {bot.profileReady ? (
                        <StatusBadge variant="accent" label="Profile live" />
                      ) : null}
                      {bot.templateId ? (
                        <StatusBadge variant="subtle" label="From template" />
                      ) : null}
                    </div>
                    {bot.description ? (
                      <p className="text-xs text-[var(--ah-text-secondary)]">{bot.description}</p>
                    ) : null}
                    {bot.soul ? (
                      <p className="line-clamp-2 text-[11px] text-[var(--ah-text-muted)]">
                        {bot.soul}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-[var(--ah-text-faint)]">
                      <span>Own browser profile</span>
                      {(bot.routines?.length ?? 0) > 0 ? (
                        <span>
                          {bot.routines.length} routine{bot.routines.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                    {(bot.routines?.length ?? 0) > 0 && (
                      <div className="space-y-0.5 pt-1">
                        {bot.routines.map((routine) => (
                          <p key={routine.name} className="text-[11px] text-[var(--ah-text-muted)]">
                            <code className="border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-overlay)] px-1">
                              {routine.schedule}
                            </code>{" "}
                            {routine.name}
                            {describeHostedCron(routine.schedule)
                              ? ` · ${describeHostedCron(routine.schedule)}`
                              : ""}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 text-xs">
                  <button type="button" className="ah-link" onClick={() => onChat(bot.name)}>
                    Chat
                  </button>
                  <button type="button" className="ah-link" onClick={() => openEdit(bot)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="ah-link ah-fault"
                    disabled={busy}
                    onClick={() => void removeBot(bot.name)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="ah-card space-y-3 p-3">
        <CornerMarkers />
        <div className="relative space-y-1">
          <p className="ah-micro">Bot team templates</p>
          <p className="text-xs text-[var(--ah-text-secondary)]">
            Preset teams for common scenarios. Applying adds missing bots (up to your limit) with
            personas and routines ready to edit.
          </p>
        </div>
        {templates.length === 0 ? (
          <p className="relative text-xs text-[var(--ah-text-faint)]">
            No templates available from the API yet.
          </p>
        ) : (
          <div className="relative grid gap-2 md:grid-cols-2">
            {templates.map((template) => (
              <div key={template.id} className="border border-[var(--ah-border-base)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="ah-mono text-xs font-semibold uppercase tracking-wider">
                      {template.name}
                    </p>
                    <p className="text-xs text-[var(--ah-text-secondary)]">
                      {template.scenario || template.description}
                    </p>
                    <p className="text-[11px] text-[var(--ah-text-faint)]">
                      {template.bots.map((b) => b.title).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ah-btn ah-btn-outline ah-btn-sm shrink-0"
                    disabled={
                      applyingTemplateId !== null || bots.length >= maxBots || busy
                    }
                    onClick={() => void applyTemplate(template.id)}
                  >
                    {applyingTemplateId === template.id ? "Applying…" : "Apply"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const HostedPersonaLibrary = PersonaLibrary;
