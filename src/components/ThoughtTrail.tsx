import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRight } from "lucide-react";
import type { ActivityEntry } from "./ActivityTrail";

// Chat-status rendering built on the React Bits Pro AI agent kit patterns
// (src/components/blocks/ai-chat-1.tsx and tool-calls-1.tsx): the reasoning
// disclosure from ai-chat-1 for the agent's train of thought, and the
// tool-call card from tool-calls-1 for each tool step. Props match
// ActivityTrail so the two are interchangeable. The app is permanently dark
// (main.tsx pins html.dark), so the palette is dark-only.

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// Same lazy Shiki recipe as ChatMarkdown's CodeBlock: highlight off the
// critical path, cache by content, and keep the plain <pre> if it fails.
const highlightCache = new Map<string, string>();
const CACHE_MAX = 80;

function CodePane({ text, lang }: { text: string; lang: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    const key = `${lang}:${text}`;
    const cached = highlightCache.get(key);
    if (cached) {
      setHtml(cached);
      return;
    }
    let alive = true;
    import("shiki")
      .then((shiki) =>
        shiki.codeToHtml(text, {
          lang,
          themes: { light: "github-light-default", dark: "github-dark-default" },
          defaultColor: "light-dark()",
        }),
      )
      .then((out) => {
        if (!alive) return;
        if (highlightCache.size >= CACHE_MAX) {
          const first = highlightCache.keys().next().value;
          if (first) highlightCache.delete(first);
        }
        highlightCache.set(key, out);
        setHtml(out);
      })
      .catch(() => {
        /* unknown language or shiki failed — the plain <pre> stays */
      });
    return () => {
      alive = false;
    };
  }, [text, lang]);
  if (html) {
    return (
      <div
        className="[&>pre]:m-0 [&>pre]:rounded-[var(--rb-r-sm,6px)] [&>pre]:bg-neutral-900! [&>pre]:p-3 [&>pre]:font-mono [&>pre]:text-xs [&>pre]:leading-relaxed [&_pre_code]:font-mono [&_pre_code]:text-xs"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <pre className="max-h-40 overflow-auto whitespace-pre rounded-[var(--rb-r-sm,6px)] bg-neutral-900 p-3 font-mono text-xs leading-relaxed text-neutral-300">
      {text}
    </pre>
  );
}

/** Best-effort language for a tool argument payload or result blob. */
function langForArgs(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "text";
  try {
    JSON.parse(trimmed);
    return "json";
  } catch {
    /* not JSON — fall through */
  }
  if (trimmed.startsWith("$") || /^[\w./-]+\s+(--?\w+|\S+)/.test(trimmed)) return "bash";
  return "text";
}

const PLACEHOLDER_THOUGHT = /^(thinking|working)\s*(…|\.{3})?$/i;
const MIN_ECHO_CHARS = 16;

