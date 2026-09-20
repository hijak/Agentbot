import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { emojiForToolContent } from "@/lib/tool-activity-style";

export type ActivityEntry = {
  id: string;
  kind: "status" | "tool_call" | "tool_result" | "approval_request" | "approval_response" | "error";
  toolName?: string;
  message: string;
  input?: string;
  output?: string;
  state: "active" | "done" | "error";
};

export type ActivityEvent = {
  type: string;
  toolName?: string;
  message?: string;
  input?: string;
  output?: string;
  command?: string;
  denied?: boolean;
};

export type HostedActivityEntry = ActivityEntry;
export type HostedActivityEvent = ActivityEvent;

export function foldActivity(
  entries: ActivityEntry[],
  event: ActivityEvent | { type: "finalize" },
): ActivityEntry[] {
  if (event.type === "finalize") {
    return entries.filter((entry) => entry.kind !== "status").map((entry) =>
      entry.state === "active" ? { ...entry, state: "done" as const } : entry,
    );
  }
  const activity = event as ActivityEvent;
  const message = activity.message?.trim() || (activity.toolName ? `Using ${activity.toolName}…` : "Working…");
  const id = `${activity.type}-${Date.now()}-${entries.length}`;
  if (activity.type === "status") {
    const current = entries.findIndex((entry) => entry.kind === "status" && entry.state === "active");
    if (current >= 0) return entries.map((entry, index) => index === current ? { ...entry, message } : entry);
    return [...entries, { id, kind: "status", message, state: "active" }];
  }
  if (activity.type === "tool_call") {
    return [
      ...entries.filter((entry) => entry.kind !== "status").map((entry) => entry.state === "active" ? { ...entry, state: "done" as const } : entry),
      { id, kind: "tool_call", toolName: activity.toolName, message, input: activity.input, state: "active" },
    ];
  }
  if (activity.type === "tool_result") {
    const active = entries.findIndex((entry) => entry.kind === "tool_call" && entry.state === "active" && (!activity.toolName || entry.toolName === activity.toolName));
    if (active >= 0) return entries.map((entry, index) => index === active ? { ...entry, kind: "tool_result", message: activity.message?.trim() || entry.message, output: activity.output, state: "done" } : entry);
    return [...entries, { id, kind: "tool_result", toolName: activity.toolName, message, output: activity.output, state: "done" }];
  }
  if (activity.type === "approval_request") return [...entries.filter((entry) => entry.kind !== "status"), { id, kind: "approval_request", message: activity.message || "Approval needed", input: activity.command, state: "active" }];
  if (activity.type === "approval_response") return entries.map((entry) => entry.kind === "approval_request" && entry.state === "active" ? { ...entry, kind: "approval_response", message, state: activity.denied ? "error" : "done" } : entry);
  if (activity.type === "error" || activity.type === "retry") return [...entries.filter((entry) => entry.kind !== "status"), { id, kind: "error", message: activity.message || "Something went wrong", state: "error" }];
  return entries;
}

export const foldHostedActivity = foldActivity;

function emoji(entry: ActivityEntry) {
  if (entry.state === "error" || entry.kind === "error") return "❌";
  if (entry.kind === "approval_request") return "❓";
  if (entry.kind === "status") return "🤔";
  return emojiForToolContent(entry.toolName, entry.message);
}

export function ActivityTrail({ entries, live = false }: { entries: ActivityEntry[]; live?: boolean }) {
  const [open, setOpen] = useState(live);
  const [grace, setGrace] = useState(live);
  const hasError = entries.some((entry) => entry.state === "error");
  useEffect(() => {
    if (live) { setOpen(true); setGrace(true); return; }
    const timer = window.setTimeout(() => { setGrace(false); setOpen(false); }, 2200);
    return () => window.clearTimeout(timer);
  }, [live]);
  if (!entries.length) return null;
  const steps = entries.filter((entry) => entry.kind !== "status");
  const summary = `${hasError ? "❌" : "✅"} ${steps.length || entries.length} ${steps.length === 1 ? "step" : "steps"}`;
  return (
    <div className="ah-activity-trail">
      {(!live && !grace) || hasError ? (
        <button type="button" className="ah-activity-summary" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <ChevronRight size={12} className={open ? "rotate-90" : ""} /> {summary} {steps.slice(0, 5).map(emoji).join(" ")}
        </button>
      ) : null}
      {open || live || grace ? (
        <div className="ah-activity-steps">
          {entries.map((entry, index) => (
            <details key={entry.id} className={`ah-activity-step ${entry.state === "error" ? "is-error" : ""}`}>
              <summary><span className="ah-activity-emoji">{emoji(entry)}</span><span className="ah-activity-copy"><span className="ah-micro">Step {index + 1}{entry.toolName ? ` · ${entry.toolName}` : ""}</span><span>{entry.message}</span></span></summary>
              {entry.input || entry.output ? <div className="ah-activity-receipt">{entry.input ? <pre>{entry.input}</pre> : null}{entry.output ? <pre>{entry.output}</pre> : null}</div> : null}
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const HostedActivityTrail = ActivityTrail;
