import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import RFB from "@novnc/novnc";
import {
  Bot,
  CalendarClock,
  ClipboardPaste,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  MessagesSquare,
  Minimize2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  createHostedChatSession,
  deleteHostedChatSession,
  describeHostedCron,
  getHostedAgent,
  getHostedChatroomState,
  getHostedChatSession,
  hostedChatroomAgentId,
  hostedChatroomBotId,
  listHostedBots,
  listHostedBotTemplates,
  listHostedChatSessions,
  listHostedModels,
  listHostedSchedules,
  mintOpenComputerSession,
  openComputerDesktopWsUrl,
  openComputerSurface,
  pauseHostedSchedule,
  readHostedSession,
  removeHostedSchedule,
  resumeHostedSchedule,
  roomBelongsToAgent,
  runHostedSchedule,
  stopHostedChat,
  streamHostedChat,
  type HostedAgent,
  type HostedBot,
  type HostedBotTeamTemplate,
  type HostedChatroomRoom,
  type HostedChatroomState,
  type HostedChatSession,
  type HostedModelOption,
  type HostedSchedule,
  type HostedSession,
} from "@/lib/agenthosting/client";
import { useDesktopCapabilities } from "@/components/DesktopCapabilities";
import { AndromedaShell } from "./andromeda/Shell";
import { SidebarHeader } from "./andromeda/SidebarHeader";
import { BlobAvatar, effectiveBotAvatar } from "./andromeda/BlobAvatar";
import { StatusBadge } from "./andromeda/StatusBadge";
import { useDesktopPaste } from "@/lib/agenthosting/use-desktop-paste";
import {
  buildTeachTaskPrompt,
  type TaughtTaskDemonstration,
} from "@/lib/agenthosting/teach-a-task";
import { HostedChatroom } from "./HostedChatroom";
import { HostedMarkdown } from "./HostedMarkdown";
import { HostedPersonaLibrary } from "./HostedPersonaLibrary";
import { HostedPromptBar, filesToHostedAttachments, type PromptBarSendPayload } from "./HostedPromptBar";
import { HostedSchedulePanel } from "./HostedSchedulePanel";
import { HostedTeachTask } from "./HostedTeachTask";
import { fuzzySearch } from "./hosted-chat-search";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Array<{
    filename?: string;
    contentType?: string;
    base64: string;
  }>;
};

type MainView = "chat" | "chatroom" | "bots" | "schedule";

function sessionTitle(session: HostedChatSession): string {
  if (session.title?.trim()) return session.title.trim();
  if (session.sourceLabel?.trim()) return session.sourceLabel.trim();
  return `Chat ${session.id.slice(0, 8)}`;
}

function isTelegramSession(session: HostedChatSession | null | undefined): boolean {
  const source = `${session?.source ?? ""} ${session?.sourceLabel ?? ""}`.toLowerCase();
  return source.includes("telegram");
}

