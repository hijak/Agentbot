/** AgentHosting API client for the desktop thin client. */

export type HostedAgent = {
  id: string;
  name: string;
  status: string;
  modelProvider?: string | null;
  modelName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  extensionSurfaces?: Array<Record<string, unknown>>;
  openComputer?: {
    enabled: boolean;
    status: string | null;
    surfaceId: string | null;
  };
  config?: {
    modelProvider?: string | null;
    modelName?: string | null;
    openComputerEnabled?: boolean;
    agentExtensions?: Array<Record<string, unknown>>;
  };
};

export type HostedSession = {
  hosted: boolean;
  token: string;
  apiURL: string;
  dashboardURL: string;
  selectedAgentId: string | null;
};

export async function readHostedSession(): Promise<HostedSession | null> {
  const ah = window.ogb?.agentHosting;
  if (!ah?.active) return null;
  const session = await ah.session();
  if (!session.hosted || !session.token || !session.apiURL) return null;
  return {
    hosted: true,
    token: session.token,
    apiURL: session.apiURL.replace(/\/$/, ""),
    dashboardURL: (session.dashboardURL ?? "").replace(/\/$/, ""),
    selectedAgentId: session.selectedAgentId ?? null,
  };
}

export function isHostedMode(): boolean {
  return window.ogb?.agentHosting?.active === true;
}

async function hostedFetch(
  session: HostedSession,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetch(`${session.apiURL}${path}`, { ...init, headers });
}

export async function listHostedAgents(session: HostedSession): Promise<HostedAgent[]> {
  const res = await hostedFetch(session, "/api/agents");
  if (!res.ok) {
    // Prefer enriched CLI list when full agents route rejects for any reason.
    const cli = await hostedFetch(session, "/api/cli/agents");
    if (!cli.ok) throw new Error(`Failed to list agents (${res.status})`);
    const body = (await cli.json()) as { agents?: HostedAgent[] };
    return body.agents ?? [];
  }
  const body = (await res.json()) as { agents?: HostedAgent[] };
  return body.agents ?? [];
}

export async function getHostedAgent(session: HostedSession, agentId: string): Promise<HostedAgent> {
  const res = await hostedFetch(session, `/api/agents/${encodeURIComponent(agentId)}`);
  if (!res.ok) throw new Error(`Agent not found (${res.status})`);
  const body = (await res.json()) as { agent?: HostedAgent };
  if (!body.agent) throw new Error("Agent not found");
  return body.agent;
}

export function openComputerSurface(agent: HostedAgent): {
  surfaceId: string;
  status: string | null;
} | null {
  const fromSummary = agent.openComputer;
  if (fromSummary?.enabled && fromSummary.surfaceId) {
    return { surfaceId: fromSummary.surfaceId, status: fromSummary.status };
  }
  const extensions =
    agent.config?.agentExtensions ??
    agent.extensionSurfaces ??
    [];
  const found = extensions.find(
    (ext) =>
      ext &&
      typeof ext === "object" &&
      (ext as { id?: unknown }).id === "open-computer" &&
      (ext as { enabled?: unknown }).enabled === true,
  ) as { surfaceId?: string; status?: string } | undefined;
  if (!found?.surfaceId) return null;
  return { surfaceId: found.surfaceId, status: found.status ?? null };
}

