import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Message } from "@/state/store";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { placeLabelKey, type Place } from "@/lib/place";
import { displayToolName, emojiForToolContent } from "@/lib/tool-activity-style";
import { nameIsCommand } from "@/lib/verify-steps";
import { PlaceIcon } from "./PlaceIcon";

/** A quiet disclosure shaped like the dashboard tool trail: emoji status
 * card up front, expandable input/result for people who want the receipt.
 * Old messages and providers without output keep their status and never
 * invent a successful result. */
export function ToolActivity({ tool, place = null }: { tool: NonNullable<Message["tool"]>; place?: Place | null }) {
  const [expanded, setExpanded] = useState(false);
  const failed = tool.ok === false;
  const active = tool.ok === undefined;
  const status = active ? t("toolDetail.running") : failed ? t("toolDetail.failed") : t("toolDetail.completed");
  const toolName = displayToolName(tool.name);
  const preview =
    tool.spoken?.trim() ||
    (tool.summary && tool.summary !== tool.name && !nameIsCommand(tool.name) ? tool.summary : null) ||
    (active ? t("toolDetail.using", { name: toolName }) : t("toolDetail.used", { name: toolName }));
  const emoji = failed ? "❌" : emojiForToolContent(tool.name, preview);

  return (
    <details
      onToggle={(event) => setExpanded(event.currentTarget.open)}
      className="group/tool w-fit max-w-full"
      data-testid="tool-activity"
    >
      <summary
        role="button"
        aria-expanded={expanded}
        aria-label={t("toolDetail.label", { name: tool.name, status })}
        className={cn(
          "flex min-w-0 cursor-pointer list-none items-start gap-2 overflow-hidden rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug shadow-sm backdrop-blur transition-colors [&::-webkit-details-marker]:hidden",
          "hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          failed
            ? "border-danger/30 bg-danger/10 text-danger"
            : active
              ? "border-accent/35 bg-panel text-ink"
              : "border-hairline/60 bg-panel/80 text-ink-secondary",
        )}
      >
        <span className="relative mt-0.5 shrink-0 text-sm leading-none" aria-hidden="true">
          {emoji}
          {active ? (
            <span className="absolute -right-0.5 -top-0.5 size-1.5 animate-ping rounded-full bg-accent" />
          ) : null}
          {!active && !failed ? (
            <span className="absolute -bottom-1 -right-1 text-[9px] leading-none drop-shadow-sm">✅</span>
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {place && (
              <PlaceIcon
                place={place}
                size={12}
                className="shrink-0 opacity-70"
                role="img"
                aria-label={t(placeLabelKey(place))}
                data-testid="tool-place"
              />
            )}
            <span className="min-w-0 truncate font-medium text-ink/90">{toolName}</span>
            <ChevronRight
              size={12}
              className="ml-auto shrink-0 opacity-60 group-open/tool:rotate-90"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 break-words [overflow-wrap:anywhere]">{preview}</div>
        </div>
      </summary>
      <div className="mt-1.5 space-y-3 rounded-lg border border-hairline/40 bg-panel p-3 text-[13px] text-ink-secondary open:w-[min(38rem,100%)]">
        <div className={cn("text-[11px] font-medium", failed && "text-danger")}>{status}</div>
        <div>
          <div className="mb-1 text-[11px] font-medium">{t("toolDetail.input")}</div>
          <pre dir="ltr" className="max-h-52 overflow-auto rounded-lg bg-inset p-2.5 font-mono text-xs whitespace-pre-wrap break-words text-ink">{tool.input ?? tool.summary ?? tool.name}</pre>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium">{t("toolDetail.output")}</div>
          {tool.output ? (
            <pre dir="ltr" className="max-h-64 overflow-auto rounded-lg bg-inset p-2.5 font-mono text-xs whitespace-pre-wrap break-words text-ink">{tool.output}</pre>
          ) : (
            <p className="text-xs">{active ? t("toolDetail.waiting") : t("toolDetail.noOutput")}</p>
          )}
        </div>
        <p className="text-[11px] text-ink-secondary">{t("toolDetail.previewHint")}</p>
      </div>
    </details>
  );
}
