import type { Message } from "@/state/store";
import { t } from "./i18n";
import { displayToolName } from "./tool-activity-style";

/**
 * The one quiet line shown while an agent is working. Matches the dashboard
 * agent trail: Thinking… before a tool starts, then Using {tool}… for the
 * live call. Server narration stays authoritative when present.
 */
export function liveActivityLabel(message?: Message): string {
  if (
    message?.kind !== "activity" ||
    !message.tool ||
    message.tool.ok !== undefined ||
    message.comm
  ) {
    return t("chat.activity.thinking");
  }

  if (message.tool.spoken?.trim()) {
    const trimmed = message.tool.spoken.trim().replace(/[.\s]+$/, "");
    if (!trimmed) return t("chat.activity.thinking");
    return `${trimmed[0].toUpperCase()}${trimmed.slice(1)}`;
  }

  const toolName = displayToolName(message.tool.name);
  if (!toolName) return t("chat.activity.working");
  return t("toolDetail.using", { name: toolName });
}
