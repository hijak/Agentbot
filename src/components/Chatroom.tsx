import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getHostedKanbanSummary,
  hostedChatroomAgentId,
  hostedChatroomBotId,
  parseHostedChatroomParticipantId,
  roomBelongsToAgent,
  saveHostedAgentChatrooms,
  streamHostedChat,
  type HostedAgent,
  type HostedBot,
  type HostedChatroomMessage,
  type HostedChatroomRoom,
  type HostedChatroomState,
  type HostedSession,
} from "@/lib/agenthosting/client";
import { BlobAvatar, effectiveBotAvatar } from "./andromeda/BlobAvatar";
import { ChatMarkdownView } from "./ChatMarkdownView";
import { StatusBadge } from "./andromeda/StatusBadge";
import { ActivityTrail, foldActivity, type ActivityEntry } from "./ActivityTrail";

export type ChatroomParticipant = {
  id: string;
  name: string;
  bot?: HostedBot;
};

type RoomRuntime = HostedChatroomRoom & {
  isRunning: boolean;
  error: string | null;
  activeParticipantId: string | null;
};

function createRoom(
  index: number,
  selectedIds: string[] = [],
  name?: string,
): HostedChatroomRoom {
  return {
    id: `room-${Date.now()}-${index}`,
    name: name || `Room ${index}`,
    selectedIds,
    input: "",
    messages: [],
    discussionRounds: 2,
    sessionIds: {},
  };
}

function toRuntime(room: HostedChatroomRoom): RoomRuntime {
  return {
    ...room,
    isRunning: false,
    error: null,
    activeParticipantId: null,
  };
}

function normalizeStoredRoom(value: unknown, index: number): HostedChatroomRoom | null {
  if (!value || typeof value !== "object") return null;
  const room = value as Partial<HostedChatroomRoom>;
  if (typeof room.id !== "string" || typeof room.name !== "string") return null;
  return {
    id: room.id,
    name: room.name.trim() || `Room ${index + 1}`,
    selectedIds: Array.isArray(room.selectedIds)
      ? room.selectedIds.filter((id): id is string => typeof id === "string")
      : [],
    input: typeof room.input === "string" ? room.input : "",
    messages: Array.isArray(room.messages)
      ? room.messages.filter((message): message is HostedChatroomMessage => {
          if (!message || typeof message !== "object") return false;
          const item = message as Partial<HostedChatroomMessage>;
          return (
            typeof item.id === "string" &&
            (item.role === "human" || item.role === "agent" || item.role === "system") &&
            typeof item.content === "string" &&
            typeof item.createdAt === "number"
          );
        })
      : [],
    discussionRounds:
      room.discussionRounds === 1 || room.discussionRounds === 2 || room.discussionRounds === 3
        ? room.discussionRounds
        : 2,
    sessionIds:
      room.sessionIds && typeof room.sessionIds === "object" && !Array.isArray(room.sessionIds)
        ? Object.fromEntries(
            Object.entries(room.sessionIds).filter(
              (entry): entry is [string, string] =>
                typeof entry[0] === "string" && typeof entry[1] === "string",
            ),
          )
        : {},
  };
}

function transcriptForPrompt(messages: HostedChatroomMessage[]) {
  const transcript = messages
    .filter((message) => message.content.trim())
    .slice(-8)
    .map((message) => {
      const speaker = message.role === "human" ? "Human" : message.agentName || "Agent";
      const content = message.content.trim();
      const bounded = content.length > 700 ? `${content.slice(0, 699)}…` : content;
      return `${speaker}: ${bounded}`;
    })
    .join("\n\n");
  return transcript.length > 6_000 ? transcript.slice(-6_000) : transcript;
}