function ChatAttachmentPreview({
  attachments,
}: {
  attachments?: ChatMessage["attachments"];
}) {
  if (!attachments?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((attachment, index) => {
        const contentType = attachment.contentType || "application/octet-stream";
        const url = `data:${contentType};base64,${attachment.base64}`;
        const label = attachment.filename || `Attachment ${index + 1}`;
        return contentType.startsWith("image/") ? (
          <a
            key={`${label}-${index}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="group block overflow-hidden rounded border border-[var(--ah-border-base)] bg-[var(--ah-surface-base)]"
            title={`Open ${label}`}
          >
            <img
              src={url}
              alt={label}
              className="max-h-64 max-w-[min(24rem,70vw)] object-contain transition-opacity group-hover:opacity-80"
            />
          </a>
        ) : (
          <a
            key={`${label}-${index}`}
            href={url}
            download={label}
            target="_blank"
            rel="noreferrer"
            className="ah-link text-xs"
          >
            Open {label}
          </a>
        );
      })}
    </div>
  );
}

function OpenComputerPreview({
  session,
  agent,
  macInset,
  winCaption,
  fullscreen,
  onToggleFullscreen,
  teachDisabled,
  onTeachTask,
}: {
  session: HostedSession;
  agent: HostedAgent;
  macInset: boolean;
  winCaption: boolean;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  teachDisabled?: boolean;
  onTeachTask: (demo: TaughtTaskDemonstration) => void | Promise<void>;
}) {
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const rfbRef = useRef<RFB | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "open" | "closed" | "missing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pasteBoxOpen, setPasteBoxOpen] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");
  const {
    typing: pasteTyping,
    status: pasteStatus,
    typeIntoDesktop,
    pasteFromClipboard,
  } = useDesktopPaste({
    rfbRef,
    hostRef: desktopRef,
    enabled: status === "open",
    onNeedPasteBox: () => setPasteBoxOpen(true),
  });

  const connect = useCallback(async () => {
    const surface = openComputerSurface(agent);
    if (!surface?.surfaceId) {
      setStatus("missing");
      return;
    }
    setStatus("connecting");
    setError(null);
    try {
      const { url } = await mintOpenComputerSession(session, surface.surfaceId);
      const desktopWsUrl = openComputerDesktopWsUrl(session, url);
      if (!desktopRef.current) return;
      rfbRef.current?.disconnect();
      desktopRef.current.innerHTML = "";
      const rfb = new RFB(desktopRef.current, desktopWsUrl, { credentials: {} });
      rfb.scaleViewport = true;
      rfb.resizeSession = false;
      rfb.background = "#0E0E0F";
      rfb.viewOnly = false;
      rfb.addEventListener("connect", () => setStatus("open"));
      rfb.addEventListener("disconnect", () => setStatus("closed"));
      rfbRef.current = rfb;
    } catch (err) {
      setStatus("closed");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [agent, session]);

  useEffect(() => {
    void connect();
    return () => {
      try {
        rfbRef.current?.disconnect();
      } catch {
        // ignore
      }
      rfbRef.current = null;
    };
  }, [connect]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onToggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, onToggleFullscreen]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => cancelAnimationFrame(id);
  }, [fullscreen]);

  if (status === "missing") {
    return (
      <div className="flex shrink-0 flex-col items-center justify-center gap-2 px-3 py-4 text-center text-xs text-[var(--ah-text-secondary)]">
        <p>Open Computer is not enabled for this agent.</p>
        <button
          type="button"
          className="ah-link"
          onClick={() =>
            void window.ogb?.openExternal?.(
              `${session.dashboardURL}/agents/${encodeURIComponent(agent.id)}/computer`,
            )
          }
        >
          Enable it on the dashboard
        </button>
      </div>
    );
  }

  const linkBadge =
    status === "open"
      ? { variant: "accent" as const, label: "Connected" }
      : status === "connecting"
        ? { variant: "warning" as const, label: "Connecting" }
        : { variant: "subtle" as const, label: "Disconnected" };

  const chromeNoDrag = macInset || winCaption
    ? ({ WebkitAppRegion: "no-drag" } as CSSProperties)
    : undefined;
  // Fullscreen covers the whole window, so clear mac traffic lights / win caption.
  // Docked right panel only needs the Windows caption inset.
  const headerChromeClass = fullscreen
    ? macInset
      ? "pt-2"
      : winCaption
        ? "pt-[28px]"
        : ""
    : winCaption
      ? "pt-[28px]"
      : "";

  return (
    <div
      className={`flex flex-col bg-[var(--ah-surface-base)] ${
        fullscreen ? "min-h-0 flex-1" : "shrink-0"
      }`}
      style={chromeNoDrag}
    >
      <div
        className={`relative z-10 shrink-0 border-b border-[var(--ah-border-subtle)] ${headerChromeClass}`}
        style={chromeNoDrag}
      >
        <div className="flex items-center gap-2 px-3 py-1.5">
          {macInset && fullscreen ? <div className="w-14 shrink-0" aria-hidden /> : null}
          <span className="ah-micro shrink-0">{fullscreen ? "Open Computer" : "Desktop"}</span>
          <StatusBadge variant={linkBadge.variant} label={linkBadge.label} />
        </div>
        <div className="flex flex-wrap items-center gap-1 px-3 pb-2" style={chromeNoDrag}>
          {macInset && fullscreen ? <div className="w-14 shrink-0" aria-hidden /> : null}
          <button
            type="button"
            className="ah-btn ah-btn-ghost ah-btn-sm px-2"
            style={chromeNoDrag}
            onClick={() => setPasteBoxOpen((open) => !open)}
            aria-pressed={pasteBoxOpen}
            aria-label={pasteTyping ? "Typing into desktop" : "Paste into desktop"}
            disabled={status !== "open" || pasteTyping}
            title="Paste into desktop"
          >
            {pasteTyping ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ClipboardPaste size={15} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="ah-btn ah-btn-ghost ah-btn-sm px-2"
            style={chromeNoDrag}
            onClick={onToggleFullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="ah-btn ah-btn-ghost ah-btn-sm px-2"
            style={chromeNoDrag}
            onClick={() => void connect()}
            aria-label="Reconnect desktop"
            title="Reconnect desktop"
          >
            <RefreshCw size={15} aria-hidden="true" />
          </button>
          <HostedTeachTask
            desktopRef={desktopRef}
            connected={status === "open"}
            disabled={teachDisabled}
            onStart={() => {
              if (!fullscreen) onToggleFullscreen();
            }}
            onComplete={onTeachTask}
          />
        </div>
      </div>
      {error && <div className="relative z-10 px-3 py-1.5 text-[11px] ah-fault">{error}</div>}
      {pasteBoxOpen ? (
        <div
          className="relative z-10 space-y-2 border-b border-[var(--ah-border-subtle)] px-3 py-2"
          style={chromeNoDrag}
        >
          <p className="text-[11px] text-[var(--ah-text-faint)]">
            Focus a field on the desktop, then type from your clipboard or this box. ⌘V / Ctrl+V also
            works when the desktop is focused.
          </p>
          <textarea
            className="ah-textarea min-h-[4.5rem] w-full resize-y text-xs"
            value={pasteDraft}
            onChange={(event) => setPasteDraft(event.target.value)}
            placeholder="Email, password, OTP…"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="ah-btn ah-btn-outline ah-btn-sm"
              disabled={pasteTyping || !pasteDraft || status !== "open"}
              onClick={() => {
                void typeIntoDesktop(pasteDraft).then((ok) => {
                  if (ok) setPasteDraft("");
                });
              }}
            >
              Type into desktop
            </button>
            <button
              type="button"
              className="ah-btn ah-btn-ghost ah-btn-sm"
              disabled={pasteTyping || status !== "open"}
              onClick={() => void pasteFromClipboard()}
            >
              Use clipboard
            </button>
          </div>
          {pasteStatus ? (
            <p className="text-[11px] text-[var(--ah-text-faint)]">{pasteStatus}</p>
          ) : null}
        </div>
      ) : null}
      <div
        ref={desktopRef}
        className={
          fullscreen
            ? "relative z-0 min-h-0 flex-1 overflow-hidden bg-[#0E0E0F]"
            : "relative z-0 h-[148px] overflow-hidden border-b border-[var(--ah-border-subtle)] bg-[#0E0E0F] sm:h-[168px]"
        }
      />
    </div>
  );
}

function ComputerScheduleList({
  schedules,
  onOpenSchedule,
  onRun,
  onToggle,
  onDelete,
}: {
  schedules: HostedSchedule[];
  onOpenSchedule: () => void;
  onRun: (jobId: string) => void;
  onToggle: (job: HostedSchedule) => void;
  onDelete: (jobId: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ah-sidebar)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--ah-border-subtle)] px-3 py-2.5">
        <p className="ah-micro">Schedule</p>
        <button type="button" className="ah-link text-[11px]" onClick={onOpenSchedule}>
          Manage
        </button>
      </div>
      <ul className="min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-y-contain">
        {schedules.length === 0 ? (
          <li className="px-3 py-4 text-xs text-[var(--ah-text-faint)]">
            No scheduled jobs yet.{" "}
            <button type="button" className="ah-link" onClick={onOpenSchedule}>
              Add one
            </button>
          </li>
        ) : (
          schedules.map((job) => (
            <li
              key={job.id}
              className="border-b border-[var(--ah-border-subtle)] px-3 py-2.5 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="ah-mono truncate text-[11px] font-semibold uppercase tracking-wider">
                    {job.name || job.id.slice(0, 8)}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--ah-text-muted)]">
                    <StatusBadge
                      variant={job.enabled ? "accent" : "subtle"}
                      label={job.enabled ? "Active" : "Paused"}
                    />
                    <span>
                      {describeHostedCron(job.schedule) || job.schedule}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[11px] text-[var(--ah-text-secondary)]">
                    {job.prompt}
                  </p>
                  {job.nextRun ? (
                    <p className="text-[10px] text-[var(--ah-text-faint)]">
                      Next {new Date(job.nextRun).toLocaleString()}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5 text-[10px]">
                  <button type="button" className="ah-schedule-action" onClick={() => onRun(job.id)}>
                    Run
                  </button>
                  <button type="button" className="ah-schedule-action" onClick={() => onToggle(job)}>
                    {job.enabled ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    className="ah-schedule-action ah-fault"
                    onClick={() => onDelete(job.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** Hosted AgentHosting shell with sessions, bots, schedule, and Open Computer. */
export function HostedApp({
  agentId,
  onChangeAgent,
}: {
  agentId: string;
  onChangeAgent: () => void;
}) {
  const [session, setSession] = useState<HostedSession | null>(null);
  const [agent, setAgent] = useState<HostedAgent | null>(null);
  const [view, setView] = useState<MainView>("chat");
  const [showComputer, setShowComputer] = useState(true);
  const [computerFullscreen, setComputerFullscreen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatSearch, setChatSearch] = useState("");

  const [chatSessions, setChatSessions] = useState<HostedChatSession[]>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [activeSessionMeta, setActiveSessionMeta] = useState<HostedChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [activeBot, setActiveBot] = useState<string | null>(null);
  const [pickingTarget, setPickingTarget] = useState(false);
  const [pickedTargets, setPickedTargets] = useState<Set<string>>(() => new Set());
  const [models, setModels] = useState<HostedModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [effort, setEffort] = useState("Medium");

  const [bots, setBots] = useState<HostedBot[]>([]);
  const [maxBots, setMaxBots] = useState(6);
  const [templates, setTemplates] = useState<HostedBotTeamTemplate[]>([]);

  const [schedules, setSchedules] = useState<HostedSchedule[]>([]);
  const [chatroomState, setChatroomState] = useState<HostedChatroomState | null>(null);
  const [chatroomRooms, setChatroomRooms] = useState<HostedChatroomRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [chatroomSeedIds, setChatroomSeedIds] = useState<string[] | null>(null);
  const [chatroomKey, setChatroomKey] = useState(0);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const { capabilities } = useDesktopCapabilities();
  const macInset = capabilities.windowChrome === "mac-inset";
  const winCaption = capabilities.windowChrome === "win-caption";
  const draggableChrome = macInset || winCaption;
  const windowDragStyle = draggableChrome
    ? ({ WebkitAppRegion: "drag" } as CSSProperties)
    : undefined;
  const windowNoDragStyle = draggableChrome
    ? ({ WebkitAppRegion: "no-drag" } as CSSProperties)
    : undefined;

  const refreshSessions = useCallback(
    async (auth: HostedSession, id: string) => {
      const list = await listHostedChatSessions(auth, id);
      setChatSessions(list);
      return list;
    },
    [],
  );

  const refreshBots = useCallback(async (auth: HostedSession, id: string) => {
    const result = await listHostedBots(auth, id);
    setBots(
      result.bots.map((bot) => ({
        ...bot,
        routines: bot.routines ?? [],
      })),
    );
    setMaxBots(result.maxBots);
    return result;
  }, []);

  const refreshTemplates = useCallback(async (auth: HostedSession) => {
    const list = await listHostedBotTemplates(auth);
    setTemplates(list);
    return list;
  }, []);

  const refreshSchedules = useCallback(async (auth: HostedSession, id: string) => {
    const list = await listHostedSchedules(auth, id);
    setSchedules(list);
    return list;
  }, []);

  const loadChat = useCallback(async (auth: HostedSession, id: string, sessionId: string) => {
    const detail = await getHostedChatSession(auth, id, sessionId);
    setChatSessionId(detail.session.id);
    setActiveSessionMeta(detail.session);
    setMessages(
      detail.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      })),
    );
    setView("chat");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const nextSession = await readHostedSession();
        if (!nextSession || cancelled) return;
        setSession(nextSession);
        const nextAgent = await getHostedAgent(nextSession, agentId);
        if (cancelled) return;
        setAgent(nextAgent);
        const modelList = await listHostedModels(nextSession, nextAgent).catch(() => [] as HostedModelOption[]);
        if (cancelled) return;
        setModels(modelList);
        const current =
          nextAgent.modelName?.trim() ||
          nextAgent.config?.modelName?.trim() ||
          modelList[0]?.key ||
          "";
        setSelectedModel(current);
        const [sessions, , , , chatroom] = await Promise.all([
          refreshSessions(nextSession, agentId),
          refreshBots(nextSession, agentId).catch(() => null),
          refreshSchedules(nextSession, agentId).catch(() => null),
          refreshTemplates(nextSession).catch(() => null),
          getHostedChatroomState(nextSession).catch(() => null),
        ]);
        if (cancelled) return;
        if (chatroom) {
          setChatroomState(chatroom);
          const ours = (chatroom.rooms ?? []).filter((room) => roomBelongsToAgent(room, agentId));
          setChatroomRooms(ours);
          if (chatroom.activeRoomId && ours.some((r) => r.id === chatroom.activeRoomId)) {
            setActiveRoomId(chatroom.activeRoomId);
          }
        }
        if (sessions[0]) await loadChat(nextSession, agentId, sessions[0].id);
        else setPickingTarget(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, loadChat, refreshBots, refreshSchedules, refreshSessions, refreshTemplates]);

  useEffect(() => {
    const node = chatScrollRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [chatSessionId, view, messages.length, messages.at(-1)?.content]);

  const beginNewChat = () => {
    abortRef.current?.();
    setStreaming(false);
    setChatSessionId(null);
    setActiveSessionMeta(null);
    setMessages([]);
    setActiveBot(null);
    setPickedTargets(new Set());
    setPickingTarget(true);
    setChatroomSeedIds(null);
    setView("chat");
    setError(null);
    setStatus(null);
  };

  const togglePickedTarget = (id: string) => {
    setPickedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startChatWithTarget = async (botName: string | null) => {
    if (!session || !agent) return;
    // Already on this target — keep the current transcript.
    if (view === "chat" && !pickingTarget && activeBot === botName && chatSessionId) {
      setView("chat");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      abortRef.current?.();
      setStreaming(false);
      const created = await createHostedChatSession(session, agent.id, { forceNew: true });
      await refreshSessions(session, agent.id);
      setChatSessionId(created.id);
      setActiveSessionMeta(created);
      setMessages([]);
      setActiveBot(botName);
      setPickedTargets(new Set());
      setPickingTarget(false);
      setView("chat");
      const bot = botName ? bots.find((b) => b.name === botName) : null;
      const botModel = bot?.modelName?.trim();
      if (botModel) setSelectedModel(botModel);
      else {
        const agentModel =
          agent.modelName?.trim() || agent.config?.modelName?.trim() || models[0]?.key || "";
        if (agentModel) setSelectedModel(agentModel);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const openChatroomWithSelection = (selectedIds: string[]) => {
    if (selectedIds.length < 2) return;
    setPickingTarget(false);
    setPickedTargets(new Set());
    setChatroomSeedIds(selectedIds);
    setActiveRoomId(null);
    setChatroomKey((k) => k + 1);
    setView("chatroom");
    setError(null);
    setStatus(null);
  };

  const openExistingRoom = (roomId: string) => {
    setPickingTarget(false);
    setChatroomSeedIds(null);
    setActiveRoomId(roomId);
    setChatroomKey((k) => k + 1);
    setView("chatroom");
  };

  const selectChat = async (id: string) => {
    if (!session || !agent) return;
    setBusy(true);
    setError(null);
    try {
      await loadChat(session, agent.id, id);
      setActiveBot(null);
      setPickingTarget(false);
      setChatroomSeedIds(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const removeChat = async (id: string) => {
    if (!session || !agent) return;
    setBusy(true);
    try {
      await deleteHostedChatSession(session, agent.id, id);
      const list = await refreshSessions(session, agent.id);
      if (chatSessionId === id) {
        if (list[0]) await loadChat(session, agent.id, list[0].id);
        else {
          setChatSessionId(null);
          setActiveSessionMeta(null);
          setMessages([]);
          setPickingTarget(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const send = async (
    textRaw: string,
    payload: PromptBarSendPayload,
    overrides?: {
      sessionId: string;
      context: "computer";
      replaceMessages?: boolean;
      bot?: string;
    },
  ) => {
    const currentSession = activeSessionMeta ?? chatSessions.find((item) => item.id === chatSessionId);
    if (!session || !agent || streaming || isTelegramSession(currentSession)) return false;
    let attachments;
    try {
      attachments = await filesToHostedAttachments(payload.attachments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
    const text = textRaw.trim() || (attachments.length ? "Uploaded attachment(s)" : "");
    if (!text) return false;

    const modelKey = payload.model?.key?.trim() || selectedModel.trim() || undefined;
    if (payload.model?.key) setSelectedModel(payload.model.key);

    setError(null);
    setStatus(payload.effort !== "Medium" ? `Effort · ${payload.effort}` : null);
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      attachments,
    };
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...(overrides?.replaceMessages ? [] : prev),
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setStreaming(true);
    setPickingTarget(false);
    abortRef.current = await streamHostedChat(
      session,
      agent.id,
      text,
      overrides?.sessionId ?? chatSessionId,
      {
        onChunk: (chunk) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m)),
          );
        },
        onStatus: setStatus,
        onDone: (id) => {
          if (id) {
            setChatSessionId(id);
            void refreshSessions(session, agent.id);
          }
          setStreaming(false);
          setStatus(null);
        },
        onError: (err) => {
          setError(
            /(?:\b413\b|payload too large|request entity too large)/i.test(err)
              ? "That upload is still too large for the chat proxy. Try a smaller image or fewer attachments."
              : err,
          );
          setStreaming(false);
          setStatus(null);
        },
        onTool: (event) => {
          if (event.message) setStatus(event.message);
          else if (event.toolName) setStatus(`${event.type}: ${event.toolName}`);
        },
      },
      {
        context: overrides?.context ?? (showComputer && view === "chat" ? "computer" : undefined),
        bot: overrides ? overrides.bot : activeBot ?? undefined,
        model: modelKey,
        effort: payload.effort,
        attachments,
      },
    );
    return true;
  };

  const teachTask = async (demo: TaughtTaskDemonstration) => {
    if (!session || !agent || streaming || busy) {
      throw new Error("Wait for the current chat to finish, then create the skill.");
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createHostedChatSession(session, agent.id, {
        context: "computer",
        forceNew: true,
      });
      setChatSessionId(created.id);
      setActiveSessionMeta(created);
      setActiveBot(null);
      setPickingTarget(false);
      setView("chat");
      setComputerFullscreen(false);
      const sent = await send(
        buildTeachTaskPrompt(demo),
        {
          attachments: demo.screenshots,
          model: selectedModel
            ? { key: selectedModel, name: selectedModel }
            : undefined,
          effort: "High",
        },
        {
          sessionId: created.id,
          context: "computer",
          replaceMessages: true,
        },
      );
      if (!sent) throw new Error("Could not send the teaching demonstration.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const stop = () => {
    abortRef.current?.();
    abortRef.current = null;
    setStreaming(false);
    setStatus(null);
    if (session && agent && chatSessionId) {
      void stopHostedChat(session, agent.id, chatSessionId).catch(() => {
        // Abort already stopped the stream client-side.
      });
    }
  };

  const refreshLibrary = useCallback(async () => {
    if (!session || !agent) return;
    await Promise.all([
      refreshBots(session, agent.id),
      refreshSchedules(session, agent.id),
      refreshTemplates(session),
    ]);
  }, [session, agent, refreshBots, refreshSchedules, refreshTemplates]);

  useEffect(() => () => abortRef.current?.(), []);

  const sortedSessions = useMemo(
    () =>
      [...chatSessions].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [chatSessions],
  );
  const matchingSessions = useMemo(
    () => fuzzySearch(sortedSessions, chatSearch, sessionTitle),
    [chatSearch, sortedSessions],
  );

  if (!session || !agent) {
    return (
      <AndromedaShell className="items-center justify-center text-sm text-[var(--ah-text-secondary)]">
        {error ?? (
          <span>
            Loading agent<span className="blink-cursor" />
          </span>
        )}
      </AndromedaShell>
    );
  }

  const headerTitle = pickingTarget
    ? "New chat"
    : view === "chatroom"
      ? chatroomRooms.find((r) => r.id === activeRoomId)?.name || "Chatroom"
      : activeBot
        ? bots.find((b) => b.name === activeBot)?.title || activeBot
        : chatSessionId
          ? sessionTitle(
              sortedSessions.find((s) => s.id === chatSessionId) ?? {
                id: chatSessionId,
                agentId: agent.id,
                title: null,
                createdAt: "",
                updatedAt: "",
              },
            )
          : "New chat";

  const modelLabel =
    selectedModel ||
    agent.modelName ||
    agent.config?.modelName ||
    "Default model";

  const computerAvailable = Boolean(openComputerSurface(agent));
  const agentParticipantId = hostedChatroomAgentId(agent.id);
  const pickedCount = pickedTargets.size;
  const canOpenChatroom = pickedCount >= 2;
  const activeChatSession = activeSessionMeta ?? sortedSessions.find((item) => item.id === chatSessionId);
  const telegramSession = view === "chat" && isTelegramSession(activeChatSession);

  return (
    <AndromedaShell className="h-dvh min-h-0 overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <aside
          className={`flex shrink-0 flex-col border-r border-[var(--ah-border-subtle)] bg-[var(--ah-sidebar)] ${
            sidebarCollapsed ? (macInset ? "w-[76px]" : "w-12") : "w-60"
          }`}
        >
          <SidebarHeader
            agentId={agent.id}
            agentName={agent.name}
            collapsed={sidebarCollapsed}
            macInset={macInset}
            winCaption={winCaption}
            onToggle={() => setSidebarCollapsed((value) => !value)}
          />

          {!sidebarCollapsed && (
            <>
              <div className="border-b border-[var(--ah-border-subtle)] px-3 py-2">
                <div className="ah-chat-search">
                  <Search
                    aria-hidden="true"
                    size={14}
                    className="shrink-0 text-[var(--ah-text-faint)]"
                  />
                  <input
                    type="text"
                    role="searchbox"
                    value={chatSearch}
                    onChange={(event) => setChatSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setChatSearch("");
                      }
                    }}
                    placeholder="Search chats"
                    aria-label="Search chats"
                    aria-controls="hosted-chat-list"
                    autoComplete="off"
                    inputMode="search"
                    spellCheck={false}
                    className="ah-chat-search-input"
                  />
                  {chatSearch && (
                    <button
                      type="button"
                      onClick={() => setChatSearch("")}
                      aria-label="Clear chat search"
                      className="flex size-6 shrink-0 items-center justify-center text-[var(--ah-text-faint)] hover:text-[var(--ah-text-primary)]"
                    >
                      <X aria-hidden="true" size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-y-contain px-2 py-3">
                <section id="hosted-chat-list" className="space-y-1">
                  <div className="flex items-center justify-between px-2">
                    <p className="ah-micro">Chats</p>
                    <button
                      type="button"
                      disabled={busy}
                      className="ah-link inline-flex items-center justify-center p-1"
                      onClick={beginNewChat}
                      aria-label="New chat"
                      title="New chat"
                    >
                      <MessageSquarePlus size={14} aria-hidden="true" />
                    </button>
                  </div>
                  {chatSearch.trim() && matchingSessions.length > 0 && (
                    <p role="status" className="px-2 text-[10px] text-[var(--ah-text-faint)]">
                      {matchingSessions.length} of {sortedSessions.length} chats
                    </p>
                  )}
                  {matchingSessions.length === 0 ? (
                    chatSearch.trim() ? (
                      <p role="status" className="px-2 text-xs text-[var(--ah-text-faint)]">
                        No chats match “{chatSearch.trim()}”
                      </p>
                    ) : (
                      <p className="px-2 text-xs text-[var(--ah-text-faint)]">No chats yet</p>
                    )
                  ) : (
                    matchingSessions.map((item) => (
                      <div key={item.id} className="group flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => void selectChat(item.id)}
                          data-active={chatSessionId === item.id && view === "chat" ? "true" : "false"}
                          className="ah-nav-item min-w-0 flex-1 truncate"
                        >
                          {sessionTitle(item)}
                        </button>
                        <button
                          type="button"
                          className="hidden px-1.5 text-[10px] text-[var(--ah-text-faint)] group-hover:inline hover:text-[var(--ah-fault-300)]"
                          onClick={() => void removeChat(item.id)}
                          title="Delete chat"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </section>

              <section className="space-y-1">
                <div className="flex items-center justify-between px-2">
                  <p className="ah-micro">Bots</p>
                  <button
                    type="button"
                    className="ah-link inline-flex items-center justify-center p-1"
                    onClick={() => setView("bots")}
                    aria-label="Manage bots"
                    title="Manage bots"
                  >
                    <Bot size={14} aria-hidden="true" />
                  </button>
                </div>
                {bots.length === 0 ? (
                  <p className="px-2 text-xs text-[var(--ah-text-faint)]">No bots yet</p>
                ) : (
                  bots.map((bot) => (
                    <button
                      key={bot.name}
                      type="button"
                      onClick={() => {
                        if (pickingTarget) {
                          togglePickedTarget(hostedChatroomBotId(agent.id, bot.name));
                          return;
                        }
                        void startChatWithTarget(bot.name);
                      }}
                      data-active={
                        !pickingTarget && activeBot === bot.name && view === "chat"
                          ? "true"
                          : pickingTarget &&
                              pickedTargets.has(hostedChatroomBotId(agent.id, bot.name))
                            ? "true"
                            : "false"
                      }
                      className="ah-nav-item flex items-center gap-2 truncate"
                    >
                      <BlobAvatar
                        seed={`${agent.id}/${bot.name}`}
                        src={effectiveBotAvatar(bot)}
                        label={bot.title || bot.name}
                        size={24}
                      />
                      <span className="min-w-0 truncate">{bot.title || bot.name}</span>
                    </button>
                  ))
                )}
              </section>

              <section className="space-y-1">
                <div className="flex items-center justify-between px-2">
                  <p className="ah-micro">Rooms</p>
                  <button
                    type="button"
                    className="ah-link inline-flex items-center justify-center p-1"
                    onClick={() => {
                      setPickedTargets(new Set());
                      setPickingTarget(true);
                      setView("chat");
                    }}
                    aria-label="New room"
                    title="New room"
                  >
                    <MessagesSquare size={14} aria-hidden="true" />
                  </button>
                </div>
                {chatroomRooms.length === 0 ? (
                  <p className="px-2 text-xs text-[var(--ah-text-faint)]">No rooms yet</p>
                ) : (
                  chatroomRooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => openExistingRoom(room.id)}
                      data-active={view === "chatroom" && activeRoomId === room.id ? "true" : "false"}
                      className="ah-nav-item truncate"
                    >
                      {room.name}
                    </button>
                  ))
                )}
              </section>

              <section className="space-y-1">
                <div className="flex items-center justify-between px-2">
                  <p className="ah-micro">Schedule</p>
                  <button
                    type="button"
                    className="ah-link inline-flex items-center justify-center p-1"
                    onClick={() => setView("schedule")}
                    aria-label="Open schedule"
                    title="Open schedule"
                  >
                    <CalendarClock size={14} aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setView("schedule")}
                  data-active={view === "schedule" ? "true" : "false"}
                  className="ah-nav-item ah-schedule-nav flex items-center gap-2"
                >
                  {schedules.length} job{schedules.length === 1 ? "" : "s"}
                </button>
              </section>
              </div>
            </>
          )}

          {!sidebarCollapsed && (
            <div className="space-y-0.5 border-t border-[var(--ah-border-subtle)] p-2">
              <button
                type="button"
                className="ah-nav-item"
                onClick={() => {
                  setShowComputer((v) => {
                    if (v) setComputerFullscreen(false);
                    return !v;
                  });
                }}
              >
                {showComputer ? "Hide computer" : "Show computer"}
              </button>
              <button type="button" className="ah-nav-item" onClick={onChangeAgent}>
                Switch agent
              </button>
              <button
                type="button"
                className="ah-nav-item"
                onClick={() => setView("bots")}
              >
                Persona library
              </button>
              <button
                type="button"
                className="ah-nav-item"
                onClick={() =>
                  void window.ogb?.agentHosting?.signOut().then(() => location.replace("/"))
                }
              >
                Sign out
              </button>
            </div>
          )}
        </aside>

        <div
          className={`min-h-0 min-w-0 flex-1 ${
            showComputer && !computerFullscreen
              ? "grid md:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]"
              : "flex"
          }`}
        >
          <main className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-[var(--ah-border-subtle)] bg-[var(--ah-surface-base)]/95">
            {view === "chat" && (
              <>
                <div
                  className={`flex items-center justify-between gap-2 border-b border-[var(--ah-border-subtle)] px-4 backdrop-blur ${
                    winCaption ? "min-h-[56px] pt-[28px] pb-2" : "h-14"
                  }`}
                  style={windowDragStyle}
                >
                  <div className="min-w-0" style={windowNoDragStyle}>
                    <div className="ah-mono truncate text-sm font-semibold uppercase tracking-wider">
                      {headerTitle}
                    </div>
                    <div className="text-[11px] text-[var(--ah-text-muted)]">
                      {pickingTarget
                        ? pickedCount === 0
                          ? "Select one bot for a chat, or two+ for a room"
                          : pickedCount === 1
                            ? "1 selected · open as chat, or pick another for a room"
                            : `${pickedCount} selected · open as chatroom`
                        : activeBot
                          ? `Bot · ${activeBot}`
                          : "Main agent"}
                      {!pickingTarget ? ` · ${modelLabel}` : ""}
                      {!pickingTarget && effort !== "Medium" ? ` · ${effort}` : ""}
                      {!pickingTarget && showComputer ? " · computer context on" : ""}
                    </div>
                  </div>
                  {activeBot && !pickingTarget && (
                    <button
                      type="button"
                      className="ah-link text-xs"
                      style={windowNoDragStyle}
                      onClick={() => void startChatWithTarget(null)}
                    >
                      Switch to agent
                    </button>
                  )}
                </div>
                {telegramSession ? (
                  <div className="flex shrink-0 items-center gap-2 border-b border-[#2a6da8] bg-[#10243a] px-4 py-2 text-xs text-[#a9d8ff]">
                    <span aria-hidden="true">✈</span>
                    <span className="font-medium">Telegram session</span>
                    <span className="text-[#7fb7e4]">Messages here are connected to Telegram.</span>
                  </div>
                ) : null}
                <div ref={chatScrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-4 py-4">
                  {pickingTarget ? (
                    <div className="mx-auto w-full max-w-lg space-y-4 pt-2">
                      <div className="space-y-1">
                        <p className="ah-micro">Start with</p>
                        <h2 className="ah-mono text-sm font-semibold uppercase tracking-wider">
                          Choose bots for a chat or room
                        </h2>
                        <p className="text-sm text-[var(--ah-text-secondary)]">
                          Select one for a private chat, or two or more to open a chatroom.
                        </p>
                      </div>
                      <ul className="space-y-2">
                        <li>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => togglePickedTarget(agentParticipantId)}
                            data-active={pickedTargets.has(agentParticipantId) ? "true" : "false"}
                            className="ah-card-bordered flex w-full items-center gap-3 px-4 py-3 text-left transition-[border-color,background] duration-[140ms] hover:border-[var(--ah-accent-400)] hover:bg-[var(--ah-surface-hover)] data-[active=true]:border-[var(--ah-accent-400)]"
                          >
                            <input
                              type="checkbox"
                              className="accent-[var(--ah-accent-300)]"
                              checked={pickedTargets.has(agentParticipantId)}
                              readOnly
                              tabIndex={-1}
                            />
                            <BlobAvatar seed={agent.id} label={agent.name} size={44} />
                            <div className="min-w-0 space-y-1">
                              <div className="ah-mono truncate text-xs font-semibold uppercase tracking-wider">
                                {agent.name}
                              </div>
                              <div className="text-[11px] text-[var(--ah-text-faint)]">
                                Main agent
                                {agent.modelName ? ` · ${agent.modelName}` : ""}
                              </div>
                            </div>
                          </button>
                        </li>
                        {bots.map((bot) => {
                          const id = hostedChatroomBotId(agent.id, bot.name);
                          return (
                            <li key={bot.name}>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => togglePickedTarget(id)}
                                data-active={pickedTargets.has(id) ? "true" : "false"}
                                className="ah-card-bordered flex w-full items-center gap-3 px-4 py-3 text-left transition-[border-color,background] duration-[140ms] hover:border-[var(--ah-accent-400)] hover:bg-[var(--ah-surface-hover)] data-[active=true]:border-[var(--ah-accent-400)]"
                              >
                                <input
                                  type="checkbox"
                                  className="accent-[var(--ah-accent-300)]"
                                  checked={pickedTargets.has(id)}
                                  readOnly
                                  tabIndex={-1}
                                />
                                <BlobAvatar
                                  seed={`${agent.id}/${bot.name}`}
                                  src={effectiveBotAvatar(bot)}
                                  label={bot.title || bot.name}
                                  size={44}
                                />
                                <div className="min-w-0 space-y-1">
                                  <div className="ah-mono truncate text-xs font-semibold uppercase tracking-wider">
                                    {bot.title || bot.name}
                                  </div>
                                  <div className="text-[11px] text-[var(--ah-text-faint)]">
                                    Bot · {bot.name}
                                    {bot.modelName ? ` · ${bot.modelName}` : ""}
                                  </div>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          className="ah-btn ah-btn-default"
                          disabled={busy || pickedCount !== 1}
                          onClick={() => {
                            const only = [...pickedTargets][0];
                            if (!only) return;
                            if (only === agentParticipantId) void startChatWithTarget(null);
                            else {
                              const botName = only.slice(`${agent.id}:bot:`.length);
                              void startChatWithTarget(botName);
                            }
                          }}
                        >
                          Open chat
                        </button>
                        <button
                          type="button"
                          className="ah-btn ah-btn-outline"
                          disabled={busy || !canOpenChatroom}
                          onClick={() => openChatroomWithSelection([...pickedTargets])}
                        >
                          Open chatroom
                        </button>
                        {pickedCount === 0 ? (
                          <button
                            type="button"
                            className="ah-btn ah-btn-ghost"
                            disabled={busy}
                            onClick={() => void startChatWithTarget(null)}
                          >
                            Chat with agent only
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <>
                      {messages.length === 0 && (
                        <p className="text-sm text-[var(--ah-text-secondary)]">
                          Say hello, attach a file, or pick a model below before you send.
                        </p>
                      )}
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={
                            message.role === "user" ? "ah-bubble-user" : "ah-bubble-assistant"
                          }
                        >
                          {message.content ? (
                            <HostedMarkdown text={message.content} />
                          ) : streaming && message.role === "assistant" ? (
                            <span className="blink-cursor text-[var(--ah-accent-300)]" />
                          ) : null}
                          <ChatAttachmentPreview attachments={message.attachments} />
                        </div>
                      ))}
                    </>
                  )}
                </div>
                {(status || error) && (
                  <div className="border-t border-[var(--ah-border-subtle)] px-4 py-2 text-xs text-[var(--ah-text-secondary)]">
                    {error ? <span className="ah-fault">{error}</span> : status}
                  </div>
                )}
                {telegramSession ? (
                  <div className="border-t border-[var(--ah-border-subtle)] px-4 py-3 text-xs text-[var(--ah-text-muted)]">
                    Telegram sessions are read-only in Agentbot. Reply from Telegram to continue the conversation.
                  </div>
                ) : !pickingTarget ? (
                  <div className="border-t border-[var(--ah-border-subtle)] p-3">
                    <HostedPromptBar
                      models={
                        models.length > 0
                          ? models
                          : selectedModel
                            ? [{ key: selectedModel, name: selectedModel, tag: "Current" }]
                            : [{ key: "default", name: "Default model", tag: "Current" }]
                      }
                      defaultModel={selectedModel || models[0]?.key || "default"}
                      bots={bots}
                      computerEnabled={computerAvailable}
                      showComputer={showComputer}
                      onToggleComputer={() => {
                        setShowComputer((v) => {
                          if (v) setComputerFullscreen(false);
                          return !v;
                        });
                      }}
                      onSelectBot={(botName) => {
                        void startChatWithTarget(botName);
                      }}
                      busy={streaming}
                      placeholder={
                        activeBot
                          ? `Message ${bots.find((b) => b.name === activeBot)?.title || activeBot}…`
                          : `Message ${agent.name}…`
                      }
                      onSend={(text, payload) => void send(text, payload)}
                      onStop={stop}
                      onModelChange={(model) => setSelectedModel(model.key)}
                      onEffortChange={setEffort}
                    />
                  </div>
                ) : null}
              </>
            )}

            {view === "chatroom" && (
              <div className={`flex min-h-0 flex-1 flex-col ${winCaption ? "pt-[28px]" : ""}`}>
                {error && (
                  <div className="border-b border-[var(--ah-border-subtle)] px-4 py-2 text-xs ah-fault">
                    {error}
                  </div>
                )}
                <HostedChatroom
                  key={chatroomKey}
                  session={session}
                  agent={agent}
                  bots={bots}
                  initialState={chatroomState}
                  initialRoomId={activeRoomId}
                  initialSelectedIds={chatroomSeedIds}
                  onError={setError}
                  onRoomsChange={(rooms, roomId) => {
                    setChatroomRooms(rooms);
                    setActiveRoomId(roomId);
                    setChatroomState((prev) => ({
                      ...(prev ?? {}),
                      activeRoomId: roomId,
                      rooms: [
                        ...((prev?.rooms ?? []).filter((room) => !roomBelongsToAgent(room, agent.id))),
                        ...rooms,
                      ],
                    }));
                    setChatroomSeedIds(null);
                  }}
                />
              </div>
            )}

            {view === "bots" && (
              <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 md:p-6 ${
                  winCaption ? "pt-10" : ""
                }`}
              >
                {error && <div className="mb-4 text-sm ah-fault">{error}</div>}
                <HostedPersonaLibrary
                  session={session}
                  agentId={agent.id}
                  bots={bots}
                  maxBots={maxBots}
                  templates={templates}
                  onRefresh={refreshLibrary}
                  onError={setError}
                  onChat={(botName) => {
                    void startChatWithTarget(botName);
                  }}
                />
              </div>
            )}

            {view === "schedule" && (
              <div
                className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 md:p-6 ${
                  winCaption ? "pt-10" : ""
                }`}
              >
                {error && <div className="mb-4 text-sm ah-fault">{error}</div>}
                <HostedSchedulePanel
                  session={session}
                  agentId={agent.id}
                  schedules={schedules}
                  bots={bots}
                  onRefresh={refreshLibrary}
                  onError={setError}
                />
              </div>
            )}
          </main>

          {showComputer && (
            <section
              className={
                computerFullscreen
                  ? "fixed inset-0 z-50 flex flex-col bg-[var(--ah-surface-base)]"
                  : "flex min-h-[42vh] flex-col border-t border-[var(--ah-border-subtle)] md:min-h-0 md:border-t-0"
              }
              style={computerFullscreen ? windowNoDragStyle : undefined}
            >
              <OpenComputerPreview
                session={session}
                agent={agent}
                macInset={macInset}
                winCaption={winCaption}
                fullscreen={computerFullscreen}
                onToggleFullscreen={() => setComputerFullscreen((v) => !v)}
                teachDisabled={streaming || busy}
                onTeachTask={teachTask}
              />
              {!computerFullscreen && (
                <ComputerScheduleList
                  schedules={schedules}
                  onOpenSchedule={() => setView("schedule")}
                  onRun={(jobId) =>
                    void runHostedSchedule(session, agent.id, jobId)
                      .then(() => refreshSchedules(session, agent.id))
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : String(err)),
                      )
                  }
                  onToggle={(job) =>
                    void (job.enabled
                      ? pauseHostedSchedule(session, agent.id, job.id)
                      : resumeHostedSchedule(session, agent.id, job.id)
                    )
                      .then(() => refreshSchedules(session, agent.id))
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : String(err)),
                      )
                  }
                  onDelete={(jobId) =>
                    void removeHostedSchedule(session, agent.id, jobId)
                      .then(() => refreshSchedules(session, agent.id))
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : String(err)),
                      )
                  }
                />
              )}
            </section>
          )}
        </div>
      </div>
    </AndromedaShell>
  );
}