export async function mintOpenComputerSession(
  session: HostedSession,
  surfaceId: string,
): Promise<{ url: string }> {
  const res = await hostedFetch(
    session,
    `/agent-extensions/open-computer/${encodeURIComponent(surfaceId)}/session`,
    { method: "POST" },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Open Computer session failed (${res.status})`);
  }
  return (await res.json()) as { url: string };
}

export function openComputerDesktopWsUrl(session: HostedSession, sessionUrl: string): string {
  const absolute = sessionUrl.startsWith("http")
    ? new URL(sessionUrl)
    : new URL(sessionUrl, session.apiURL);
  const token = absolute.searchParams.get("extension_token");
  const basePath = absolute.pathname.replace(/\/+$/, "");
  const ws = new URL(absolute.origin);
  ws.protocol = absolute.protocol === "https:" ? "wss:" : "ws:";
  ws.pathname = `${basePath}/desktop/websockify`;
  if (token) ws.searchParams.set("extension_token", token);
  for (const [key, value] of absolute.searchParams.entries()) {
    if (key !== "extension_token") ws.searchParams.set(key, value);
  }
  return ws.toString();
}

export type HostedChatHandlers = {
  onChunk: (text: string) => void;
  onStatus?: (status: string) => void;
  onDone: (sessionId: string) => void;
  onError: (err: string) => void;
  onTool?: (event: { type: string; toolName?: string; message?: string }) => void;
  onApproval?: (approval: { runId: string; command?: string; reason?: string }) => void;
};

export type HostedChatSession = {
  id: string;
  agentId: string;
  title: string | null;
  source?: string | null;
  sourceLabel?: string | null;
  readOnly?: number | boolean | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
};

export type HostedPersistedMessage = {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: HostedChatAttachment[];
};

export type HostedBotRoutine = {
  name: string;
  schedule: string;
  prompt: string;
};

export type HostedBotAvatar = {
  imageUrl?: string;
  emoji?: string;
  color?: string;
};

export type HostedBot = {
  name: string;
  title: string;
  description?: string;
  soul?: string;
  avatar?: HostedBotAvatar;
  routines: HostedBotRoutine[];
  templateId?: string;
  profileReady?: boolean;
  modelProvider?: string;
  modelName?: string;
};

export type HostedBotTeamTemplate = {
  id: string;
  name: string;
  category: string;
  scenario: string;
  description: string;
  bots: Array<{
    name: string;
    title: string;
    description: string;
    soul: string;
    routines: HostedBotRoutine[];
  }>;
};

export type HostedSchedule = {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  enabled: boolean;
  nextRun: string | null;
  lastStatus: string | null;
};

export const HOSTED_SCHEDULE_PRESETS = [
  { id: "daily-morning", label: "Every morning", description: "9:00 AM daily", value: "0 9 * * *" },
  { id: "daily-evening", label: "Every evening", description: "6:00 PM daily", value: "0 18 * * *" },
  { id: "weekly-monday", label: "Weekly on Monday", description: "Monday 9 AM", value: "0 9 * * 1" },
  { id: "hourly", label: "Every hour", description: "Runs every hour", value: "0 * * * *" },
  { id: "every-30min", label: "Every 30 minutes", description: "Twice an hour", value: "*/30 * * * *" },
  { id: "custom", label: "Custom", description: "Your own cron", value: "" },
] as const;

/** Human-readable gloss for common five-field cron expressions. */
export function describeHostedCron(scheduleValue: string): string {
  const value = scheduleValue.trim();
  if (!value) return "";
  const preset = HOSTED_SCHEDULE_PRESETS.find((p) => p.value === value);
  if (preset) return preset.description;
  const parts = value.split(/\s+/);
  if (parts.length !== 5) return value;
  const [minute, hour, , , dow] = parts;
  if (minute === "*/30" && hour === "*") return "Every 30 minutes";
  if (minute === "0" && hour === "*") return "Every hour";
  if (minute === "0" && hour === "9" && dow === "*") return "9:00 AM daily";
  if (minute === "0" && hour === "18" && dow === "*") return "6:00 PM daily";
  if (minute === "0" && hour === "9" && dow === "1") return "Monday 9 AM";
  return value;
}

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${fallback} (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function listHostedChatSessions(
  session: HostedSession,
  agentId: string,
): Promise<HostedChatSession[]> {
  const res = await hostedFetch(session, `/api/agents/${encodeURIComponent(agentId)}/chat/sessions`);
  const body = await readJson<{ sessions?: HostedChatSession[] }>(res, "Failed to list chat sessions");
  return (body.sessions ?? []).filter(
    (s) => s.source !== "dashboard-computer" && s.source !== "chatroom",
  );
}

export async function createHostedChatSession(
  session: HostedSession,
  agentId: string,
  options?: { context?: "computer"; forceNew?: boolean },
): Promise<HostedChatSession> {
  const res = await hostedFetch(session, `/api/agents/${encodeURIComponent(agentId)}/chat/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });
  const body = await readJson<{ session: HostedChatSession }>(res, "Failed to create chat session");
  return body.session;
}