function runParticipantTurn({
  session,
  agentId,
  botName,
  prompt,
  sessionId,
  onChunk,
  onActivity,
}: {
  session: HostedSession;
  agentId: string;
  botName?: string;
  prompt: string;
  sessionId: string | null;
  onChunk: (text: string) => void;
  onActivity: (event: { type: string; toolName?: string; message?: string; input?: string; output?: string }) => void;
}): Promise<{ text: string; sessionId: string }> {
  return new Promise((resolve, reject) => {
    let text = "";
    void streamHostedChat(
      session,
      agentId,
      prompt,
      sessionId,
      {
        onChunk: (chunk) => {
          text += chunk;
          onChunk(chunk);
        },
        onTool: onActivity,
        onStatus: (message) => onActivity({ type: "status", message }),
        onDone: (resolvedSessionId) => resolve({ text, sessionId: resolvedSessionId }),
        onError: (error) => reject(new Error(error)),
      },
      {
        memoryCapture: false,
        orchestration: "chatroom",
        bot: botName,
      },
    );
  });
}

export function buildParticipants(
  agent: HostedAgent,
  bots: HostedBot[],
): ChatroomParticipant[] {
  return [
    { id: hostedChatroomAgentId(agent.id), name: agent.name },
    ...bots.map((bot) => ({
      id: hostedChatroomBotId(agent.id, bot.name),
      name: bot.title || bot.name,
      bot,
    })),
  ];
}

