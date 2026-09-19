export type TaughtTaskEvent = {
  atMs: number;
  description: string;
};

export type TaughtTaskDemonstration = {
  name: string;
  notes: string;
  durationMs: number;
  events: TaughtTaskEvent[];
  screenshots: File[];
};

export type DesktopRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const MAX_TIMELINE_EVENTS = 80;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Describe a click without pretending coordinates are a durable automation target. */
export function describeDesktopClick(
  clientX: number,
  clientY: number,
  rect: DesktopRect,
): string {
  if (rect.width <= 0 || rect.height <= 0) return "Clicked the desktop.";
  const x = clampPercent(((clientX - rect.left) / rect.width) * 100);
  const y = clampPercent(((clientY - rect.top) / rect.height) * 100);
  return `Clicked near ${x}% from the left and ${y}% from the top.`;
}

/** Keep sensitive typed values out of the demonstration transcript. */
export function describeDesktopKey(event: {
  key: string;
  code?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}): string | null {
  const modifier = event.metaKey
    ? "Command"
    : event.ctrlKey
      ? "Control"
      : event.altKey
        ? "Alt"
        : null;
  const namedKeys: Record<string, string> = {
    Enter: "Enter",
    Tab: "Tab",
    Escape: "Escape",
    Backspace: "Backspace",
    Delete: "Delete",
    ArrowUp: "Arrow Up",
    ArrowDown: "Arrow Down",
    ArrowLeft: "Arrow Left",
    ArrowRight: "Arrow Right",
    Home: "Home",
    End: "End",
    PageUp: "Page Up",
    PageDown: "Page Down",
  };

  if (modifier) {
    const key = namedKeys[event.key] ?? (
      event.key.length === 1 ? event.key.toUpperCase() : event.key
    );
    return `Pressed ${modifier}+${event.shiftKey ? "Shift+" : ""}${key}.`;
  }
  if (namedKeys[event.key]) return `Pressed ${namedKeys[event.key]}.`;
  if (event.key.length === 1) return "Typed text (content withheld).";
  return null;
}

function boundedTimeline(events: TaughtTaskEvent[]): TaughtTaskEvent[] {
  if (events.length <= MAX_TIMELINE_EVENTS) return events;
  const head = events.slice(0, 40);
  const tail = events.slice(-(MAX_TIMELINE_EVENTS - head.length));
  return [...head, ...tail];
}

function formatTime(atMs: number): string {
  return `${Math.max(0, Math.round(atMs / 100) / 10).toFixed(1)}s`;
}

export function buildTeachTaskPrompt(demo: TaughtTaskDemonstration): string {
  const events = boundedTimeline(demo.events);
  const timeline = events.length
    ? events.map((event) => `- ${formatTime(event.atMs)}: ${event.description}`).join("\n")
    : "- No input events were captured. Use the screenshots and task description.";
  const screenshotList = demo.screenshots.length
    ? demo.screenshots
        .map((file, index) => `- ${index + 1}. ${file.name}`)
        .join("\n")
    : "- No screenshots were available. Inspect the current computer state if needed.";

  return [
    "[Teach a Task]",
    `I demonstrated this task in Open Computer: ${demo.name.trim()}`,
    demo.notes.trim() ? `Extra guidance: ${demo.notes.trim()}` : "",
    `The demonstration lasted ${formatTime(demo.durationMs)}.`,
    "",
    "Observed interaction timeline:",
    timeline,
    "",
    "Screenshots, in chronological order:",
    screenshotList,
    "",
    "Turn this demonstration into a reusable skill for this agent.",
    "",
    "Requirements:",
    "- Infer semantic steps from the task description, screenshots, and computer state. Click percentages are evidence only; never write a coordinate-replay macro.",
    "- Do not include passwords, tokens, one-time codes, personal data, or typed values. The timeline intentionally withholds typed text.",
    "- Check for an existing skill that already covers this task. Update it only when that is clearly safer than creating a duplicate.",
    "- Use the agent's installed skill-management mechanism when available. Otherwise create a standard SKILL.md in the agent's discovered skills directory.",
    "- Give the skill clear triggers, a numbered procedure, likely failure modes, and a verification step.",
    "- Re-check ambiguous controls using Open Computer before saving. Do not claim a step is reliable if the demonstration does not establish it.",
    "- When finished, report the skill name, where it was saved, and what was verified.",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
}