function normalizeThought(text: string): string {
  return text
    .replace(/(…|\.{3})\s*$/, "")
    .replace(/[*_`#>~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * True when a status line carries no reasoning of its own: the seeded
 * "Thinking…" placeholder, or text that just repeats (part of) the reply —
 * some runtimes stream the answer through their reasoning channel too.
 */
export function isHollowThought(line: string, reply = ""): boolean {
  if (PLACEHOLDER_THOUGHT.test(line.trim())) return true;
  const thought = normalizeThought(line);
  if (!thought) return true;
  const answer = normalizeThought(reply);
  if (!answer) return false;
  if (thought === answer) return true;
  if (answer.includes(thought)) return thought.length >= MIN_ECHO_CHARS;
  if (thought.includes(answer)) return answer.length >= MIN_ECHO_CHARS;
  return false;
}

type CardStatus = "running" | "done" | "failed";

function statusFor(entry: ActivityEntry): { status: CardStatus; word: string } {
  if (entry.kind === "approval_request") return { status: "running", word: "Waiting" };
  if (entry.state === "error" || entry.kind === "error") return { status: "failed", word: "Failed" };
  if (entry.state === "active") return { status: "running", word: "Running" };
  return { status: "done", word: "Done" };
}

function Dot({ status }: { status: CardStatus }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        status === "running" && "animate-pulse bg-amber-400 motion-reduce:animate-none",
        status === "done" && "bg-emerald-500",
        status === "failed" && "bg-red-500",
      )}
    />
  );
}

function ThinkingDots() {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1 w-1 animate-pulse rounded-full bg-neutral-500 motion-reduce:animate-none"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

/** Reasoning disclosure — ai-chat-1's ReasoningRow, fed by the status stream. */
function ThinkingRow({
  live,
  seconds,
  lines,
}: {
  live: boolean;
  seconds: number | null;
  lines: string[];
}) {
  const [open, setOpen] = useState(live);
  useEffect(() => {
    if (live) setOpen(true);
  }, [live]);
  const label = live ? (
    <>
      <span className="text-neutral-300">Thinking</span>
      <ThinkingDots />
    </>
  ) : (
    <>
      Thought for <span className="tabular-nums">{seconds ?? 1}s</span>
    </>
  );
  if (!lines.length) {
    return (
      <div className="-ml-1.5 inline-flex h-7 items-center gap-1.5 px-1.5 text-[13px] text-neutral-400">
        {label}
      </div>
    );
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="cursor-pointer -ml-1.5 inline-flex h-7 items-center gap-1.5 rounded-[var(--rb-r-sm,6px)] px-1.5 text-[13px] text-neutral-400 transition-colors duration-150 ease-out hover:bg-neutral-800 hover:text-neutral-200 focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]"
      >
        <ChevronRight
          className={cx(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-150 ease-out",
            open && "rotate-90",
          )}
        />
        {label}
        {live && seconds !== null && seconds > 0 ? (
          <span className="tabular-nums">{seconds}s</span>
        ) : null}
      </button>
      {open ? (
        <ul className="mt-2 space-y-1 border-l border-neutral-700 pl-3">
          {lines.map((line, i) => (
            <li
              key={`${i}-${line}`}
              className="max-w-prose text-[13px] leading-relaxed text-neutral-400"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Tool-call card — tool-calls-1's row, fed by one ActivityEntry. Rows with no
 * input and no output have nothing to disclose, so they render as static rows. */
function ToolCallCard({
  entry,
  open,
  onToggle,
}: {
  entry: ActivityEntry;
  open: boolean;
  onToggle: () => void;
}) {
  const { status, word } = statusFor(entry);
  const name =
    entry.toolName ??
    (entry.kind === "error"
      ? "error"
      : entry.kind.startsWith("approval")
        ? "approval"
        : "step");
  const expandable = Boolean(entry.input || entry.output);
  const rowClasses = cx(
    "flex h-9 w-full items-center gap-2 px-2 text-left transition-colors duration-150 ease-out",
    expandable && "cursor-pointer focus-visible:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--rb-accent,oklch(100%_0_0))]",
    open
      ? "rounded-t-[var(--rb-r-md,8px)] hover:bg-neutral-900"
      : "rounded-[var(--rb-r-lg,10px)] border border-neutral-800 bg-neutral-950",
    expandable && !open && "hover:bg-neutral-900 active:bg-neutral-800/70",
  );
  const row = (
    <>
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--rb-r-sm,6px)] bg-neutral-800">
        {expandable ? (
          <ChevronRight
            aria-hidden="true"
            className={cx(
              "h-3.5 w-3.5 text-neutral-400 transition-transform duration-150 ease-out",
              open && "rotate-90",
            )}
          />
        ) : null}
      </span>
      <span className="shrink-0 font-mono text-xs text-neutral-100">{name}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-400">
        {entry.message}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Dot status={status} />
        <span className="text-[13px] text-neutral-400">{word}</span>
      </span>
    </>
  );
  return (
    <div
      className={
        open
          ? "overflow-hidden rounded-[var(--rb-r-lg,10px)] border border-neutral-800 bg-neutral-950"
          : undefined
      }
    >
      {expandable ? (
        <button type="button" aria-expanded={open} onClick={onToggle} className={rowClasses}>
          {row}
        </button>
      ) : (
        <div className={rowClasses}>{row}</div>
      )}
      {open ? (
        <div className="space-y-3 px-3 pb-3 pt-1">
          {entry.input ? (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                Arguments
              </p>
              <CodePane text={entry.input} lang={langForArgs(entry.input)} />
            </div>
          ) : null}
          {entry.output ? (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                Result
              </p>
              <CodePane text={entry.output} lang={langForArgs(entry.output)} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ThoughtTrail({
  entries,
  live = false,
  reply = "",
}: {
  entries: ActivityEntry[];
  live?: boolean;
  reply?: string;
}) {
  const reduced = useReducedMotion();
  const steps = entries.filter((entry) => entry.kind !== "status");
  const statusEntry = entries.find((entry) => entry.kind === "status");

  const [openId, setOpenId] = useState<string | null>(null);
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [seconds, setSeconds] = useState<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const statusMessage = statusEntry?.message;
  useEffect(() => {
    if (!live || !statusMessage) return;
    setThoughts((prev) => (prev.at(-1) === statusMessage ? prev : [...prev, statusMessage]));
  }, [live, statusMessage]);

  useEffect(() => {
    if (live) {
      startedAtRef.current ??= Date.now();
      const timer = window.setInterval(() => {
        if (startedAtRef.current) {
          setSeconds(Math.round((Date.now() - startedAtRef.current) / 1000));
        }
      }, 1000);
      return () => window.clearInterval(timer);
    }
    if (startedAtRef.current) {
      setSeconds(Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)));
      startedAtRef.current = null;
    }
  }, [live]);

  const activeStepId = live
    ? steps.find((step) => step.state === "active" && (step.input || step.output))?.id ?? null
    : null;
  useEffect(() => {
    if (activeStepId) setOpenId(activeStepId);
  }, [activeStepId]);
  useEffect(() => {
    if (!live) setOpenId(null);
  }, [live]);

  const realThoughts = thoughts.filter((line) => !isHollowThought(line, reply));
  const showThinking = realThoughts.length > 0 || (live && !reply.trim());
  if (!steps.length && !showThinking) return null;

  return (
    <div className="space-y-1.5">
      {showThinking ? (
        <ThinkingRow live={live} seconds={seconds} lines={realThoughts} />
      ) : null}
      {steps.map((step) => {
        const card = (
          <ToolCallCard
            entry={step}
            open={openId === step.id}
            onToggle={() => setOpenId((current) => (current === step.id ? null : step.id))}
          />
        );
        if (reduced) return card;
        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          >
            {card}
          </motion.div>
        );
      })}
    </div>
  );
}