export function Chatroom({
  session,
  agent,
  bots,
  initialState,
  initialRoomId,
  initialSelectedIds,
  onRoomsChange,
  onError,
}: {
  session: HostedSession;
  agent: HostedAgent;
  bots: HostedBot[];
  initialState: HostedChatroomState | null;
  initialRoomId?: string | null;
  /** When opening a brand-new room from the new-session picker. */
  initialSelectedIds?: string[] | null;
  onRoomsChange?: (rooms: HostedChatroomRoom[], activeRoomId: string) => void;
  onError?: (message: string | null) => void;
}) {
  const participants = useMemo(() => buildParticipants(agent, bots), [agent, bots]);
  const participantIds = useMemo(
    () => new Set(participants.map((participant) => participant.id)),
    [participants],
  );

  const seededRooms = useMemo(() => {
    const fromServer = (initialState?.rooms ?? [])
      .map((room, index) => normalizeStoredRoom(room, index))
      .filter((room): room is HostedChatroomRoom => Boolean(room))
      .filter((room) => roomBelongsToAgent(room, agent.id));
    if (initialSelectedIds && initialSelectedIds.length >= 2) {
      const room = createRoom(fromServer.length + 1, initialSelectedIds, "New room");
      return [...fromServer, room];
    }
    if (fromServer.length) return fromServer;
    return [createRoom(1, participants.map((p) => p.id))];
  }, [agent.id, initialSelectedIds, initialState?.rooms, participants]);

  const [rooms, setRooms] = useState<RoomRuntime[]>(() => seededRooms.map(toRuntime));
  const [activeRoomId, setActiveRoomId] = useState(() => {
    if (initialSelectedIds && initialSelectedIds.length >= 2) {
      return seededRooms[seededRooms.length - 1]?.id ?? seededRooms[0].id;
    }
    if (initialRoomId && seededRooms.some((room) => room.id === initialRoomId)) {
      return initialRoomId;
    }
    if (initialState?.activeRoomId && seededRooms.some((r) => r.id === initialState.activeRoomId)) {
      return initialState.activeRoomId;
    }
    return seededRooms[0].id;
  });
  const [managingMembers, setManagingMembers] = useState(false);
  const [activityByMessageId, setActivityByMessageId] = useState<Record<string, ActivityEntry[]>>({});
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? rooms[0];

  useEffect(() => {
    const node = messagesScrollRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [activeRoomId, activeRoom?.messages.length, activeRoom?.messages.at(-1)?.content]);

  const selectedParticipants = useMemo(() => {
    if (!activeRoom) return [];
    const ids =
      activeRoom.selectedIds.length === 0
        ? participants.map((p) => p.id)
        : activeRoom.selectedIds.filter((id) => participantIds.has(id));
    return participants.filter((participant) => ids.includes(participant.id));
  }, [activeRoom, participantIds, participants]);

  const persist = useCallback(
    (nextRooms: RoomRuntime[], nextActiveId: string) => {
      const clean = nextRooms.map(
        ({ isRunning: _r, error: _e, activeParticipantId: _a, ...room }) => room,
      );
      onRoomsChange?.(clean, nextActiveId);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        void saveHostedAgentChatrooms(session, agent.id, clean, {
          activeRoomId: nextActiveId,
        }).catch((err) =>
          onError?.(err instanceof Error ? err.message : String(err)),
        );
      }, 750);
    },
    [agent.id, onError, onRoomsChange, session],
  );

  useEffect(() => {
    hydratedRef.current = true;
    if (initialSelectedIds && initialSelectedIds.length >= 2) {
      persist(rooms, activeRoomId);
    }
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
    // Only on mount for seeded rooms.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    setRooms((current) =>
      current.map((room) => {
        if (room.selectedIds.length === 0) return room;
        const nextSelectedIds = room.selectedIds.filter((id) => participantIds.has(id));
        return nextSelectedIds.length === room.selectedIds.length
          ? room
          : { ...room, selectedIds: nextSelectedIds };
      }),
    );
  }, [participantIds]);

  const updateRoom = (roomId: string, updater: (room: RoomRuntime) => RoomRuntime) => {
    setRooms((current) => {
      const next = current.map((room) => (room.id === roomId ? updater(room) : room));
      persist(next, activeRoomId);
      return next;
    });
  };

  const updateActiveRoom = (updater: (room: RoomRuntime) => RoomRuntime) => {
    updateRoom(activeRoomId, updater);
  };

  const addRoom = () => {
    setRooms((current) => {
      const ids = selectedParticipants.map((p) => p.id);
      const nextRoom = toRuntime(createRoom(current.length + 1, ids, `Room ${current.length + 1}`));
      const next = [...current, nextRoom];
      setActiveRoomId(nextRoom.id);
      persist(next, nextRoom.id);
      return next;
    });
    setManagingMembers(true);
  };

  const deleteRoom = (roomId: string) => {
    setRooms((current) => {
      if (current.length <= 1) return current;
      const target = current.find((room) => room.id === roomId);
      if (target?.isRunning) return current;
      const next = current.filter((room) => room.id !== roomId);
      const nextActive = roomId === activeRoomId ? next[0].id : activeRoomId;
      setActiveRoomId(nextActive);
      persist(next, nextActive);
      return next;
    });
  };

  const toggleParticipant = (participantId: string) => {
    updateActiveRoom((room) => {
      const base =
        room.selectedIds.length === 0
          ? participants.map((p) => p.id)
          : room.selectedIds.filter((id) => participantIds.has(id));
      return {
        ...room,
        selectedIds: base.includes(participantId)
          ? base.filter((id) => id !== participantId)
          : [...base, participantId],
      };
    });
  };

  const runRoomDiscussion = async (humanText?: string) => {
    if (!activeRoom || activeRoom.isRunning || selectedParticipants.length < 2) return;
    const trimmed = humanText?.trim() ?? "";
    if (!trimmed && activeRoom.messages.length === 0) return;

    const roomId = activeRoom.id;
    const roomName = activeRoom.name;
    const discussionRounds = activeRoom.discussionRounds;
    const currentMessages = activeRoom.messages;
    const currentSessionIds = activeRoom.sessionIds;

    updateRoom(roomId, (room) => ({
      ...room,
      isRunning: true,
      error: null,
      input: "",
    }));

    const baseMessages = trimmed
      ? [
          ...currentMessages,
          {
            id: `human-${Date.now()}`,
            role: "human" as const,
            content: trimmed,
            createdAt: Date.now(),
          },
        ]
      : currentMessages;

    updateRoom(roomId, (room) => ({ ...room, messages: baseMessages }));

    const kanbanSummary = await getHostedKanbanSummary(session, agent.id);

    let rollingMessages = baseMessages;
    let nextSessionIds = { ...currentSessionIds };

    try {
      for (let round = 0; round < discussionRounds; round += 1) {
        for (const participant of selectedParticipants) {
          const parsed = parseHostedChatroomParticipantId(participant.id);
          const messageId = `participant-${participant.id}-${Date.now()}-${round}`;
          const draft: HostedChatroomMessage = {
            id: messageId,
            role: "agent",
            agentId: participant.id,
            agentName: participant.name,
            content: "",
            createdAt: Date.now(),
          };
          setActivityByMessageId((prev) => ({
            ...prev,
            [messageId]: foldActivity([], { type: "status", message: "Thinking…" }),
          }));

          rollingMessages = [...rollingMessages, draft];
          updateRoom(roomId, (room) => ({
            ...room,
            messages: rollingMessages,
            activeParticipantId: participant.id,
          }));

          const peers = selectedParticipants
            .filter((peer) => peer.id !== participant.id)
            .map((peer) => peer.name)
            .join(", ");

          const prompt = [
            "You are participating in the AgentHosting AI Chatroom: a collaborative group chat between multiple agents with a human in the loop.",
            `You are ${participant.name}${participant.bot ? `, a bot hosted by ${agent.name}` : ""}. Other participants in the room: ${peers || "none"}.`,
            `Room name: ${roomName}. This is agent discussion pass ${round + 1} of ${discussionRounds}. Read what the other agents already said and reply to them directly when useful. You are not only answering the human; you are collaborating with the other agents.`,
            "Goal: work issues out together. Be concise, practical, and hand off clearly.",
            `Kanban snapshot for ${agent.name}:\n${kanbanSummary}`,
            `Recent room transcript:\n${transcriptForPrompt(rollingMessages.filter((message) => message.id !== messageId))}`,
            round === discussionRounds - 1
              ? "Reply as yourself to the room. Because this is the final pass, converge on concrete next actions and call out any unresolved disagreement."
              : "Reply as yourself to the room. Ask another named agent a direct question or challenge their plan if that would help.",
          ].join("\n\n");

          try {
            const result = await runParticipantTurn({
              session,
              agentId: agent.id,
              botName: parsed.botName,
              prompt,
              sessionId: nextSessionIds[participant.id] ?? null,
              onChunk: (chunk) => {
                updateRoom(roomId, (room) => ({
                  ...room,
                  messages: room.messages.map((message) =>
                    message.id === messageId
                      ? { ...message, content: message.content + chunk }
                      : message,
                  ),
                }));
                setActivityByMessageId((prev) => ({
                  ...prev,
                  [messageId]: foldActivity(prev[messageId] ?? [], { type: "finalize" }),
                }));
              },
              onActivity: (event) => {
                setActivityByMessageId((prev) => ({
                  ...prev,
                  [messageId]: foldActivity(prev[messageId] ?? [], event),
                }));
              },
            });

            nextSessionIds = { ...nextSessionIds, [participant.id]: result.sessionId };
            setActivityByMessageId((prev) => ({
              ...prev,
              [messageId]: foldActivity(prev[messageId] ?? [], { type: "finalize" }),
            }));
            rollingMessages = rollingMessages.map((message) =>
              message.id === messageId
                ? { ...message, content: result.text || "(No reply)" }
                : message,
            );
          } catch (agentErr) {
            const errorText =
              agentErr instanceof Error ? agentErr.message : String(agentErr);
            setActivityByMessageId((prev) => ({
              ...prev,
              [messageId]: foldActivity(prev[messageId] ?? [], {
                type: "error",
                message: errorText,
              }),
            }));
            rollingMessages = rollingMessages.map((message) =>
              message.id === messageId
                ? {
                    ...message,
                    content: `⚠️ ${participant.name} failed to reply in this pass.\n\n${errorText}`,
                  }
                : message,
            );
            rollingMessages = [
              ...rollingMessages,
              {
                id: `system-${participant.id}-${Date.now()}`,
                role: "system",
                content: `${participant.name} failed in this discussion pass, but the rest of the room kept going.`,
                createdAt: Date.now(),
              },
            ];
          }

          updateRoom(roomId, (room) => ({
            ...room,
            messages: rollingMessages,
            sessionIds: nextSessionIds,
          }));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      rollingMessages = [
        ...rollingMessages,
        {
          id: `system-${Date.now()}`,
          role: "system",
          content: `Chatroom round stopped: ${msg}`,
          createdAt: Date.now(),
        },
      ];
      updateRoom(roomId, (room) => ({
        ...room,
        error: msg,
        messages: rollingMessages,
      }));
    } finally {
      updateRoom(roomId, (room) => ({
        ...room,
        messages: rollingMessages,
        sessionIds: nextSessionIds,
        activeParticipantId: null,
        isRunning: false,
      }));
    }
  };

  if (!activeRoom) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--ah-border-subtle)] px-4 py-2.5">
        <div className="min-w-0">
          <input
            className="ah-mono w-full bg-transparent text-sm font-semibold uppercase tracking-wider outline-none"
            value={activeRoom.name}
            disabled={activeRoom.isRunning}
            onChange={(event) =>
              updateActiveRoom((room) => ({ ...room, name: event.target.value }))
            }
          />
          <div className="mt-0.5 text-[11px] text-[var(--ah-text-muted)]">
            {selectedParticipants.length} participant
            {selectedParticipants.length === 1 ? "" : "s"}
            {activeRoom.isRunning && activeRoom.activeParticipantId
              ? ` · ${participants.find((p) => p.id === activeRoom.activeParticipantId)?.name ?? "Bot"} speaking`
              : ""}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--ah-text-muted)]">
            Rounds
            <select
              className="ah-input h-7 w-14 px-1 text-xs"
              value={activeRoom.discussionRounds}
              disabled={activeRoom.isRunning}
              onChange={(event) =>
                updateActiveRoom((room) => ({
                  ...room,
                  discussionRounds: Number(event.target.value) as 1 | 2 | 3,
                }))
              }
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <button
            type="button"
            className="ah-btn ah-btn-ghost ah-btn-sm"
            onClick={() => setManagingMembers((open) => !open)}
            aria-pressed={managingMembers}
          >
            {managingMembers ? "Done" : "Members"}
          </button>
          <button
            type="button"
            className="ah-btn ah-btn-ghost ah-btn-sm"
            onClick={addRoom}
          >
            New room
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {(managingMembers || rooms.length > 1) && (
          <aside className="flex w-52 shrink-0 flex-col border-r border-[var(--ah-border-subtle)] bg-[var(--ah-sidebar)]">
            <div className="border-b border-[var(--ah-border-subtle)] px-3 py-2">
              <p className="ah-micro">Rooms</p>
            </div>
            <ul className="max-h-40 space-y-0 overflow-y-auto border-b border-[var(--ah-border-subtle)]">
              {rooms.map((room) => (
                <li key={room.id} className="group flex items-center gap-0.5">
                  <button
                    type="button"
                    className="ah-nav-item min-w-0 flex-1 truncate"
                    data-active={room.id === activeRoomId ? "true" : "false"}
                    onClick={() => {
                      setActiveRoomId(room.id);
                      persist(rooms, room.id);
                    }}
                  >
                    {room.name}
                  </button>
                  <button
                    type="button"
                    className="hidden px-1.5 text-[10px] text-[var(--ah-text-faint)] group-hover:inline hover:text-[var(--ah-fault-300)]"
                    disabled={rooms.length <= 1 || room.isRunning}
                    onClick={() => deleteRoom(room.id)}
                    title="Delete room"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            {managingMembers && (
              <>
                <div className="border-b border-[var(--ah-border-subtle)] px-3 py-2">
                  <p className="ah-micro">Add / remove</p>
                </div>
                <ul className="min-h-0 flex-1 space-y-0 overflow-y-auto px-2 py-2">
                  {participants.map((participant) => {
                    const checked = selectedParticipants.some((p) => p.id === participant.id);
                    return (
                      <li key={participant.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--ah-surface-hover)]">
                          <input
                            type="checkbox"
                            className="accent-[var(--ah-accent-300)]"
                            checked={checked}
                            disabled={activeRoom.isRunning}
                            onChange={() => toggleParticipant(participant.id)}
                          />
                          <BlobAvatar
                            seed={participant.id}
                            src={participant.bot ? effectiveBotAvatar(participant.bot) : null}
                            label={participant.name}
                            size={22}
                          />
                          <span className="min-w-0 truncate text-xs">{participant.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {selectedParticipants.length < 2 ? (
                  <p className="px-3 py-2 text-[11px] text-[var(--ah-text-faint)]">
                    Select at least two bots (or the agent + a bot) to run a room.
                  </p>
                ) : null}
              </>
            )}
          </aside>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[var(--ah-border-subtle)] px-4 py-2">
            {selectedParticipants.map((participant) => (
              <span
                key={participant.id}
                className="inline-flex items-center gap-1.5 border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] px-2 py-1 text-[11px]"
              >
                <BlobAvatar
                  seed={participant.id}
                  src={participant.bot ? effectiveBotAvatar(participant.bot) : null}
                  label={participant.name}
                  size={18}
                />
                {participant.name}
                {!activeRoom.isRunning && (
                  <button
                    type="button"
                    className="text-[var(--ah-text-faint)] hover:text-[var(--ah-fault-300)]"
                    onClick={() => toggleParticipant(participant.id)}
                    title={`Remove ${participant.name}`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            <button
              type="button"
              className="ah-link text-[11px]"
              onClick={() => setManagingMembers(true)}
            >
              + Add
            </button>
          </div>

          <div ref={messagesScrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-4 py-4">
            {activeRoom.messages.length === 0 ? (
              <p className="text-sm text-[var(--ah-text-secondary)]">
                Send a message to start a multi-bot discussion. Each selected bot replies in turn.
              </p>
            ) : (
              activeRoom.messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "human"
                      ? "ah-bubble-user"
                      : message.role === "system"
                        ? "border border-[var(--ah-border-subtle)] px-3 py-2 text-xs text-[var(--ah-text-muted)]"
                        : "ah-bubble-assistant"
                  }
                >
                  {message.role === "agent" && message.agentName ? (
                    <div className="mb-1 flex items-center gap-2">
                      <span className="ah-micro">{message.agentName}</span>
                      {activeRoom.activeParticipantId === message.agentId &&
                      activeRoom.isRunning &&
                      !message.content ? (
                        <StatusBadge variant="accent" label="Speaking" />
                      ) : null}
                    </div>
                  ) : null}
                  {message.content ? (
                    <ChatMarkdownView text={message.content} />
                  ) : activeRoom.isRunning && message.role === "agent" ? (
                    <span className="blink-cursor text-[var(--ah-accent-300)]" />
                  ) : null}
                  {message.role === "agent" ? (
                    <ActivityTrail
                      entries={activityByMessageId[message.id] ?? []}
                      live={activeRoom.isRunning && activeRoom.activeParticipantId === message.agentId}
                    />
                  ) : null}
                </div>
              ))
            )}
          </div>

          {activeRoom.error ? (
            <div className="border-t border-[var(--ah-border-subtle)] px-4 py-2 text-xs ah-fault">
              {activeRoom.error}
            </div>
          ) : null}

          <div className="border-t border-[var(--ah-border-subtle)] p-3">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const text = activeRoom.input;
                void runRoomDiscussion(text);
              }}
            >
              <input
                className="ah-input min-w-0 flex-1"
                value={activeRoom.input}
                disabled={activeRoom.isRunning || selectedParticipants.length < 2}
                placeholder={
                  selectedParticipants.length < 2
                    ? "Add at least two participants…"
                    : "Message the room…"
                }
                onChange={(event) =>
                  updateActiveRoom((room) => ({ ...room, input: event.target.value }))
                }
              />
              <button
                type="submit"
                className="ah-btn ah-btn-default"
                disabled={
                  activeRoom.isRunning ||
                  selectedParticipants.length < 2 ||
                  (!activeRoom.input.trim() && activeRoom.messages.length === 0)
                }
              >
                {activeRoom.isRunning ? "Running…" : "Send"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export const HostedChatroom = Chatroom;