export async function getHostedChatSession(
  session: HostedSession,
  agentId: string,
  chatSessionId: string,
): Promise<{ session: HostedChatSession; messages: HostedPersistedMessage[] }> {
  const res = await hostedFetch(
    session,
    `/api/agents/${encodeURIComponent(agentId)}/chat/sessions/${encodeURIComponent(chatSessionId)}`,
  );
  return readJson(res, "Failed to load chat session");
}

export async function deleteHostedChatSession(
  session: HostedSession,
  agentId: string,
  chatSessionId: string,
): Promise<void> {
  const res = await hostedFetch(
    session,
    `/api/agents/${encodeURIComponent(agentId)}/chat/sessions/${encodeURIComponent(chatSessionId)}`,
    { method: "DELETE" },
  );
  await readJson(res, "Failed to delete chat session");
}

export async function listHostedBots(
  session: HostedSession,
  agentId: string,
): Promise<{ bots: HostedBot[]; maxBots: number; tier: string }> {
  const res = await hostedFetch(session, `/api/agents/${encodeURIComponent(agentId)}/bots`);
  const body = await readJson<{ ok?: boolean; bots?: HostedBot[]; maxBots?: number; tier?: string }>(
    res,
    "Failed to list bots",
  );
  return {
    bots: body.bots ?? [],
    maxBots: body.maxBots ?? 6,
    tier: body.tier ?? "standard",
  };
}

