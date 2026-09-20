// A folded stretch of tool chips: one dashboard-style summary chip, click to
// open. Collapsed by default. A search hit inside a run opens it, and a run
// stays open once the user has opened it. Failed steps never enter a folded run.
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Message } from "@/state/store";
import { cn } from "@/lib/cn";
import { describeRun } from "@/lib/activity-runs";
import { summaryEmojisForTools } from "@/lib/tool-activity-style";
import { t } from "@/lib/i18n";

export function ActivityRun({
  messages,
  forceOpen = false,
  children,
}: {
  messages: Message[];
  /** landing on a step inside this run — a search hit cannot scroll to a
   * row that a fold has kept out of the DOM */
  forceOpen?: boolean;
  /** the individual chips, rendered by whichever transcript owns them */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(forceOpen);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const hasError = messages.some((message) => message.tool?.ok === false);
  const emojis = summaryEmojisForTools(
    messages.map((message) => ({ name: message.tool?.name, summary: message.tool?.summary })),
  );
  const summary = describeRun(messages);

  const chip = (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      title={open ? undefined : t("chat.run.showSteps")}
      className={cn(
        "flex w-fit items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] leading-snug shadow-sm backdrop-blur transition-colors",
        hasError
          ? "border-danger/30 bg-danger/10 text-danger hover:bg-danger/15"
          : "border-hairline/60 bg-panel/80 text-ink-secondary hover:bg-raised hover:text-ink",
      )}
    >
      <ChevronRight
        size={12}
        className={cn("shrink-0 transition-transform", open && "rotate-90")}
        aria-hidden
      />
      <span aria-hidden>{hasError ? "❌" : "✅"}</span>
      <span>{summary}</span>
      {emojis.length > 0 ? (
        <span className="opacity-80" aria-hidden>
          {emojis.join(" ")}
        </span>
      ) : null}
    </button>
  );

  if (open) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-start">{chip}</div>
        {children}
      </div>
    );
  }
  return <div className="flex justify-start">{chip}</div>;
}