export async function createHostedBot(
  session: HostedSession,
  agentId: string,
  input: {
    name?: string;
    title: string;
    description?: string;
    soul?: string;
    avatar?: HostedBotAvatar;
    routines?: HostedBotRoutine[];
    templateId?: string;
  },
): Promise<HostedBot> {
  const res = await hostedFetch(session, `/api/agents/${encodeURIComponent(agentId)}/bots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readJson<{ bot: HostedBot }>(res, "Failed to create bot");
  return body.bot;
}

export async function updateHostedBot(
  session: HostedSession,
  agentId: string,
  botName: string,
  input: {
    title?: string;
    description?: string | null;
    soul?: string | null;
    avatar?: HostedBotAvatar | null;
    modelProvider?: string | null;
    modelName?: string | null;
    routines?: HostedBotRoutine[];
  },
): Promise<HostedBot> {
  const res = await hostedFetch(
    session,
    `/api/agents/${encodeURIComponent(agentId)}/bots/${encodeURIComponent(botName)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  const body = await readJson<{ bot: HostedBot }>(res, "Failed to update bot");
  return body.bot;
}

export async function deleteHostedBot(
  session: HostedSession,
  agentId: string,
  botName: string,
): Promise<void> {
  const res = await hostedFetch(
    session,
    `/api/agents/${encodeURIComponent(agentId)}/bots/${encodeURIComponent(botName)}`,
    { method: "DELETE" },
  );
  await readJson(res, "Failed to delete bot");
}

export async function listHostedBotTemplates(
  session: HostedSession,
): Promise<HostedBotTeamTemplate[]> {
  const res = await hostedFetch(session, "/api/bot-templates");
  const body = await readJson<{ templates?: HostedBotTeamTemplate[] }>(
    res,
    "Failed to list bot templates",
  );
  return body.templates ?? [];
}

export async function applyHostedBotTemplate(
  session: HostedSession,
  agentId: string,
  templateId: string,
): Promise<{ added: number; bots: HostedBot[] }> {
  const res = await hostedFetch(
    session,
    `/api/agents/${encodeURIComponent(agentId)}/bots/apply-template`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    },
  );
  const body = await readJson<{ added?: number; bots?: HostedBot[] }>(
    res,
    "Failed to apply bot template",
  );
  return { added: body.added ?? 0, bots: body.bots ?? [] };
}

export async function listHostedSchedules(
  session: HostedSession,
  agentId: string,
): Promise<HostedSchedule[]> {
  const res = await hostedFetch(session, `/api/agents/${encodeURIComponent(agentId)}/schedules`);
  const body = await readJson<{ schedules?: HostedSchedule[] }>(res, "Failed to list schedules");
  return body.schedules ?? [];
}

export async function createHostedSchedule(
  session: HostedSession,
  agentId: string,
  data: { name?: string; schedule: string; prompt: string },
): Promise<void> {
  const res = await hostedFetch(session, `/api/agents/${encodeURIComponent(agentId)}/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  await readJson(res, "Failed to create schedule");
}

export async function updateHostedSchedule(
  session: HostedSession,
  agentId: string,
  jobId: string,
  data: { name?: string; schedule: string; prompt: string },
): Promise<void> {
  const res = await hostedFetch(
    session,
    `/api/agents/${encodeURIComponent(agentId)}/schedules/${encodeURIComponent(jobId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  await readJson(res, "Failed to update schedule");
}

export async function runHostedSchedule(
  session: HostedSession,
  agentId: string,
  jobId: string,
): Promise<void> {
  const res = await hostedFetch(
    session,
    `/api/agents/${encodeURIComponent(agentId)}/schedules/${encodeURIComponent(jobId)}/run`,
    { method: "POST" },
  );
  await readJson(res, "Failed to run schedule");
}

export async function removeHostedSchedule(
  session: HostedSession,
  agentId: string,
  jobId: string,
): Promise<void> {
  const res = await hostedFetch(
    session,
    `/api/agents/${encodeURIComponent(agentId)}/schedules/${encodeURIComponent(jobId)}`,
    { method: "DELETE" },
  );
  await readJson(res, "Failed to remove schedule");
}

export async function pauseHostedSchedule(
  session: HostedSession,
  agentId: string,
  jobId: string,
): Promise<void> {
  const res = await hostedFetch(
    session,
    `/api/agents/${encodeURIComponent(agentId)}/schedules/${encodeURIComponent(jobId)}/pause`,
    { method: "POST" },
  );
  await readJson(res, "Failed to pause schedule");
}

export async function resumeHostedSchedule(
  session: HostedSession,
  agentId: string,
  jobId: string,
): Promise<void> {
  const res = await hostedFetch(
    session,
    `/api/agents/${encodeURIComponent(agentId)}/schedules/${encodeURIComponent(jobId)}/resume`,
    { method: "POST" },
  );
  await readJson(res, "Failed to resume schedule");
}

export type HostedChatAttachment = {
  filename?: string;
  contentType?: string;
  base64: string;
};

export type HostedModelOption = {
  key: string;
  name: string;
  tag?: string;
  provider?: string;
};

/** Models advertised on the tenant's provider keys (default + extras). */
export async function listHostedModels(
  session: HostedSession,
  agent?: HostedAgent | null,
): Promise<HostedModelOption[]> {
  const byKey = new Map<string, HostedModelOption>();
  const add = (model: string | null | undefined, tag?: string, provider?: string | null) => {
    const name = model?.trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (byKey.has(key)) return;
    byKey.set(key, {
      key: name,
      name,
      tag: tag || undefined,
      provider: provider?.trim() || undefined,
    });
  };

  const agentModel = agent?.modelName ?? agent?.config?.modelName;
  const agentProvider = agent?.modelProvider ?? agent?.config?.modelProvider;
  add(agentModel, "Current", agentProvider);

  try {
    const res = await hostedFetch(session, "/api/keys");
    if (res.ok) {
      const body = (await res.json()) as {
        keys?: Array<{
          provider?: string;
          defaultModel?: string | null;
          extraModels?: string[] | null;
        }>;
      };
      for (const key of body.keys ?? []) {
        add(key.defaultModel, "Default", key.provider);
        for (const extra of key.extraModels ?? []) {
          add(extra, undefined, key.provider);
        }
      }
    }
  } catch {
    // Keys listing is best-effort; agent model alone is enough to send.
  }

  return [...byKey.values()];
}

export async function stopHostedChat(
  session: HostedSession,
  agentId: string,
  chatSessionId: string,
): Promise<void> {
  const res = await hostedFetch(session, `/api/agents/${encodeURIComponent(agentId)}/chat/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId: chatSessionId }),
  });
  await readJson(res, "Failed to stop chat");
}

export type HostedChatroomMessage = {
  id: string;
  role: "human" | "agent" | "system";
  agentId?: string;
  agentName?: string;
  content: string;
  createdAt: number;
};

export type HostedChatroomRoom = {
  id: string;
  name: string;
  selectedIds: string[];
  input: string;
  messages: HostedChatroomMessage[];
  discussionRounds: 1 | 2 | 3;
  sessionIds: Record<string, string>;
};

export type HostedChatroomState = {
  activeRoomId?: string;
  roomsColumnCollapsed?: boolean;
  rooms: HostedChatroomRoom[];
};

/** Participant id for the parent agent in AI Chatroom state. */
export function hostedChatroomAgentId(agentId: string): string {
  return agentId;
}

/** Participant id for a bot under an agent in AI Chatroom state. */
export function hostedChatroomBotId(agentId: string, botName: string): string {
  return `${agentId}:bot:${botName}`;
}

export function parseHostedChatroomParticipantId(participantId: string): {
  agentId: string;
  botName?: string;
} {
  const botMarker = ":bot:";
  const idx = participantId.indexOf(botMarker);
  if (idx === -1) return { agentId: participantId };
  return {
    agentId: participantId.slice(0, idx),
    botName: participantId.slice(idx + botMarker.length),
  };
}

/** True when every selected participant belongs to this agent. */
export function roomBelongsToAgent(room: HostedChatroomRoom, agentId: string): boolean {
  if (!room.selectedIds.length) return false;
  return room.selectedIds.every((id) => {
    const parsed = parseHostedChatroomParticipantId(id);
    return parsed.agentId === agentId;
  });
}

export async function getHostedChatroomState(
  session: HostedSession,
): Promise<HostedChatroomState | null> {
  const res = await hostedFetch(session, "/api/ai-chatroom/state");
  const body = await readJson<{ state?: HostedChatroomState | null }>(
    res,
    "Failed to load chatroom state",
  );
  return body.state ?? null;
}

/**
 * Persist chatroom rooms for one agent without wiping rooms that belong to
 * other agents on the same tenant.
 */
export async function saveHostedAgentChatrooms(
  session: HostedSession,
  agentId: string,
  rooms: HostedChatroomRoom[],
  options?: { activeRoomId?: string; roomsColumnCollapsed?: boolean },
): Promise<HostedChatroomState> {
  const existing = (await getHostedChatroomState(session)) ?? { rooms: [] };
  const foreign = (existing.rooms ?? []).filter((room) => !roomBelongsToAgent(room, agentId));
  const payload: HostedChatroomState = {
    activeRoomId: options?.activeRoomId ?? existing.activeRoomId,
    roomsColumnCollapsed: options?.roomsColumnCollapsed ?? existing.roomsColumnCollapsed,
    rooms: [
      ...foreign,
      ...rooms.map((room) => ({
        id: room.id,
        name: room.name,
        selectedIds: room.selectedIds,
        input: room.input,
        messages: room.messages,
        discussionRounds: room.discussionRounds,
        sessionIds: Object.fromEntries(
          Object.entries(room.sessionIds).filter(
            (entry): entry is [string, string] =>
              typeof entry[0] === "string" && typeof entry[1] === "string" && entry[1].length > 0,
          ),
        ),
      })),
    ],
  };
  const res = await hostedFetch(session, "/api/ai-chatroom/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await readJson<{ state: HostedChatroomState }>(res, "Failed to save chatroom state");
  return body.state;
}

export async function getHostedKanbanSummary(
  session: HostedSession,
  agentId: string,
): Promise<string> {
  try {
    const res = await hostedFetch(session, `/api/agents/${encodeURIComponent(agentId)}/kanban`);
    if (!res.ok) return "Kanban unavailable or runtime offline.";
    const body = (await res.json()) as {
      cards?: Array<{
        title?: string;
        status?: string;
        assignedWorker?: string | null;
        spec?: string | null;
      }>;
    };
    const cards = body.cards ?? [];
    if (!cards.length) return "No visible kanban cards.";
    return cards
      .slice(0, 5)
      .map((card) => {
        const assignee = card.assignedWorker ? ` assigned to ${card.assignedWorker}` : "";
        const blocked = card.status === "blocked" ? " BLOCKED" : "";
        const spec = (card.spec || "No spec").trim();
        const bounded = spec.length > 180 ? `${spec.slice(0, 179)}…` : spec;
        return `- [${card.status ?? "unknown"}] ${card.title ?? "Untitled"}${assignee}${blocked}: ${bounded}`;
      })
      .join("\n");
  } catch {
    return "Kanban unavailable or runtime offline.";
  }
}

/** Stream a chat turn against AgentHosting's dashboard chat SSE. */
export async function streamHostedChat(
  session: HostedSession,
  agentId: string,
  message: string,
  chatSessionId: string | null,
  handlers: HostedChatHandlers,
  options?: {
    context?: "computer";
    bot?: string;
    model?: string;
    effort?: string;
    attachments?: HostedChatAttachment[];
    memoryCapture?: boolean;
    orchestration?: "chatroom";
  },
): Promise<() => void> {
  const controller = new AbortController();
  void (async () => {
    try {
      const res = await hostedFetch(session, `/api/agents/${encodeURIComponent(agentId)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          sessionId: chatSessionId ?? undefined,
          context: options?.context,
          bot: options?.bot,
          model: options?.model,
          effort: options?.effort,
          attachments: options?.attachments,
          memoryCapture: options?.memoryCapture,
          orchestration: options?.orchestration,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        handlers.onError(text || `Chat failed (${res.status})`);
        return;
      }

      const headerSessionId = res.headers.get("x-chat-session-id") ?? "";
      let doneSession = headerSessionId || chatSessionId || "";
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (data.type === "text" && typeof data.content === "string") {
              handlers.onChunk(data.content);
            } else if (data.type === "status") {
              const status =
                typeof data.status === "string"
                  ? data.status
                  : typeof data.message === "string"
                    ? data.message
                    : "";
              if (status) handlers.onStatus?.(status);
            } else if (data.type === "tool_call" || data.type === "tool_result") {
              handlers.onTool?.({
                type: data.type,
                toolName: typeof data.toolName === "string" ? data.toolName : undefined,
                message: typeof data.message === "string" ? data.message : undefined,
              });
            } else if (data.type === "approval_request") {
              const approval =
                data.approval && typeof data.approval === "object"
                  ? (data.approval as Record<string, unknown>)
                  : {};
              handlers.onApproval?.({
                runId: String(data.runId ?? ""),
                command:
                  typeof approval.command === "string"
                    ? approval.command
                    : typeof approval.cmd === "string"
                      ? approval.cmd
                      : undefined,
                reason: typeof approval.reason === "string" ? approval.reason : undefined,
              });
            } else if (data.type === "error") {
              handlers.onError(
                typeof data.message === "string" && data.message
                  ? data.message
                  : "Agent chat failed.",
              );
            } else if (data.type === "done") {
              if (typeof data.sessionId === "string" && data.sessionId) {
                doneSession = data.sessionId;
              }
              handlers.onDone(doneSession);
              return;
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
      handlers.onDone(doneSession);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      handlers.onError(err instanceof Error ? err.message : String(err));
    }
  })();

  return () => controller.abort();
}
