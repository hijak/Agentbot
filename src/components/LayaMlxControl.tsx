import { useEffect, useState } from "react";
import {
  fetchOpenComputerRelay,
  warmOpenComputerExtensionSession,
  type HostedAgent,
  type HostedSession,
  openComputerSurface,
} from "@/lib/agenthosting/client";

type LocalLayaStatus = {
  supported: boolean;
  installed: boolean;
  installing: boolean;
  ready: boolean;
  error?: string;
};

type RelayTask = {
  id: string;
  goal: string;
  finishCondition: string;
  mode: "search" | "form";
  query?: string;
  fields?: Array<{
    label: string;
    operation: "fill" | "autofill" | "checkbox" | "select";
    value?: string;
    checked?: boolean;
  }>;
  submit: boolean;
  confirmConsequential: boolean;
  target: string;
  profile: string;
};

type PageState = {
  url?: string;
  title?: string;
  actions?: Array<{
    id: number;
    tag: string;
    label: string;
    href?: string;
    state?: string;
    role?: string;
    inputType?: string;
    autocomplete?: string;
    hasValue?: boolean;
    checked?: boolean;
    disabled?: boolean;
    options?: string[];
    submit?: boolean;
  }>;
  texts?: Array<{ tag?: string; text?: string }>;
};

const ENABLED_KEY = "agentbot_laya_mlx_enabled";
const SEARCH_HOST = /(^|\.)google\.[a-z.]+$|(^|\.)bing\.com$|(^|\.)duckduckgo\.com$|(^|\.)search\.brave\.com$|(^|\.)search\.yahoo\.com$|(^|\.)kagi\.com$|(^|\.)ecosia\.org$|(^|\.)startpage\.com$/;

async function readLocalStatus(): Promise<LocalLayaStatus> {
  const response = await fetch("/api/laya-mlx/status", { cache: "no-store" });
  if (!response.ok) throw new Error(`Laya-MLX status failed (${response.status})`);
  return response.json() as Promise<LocalLayaStatus>;
}

async function installLocalLaya(): Promise<LocalLayaStatus> {
  const response = await fetch("/api/laya-mlx/install", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const status = await response.json().catch(() => ({})) as LocalLayaStatus;
  if (!response.ok) throw new Error(status.error || `Laya-MLX install failed (${response.status})`);
  return status;
}

function boundedPageState(value: unknown): PageState {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const actions = Array.isArray(source.actions) ? source.actions.slice(0, 150) : [];
  const texts = Array.isArray(source.texts) ? source.texts.slice(0, 40) : [];
  return {
    ...(typeof source.url === "string" ? { url: source.url.slice(0, 1000) } : {}),
    ...(typeof source.title === "string" ? { title: source.title.slice(0, 200) } : {}),
    actions: actions.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const action = item as Record<string, unknown>;
      if (!Number.isInteger(action.id) || typeof action.tag !== "string") return [];
      const state = typeof action.state === "string"
        ? action.state.replace(/\s+value="[^"]*"/gi, " value=\"[redacted]\"").slice(0, 100)
        : undefined;
      return [{
        id: action.id as number,
        tag: action.tag.slice(0, 20),
        label: typeof action.label === "string" ? action.label.slice(0, 180) : "",
        ...(typeof action.href === "string" && /^https?:\/\//i.test(action.href)
          ? { href: action.href.slice(0, 1000) }
          : {}),
        ...(state ? { state } : {}),
        ...(typeof action.role === "string" ? { role: action.role.slice(0, 32).toLowerCase() } : {}),
        ...(typeof action.inputType === "string" ? { inputType: action.inputType.slice(0, 32).toLowerCase() } : {}),
        ...(typeof action.autocomplete === "string" ? { autocomplete: action.autocomplete.slice(0, 80).toLowerCase() } : {}),
        ...(typeof action.hasValue === "boolean" ? { hasValue: action.hasValue } : {}),
        ...(typeof action.checked === "boolean" ? { checked: action.checked } : {}),
        ...(typeof action.disabled === "boolean" ? { disabled: action.disabled } : {}),
        ...(Array.isArray(action.options)
          ? { options: action.options.filter((option): option is string => typeof option === "string").slice(0, 24).map((option) => option.slice(0, 120)) }
          : {}),
        ...(typeof action.submit === "boolean" ? { submit: action.submit } : {}),
      }];
    }),
    texts: texts.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const text = item as Record<string, unknown>;
      return typeof text.text === "string"
        ? [{ tag: typeof text.tag === "string" ? text.tag.slice(0, 20) : undefined, text: text.text.slice(0, 240) }]
        : [];
    }),
  };
}

function choiceCriteria(
  options: Array<{ id: number; description: string }>,
): Record<string, string> {
  const criteria: Record<string, string> = {};
  options.forEach((option, index) => {
    criteria[`option_${index + 1}`] = `Browser element id ${option.id}: ${option.description}`;
  });
  criteria.none = "No safe or relevant option is visible. Do not act.";
  return criteria;
}

async function chooseElement(
  state: PageState,
  instructions: string,
  options: Array<{ id: number; description: string }>,
  signal: AbortSignal,
): Promise<number | null> {
  if (!options.length) return null;
  const candidates = options.slice(0, 16);
  const ask = async (orderedOptions: Array<{ id: number; description: string }>) => {
    const criteria = choiceCriteria(orderedOptions);
    const candidateState = {
      pageHost: (() => {
        try {
          return new URL(state.url || "").hostname.slice(0, 180);
        } catch {
          return "";
        }
      })(),
      candidates: orderedOptions.map((option) => ({
        id: option.id,
        description: option.description.slice(0, 220),
      })),
    };
    const response = await fetch("/api/laya-mlx/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: candidateState, instructions, criteria }),
      signal,
    });
    const result = await response.json().catch(() => ({})) as { answer?: unknown; error?: string };
    if (!response.ok) throw new Error(result.error || `Local Laya decision failed (${response.status})`);
    if (typeof result.answer !== "string" || result.answer === "none") return null;
    const index = Number(result.answer.match(/^option_(\d+)$/)?.[1]) - 1;
    return Number.isInteger(index) && index >= 0 && index < orderedOptions.length
      ? orderedOptions[index].id
      : null;
  };
  const first = await ask(candidates);
  if (first === null || candidates.length === 1) return first;
  // Choice order can affect compact decision models. Accept a selection only
  // when reversing the candidates preserves the same semantic element.
  const reversed = await ask([...candidates].reverse());
  return first === reversed ? first : null;
}

function isSafeSearchField(action: NonNullable<PageState["actions"]>[number], pageUrl = "") {
  if (!["input", "textarea"].includes(action.tag)) return false;
  if (/\bdisabled\b/i.test(action.state || "")) return false;
  if (/type=search\b/i.test(action.state || "")) return true;
  if (!/type=text\b/i.test(action.state || "")) return false;
  if (/\b(search|query|find)\b/i.test(action.label)) return true;
  try {
    return SEARCH_HOST.test(new URL(pageUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function tokenRenewalTime(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".", 1)[0].replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: unknown;
    };
    const expiresAt = Number(payload.exp);
    if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      return Date.now() + Math.max(15_000, expiresAt - Date.now() - 15_000);
    }
  } catch {
    // Use a conservative fallback for an opaque token.
  }
  return Date.now() + 45_000;
}

async function executeTask(
  session: HostedSession,
  surfaceId: string,
  getExtensionToken: () => Promise<string>,
  task: RelayTask,
  signal: AbortSignal,
): Promise<string> {
  const step = async (
    tool: "page_state" | "page_type" | "page_open_link" | "page_click" | "page_select_option",
    args: Record<string, unknown> = {},
  ) => {
    const response = await fetchOpenComputerRelay(
      session,
      surfaceId,
      `/api/v1/laya/tasks/${encodeURIComponent(task.id)}/step`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: task.profile,
          tool,
          arguments: args,
        }),
        signal,
      },
      await getExtensionToken(),
    );
    const body = await response.json().catch(() => ({})) as { result?: unknown; error?: string };
    if (!response.ok) throw new Error(body.error || `Open Computer step failed (${response.status})`);
    return body.result;
  };

  let state = boundedPageState(await step("page_state"));
  if (task.mode === "form") {
    const fields = task.fields ?? [];
    const completed: string[] = [];
    const normalizeLabel = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
    const sensitiveAction = (action: NonNullable<PageState["actions"]>[number]) =>
      action.inputType === "password" ||
      /(?:^|\s)(current-password|new-password|one-time-code|cc-[\w-]+|transaction-amount)(?:\s|$)/i.test(action.autocomplete || "") ||
      /\b(password|passphrase|passcode|secret|token|api key|verification code|one-time code|card|cvv|cvc|security code|bank|routing|iban|swift|account number|payment)\b/i.test(action.label);
    const labelOverlap = (expected: string, observed: string) => {
      const wanted = new Set(expected.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean));
      const actual = new Set(observed.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean));
      if (!wanted.size || !actual.size) return 0;
      let overlap = 0;
      for (const word of wanted) if (actual.has(word)) overlap += 1;
      return overlap / wanted.size;
    };
    const formActionCandidates = (
      field: typeof fields[number],
      predicate: (action: NonNullable<PageState["actions"]>[number]) => boolean,
    ) => {
      const scored = (state.actions ?? [])
        .filter((action) => predicate(action) && !action.disabled)
        .map((action) => ({
          id: action.id,
          score: labelOverlap(field.label, action.label),
          description: [
            action.label,
            `type=${action.inputType || action.tag}`,
            action.autocomplete ? `autocomplete=${action.autocomplete}` : "",
            action.hasValue ? "already filled" : "",
            action.checked ? "checked" : "",
          ].filter(Boolean).join(" · ").slice(0, 220),
        }));
      scored.sort((left, right) => right.score - left.score);
      // Restrict the local model's choice to clearly labelled matches when any
      // exist; otherwise keep every type-matching control so the model can
      // still pick by label. Ranking first also stabilises chooseElement's
      // forward/reversed double-check on forms with many similar controls.
      const strong = scored.filter((entry) => entry.score >= 0.6);
      return (strong.length ? strong : scored).map(({ id, description }) => ({ id, description }));
    };
    const describeCandidates = (
      field: typeof fields[number],
      predicate: (action: NonNullable<PageState["actions"]>[number]) => boolean,
    ) => {
      const labels = formActionCandidates(field, predicate)
        .map((candidate) => (candidate.description.split(" · ")[0] || "").trim())
        .filter(Boolean)
        .slice(0, 6);
      if (labels.length) return ` Visible controls: ${labels.map((label) => `"${label}"`).join(", ")}.`;
      if (field.operation === "select") {
        const closest = (state.actions ?? [])
          .filter((action) => action.inputType === "select" && !action.disabled)
          .sort((left, right) => labelOverlap(field.label, right.label) - labelOverlap(field.label, left.label))[0];
        const options = (closest?.options ?? []).slice(0, 8);
        if (options.length) return ` The closest select offers: ${options.map((option) => `"${option}"`).join(", ")}.`;
      }
      return "";
    };
    const chooseFormAction = async (
      field: typeof fields[number],
      index: number,
      predicate: (action: NonNullable<PageState["actions"]>[number]) => boolean,
      signal: AbortSignal,
    ) => chooseElement(
      state,
      `For requested form field ${index + 1} labelled "${field.label}", choose the one matching visible control. Do not inspect or repeat any field value. Choose none if no clear match.`,
      formActionCandidates(field, predicate),
      signal,
    );

    const failures: string[] = [];
    for (let index = 0; index < fields.length; index += 1) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const field = fields[index];
      const actionPredicate = (action: NonNullable<PageState["actions"]>[number]) => {
        const type = action.inputType || "";
        if (field.operation === "fill") {
          return ["text", "email", "tel", "url", "number", "search", "textarea"].includes(type) &&
            !sensitiveAction(action);
        }
        if (field.operation === "autofill") {
          return ["text", "email", "tel", "url", "number", "search", "textarea", "password", "select"].includes(type) &&
            action.hasValue === true;
        }
        if (field.operation === "checkbox") return type === "checkbox" || action.role === "checkbox";
        if (field.operation === "select") {
          return type === "select" && !sensitiveAction(action) &&
            (action.options ?? []).some((option) => normalizeLabel(option) === normalizeLabel(field.value || ""));
        }
        return false;
      };
      try {
        const inputId = await chooseFormAction(field, index, actionPredicate, signal);
        if (inputId === null) {
          throw new Error(field.operation === "autofill"
            ? `No already-filled hosted-browser autofill value was found for "${field.label}". Fill it in the hosted browser or ask the user for a non-sensitive value.`
            : `Laya could not safely match the requested "${field.label}" field.${describeCandidates(field, actionPredicate)}`);
        }
        const observed = (state.actions ?? []).find((action) => action.id === inputId);
        if (!observed) throw new Error("The selected form field is no longer visible. Refresh page state and retry.");

        if (field.operation === "autofill") {
          // Never read back or send the autofilled value to the local model.
          completed.push(field.label);
          continue;
        }
        if (field.operation === "fill") {
          const typed = await step("page_type", {
            id: inputId,
            field_index: index,
            text: field.value,
            clear: true,
            submit: false,
          }) as { verified?: boolean } | undefined;
          if (typed?.verified !== true) {
            throw new Error(`Laya could not verify the value for "${field.label}".`);
          }
        } else if (field.operation === "checkbox") {
          if (observed.checked !== field.checked) {
            await step("page_click", {
              id: inputId,
              field_index: index,
              checked: field.checked,
            });
          }
        } else if (field.operation === "select") {
          const selected = await step("page_select_option", {
            id: inputId,
            field_index: index,
            label: field.value,
          }) as { selected?: string } | undefined;
          if (!selected?.selected || normalizeLabel(selected.selected) !== normalizeLabel(field.value || "")) {
            throw new Error(`Laya could not verify the requested "${field.label}" option.`);
          }
        }
        completed.push(field.label);
        state = boundedPageState(await step("page_state"));
        if (field.operation === "checkbox") {
          const verifiedId = await chooseFormAction(
            field,
            index,
            (action) => actionPredicate(action) && action.checked === field.checked,
            signal,
          );
          if (verifiedId === null) {
            throw new Error(`Laya could not verify the "${field.label}" checkbox state.`);
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        // One unmatched field must not discard work on the others; report it
        // (with the visible controls so the requesting agent can adjust its
        // label) and keep filling the remaining fields.
        failures.push(error instanceof Error ? error.message : String(error));
        try {
          state = boundedPageState(await step("page_state"));
        } catch {
          // Keep the last snapshot; stale element ids fail safely at the relay gate.
        }
      }
    }

    // Front-load the verdict: chat-side context compression can truncate or
    // rewrite result text, so the outcome must lead the message.
    const failureSummary = failures.length
      ? ` Could not complete: ${failures.map((failure) => failure.replace(/\s+/g, " ").trim()).join(" | ")}`.slice(0, 600)
      : "";
    if (failures.length) {
      return `Not submitted (field failures): filled ${completed.length} of ${fields.length} requested form field(s).${failureSummary}`;
    }
    if (!task.submit) {
      return `Not submitted (not requested): filled ${completed.length} of ${fields.length} requested form field(s).`;
    }
    const submitCandidates = (state.actions ?? [])
      .filter((action) => action.submit === true && !action.disabled)
      .map((action) => ({
        id: action.id,
        description: `${action.label} ${action.tag}`.trim().slice(0, 220),
      }))
      .slice(0, 16);
    const submitId = await chooseElement(
      state,
      "The user explicitly requested submission. Choose the visible submit control for this form. Choose none if unclear.",
      submitCandidates,
      signal,
    );
    if (submitId === null) {
      return `Not submitted (submit control not identified): filled ${completed.length} of ${fields.length} requested form field(s). Ask whether the user wants normal Open Computer MCP help.`;
    }
    const button = (state.actions ?? []).find((action) => action.id === submitId);
    const consequential = /\b(pay|payments?|purchases?|buy|checkout|orders?|card|credit|debit|cvv|cvc|banks?|transfers?|wire|send|sending|messages?|contact form|posts?|publish(?:ed|es)?|delete|deletion|remove|removal|cancel(?:led|ed|s)?|unsubscribe|share|sharing)\b/i.test([
      task.goal,
      task.target,
      button?.label || "",
      ...fields.map((field) => field.label),
    ].join(" "));
    if (consequential && !task.confirmConsequential) {
      return `Not submitted (needs separate user confirmation): filled ${completed.length} of ${fields.length} requested form field(s). Ask the user before submitting.`;
    }
    await step("page_click", { id: submitId, submit: true });
    return `Submitted: filled ${completed.length} of ${fields.length} requested form field(s).`;
  }

  const searchInputs = (state.actions ?? [])
    .filter((action) => isSafeSearchField(action, state.url))
    .map((action) => ({ id: action.id, description: `${action.label} ${action.state || ""}`.trim() }));
  const inputId = await chooseElement(
    state,
    `Choose a visible text/search field suitable for this exact search query: "${task.query}". Do not choose login, password, email, payment, or unrelated forms. Choose none if the purpose is unclear.`,
    searchInputs,
    signal,
  );
  if (inputId === null) {
    throw new Error("Laya could not safely identify a visible search field.");
  }
  await step("page_type", { id: inputId, text: task.query, clear: true, submit: true });
  await wait(1_000, signal);
  state = boundedPageState(await step("page_state"));

  const links = (state.actions ?? [])
    .filter((action) =>
      action.tag === "a" &&
      Boolean(action.href) &&
      !/\b(sponsored|advertisement|sign in|log in|privacy policy|terms of service)\b/i.test(action.label),
    )
    .map((action) => ({
      id: action.id,
      description: `${action.label || "(untitled link)"} — ${action.href}`.slice(0, 220),
    }))
    .slice(0, 16);
  const target = task.target || task.finishCondition || task.goal;
  const linkId = await chooseElement(
    state,
    `Choose one visible organic search result that best matches this task goal: "${task.goal}". Desired result or finish condition: "${target}". Choose none if no clearly relevant result is visible. Do not choose ads or navigation.`,
    links,
    signal,
  );
  if (linkId === null) {
    return `Search completed for "${task.query}", but Laya did not identify a clearly relevant result. Ask the user if they want to continue with normal Open Computer browser tools.`;
  }
  await step("page_open_link", { id: linkId });
  await wait(800, signal);
  const finalState = boundedPageState(await step("page_state"));
  const excerpt = (finalState.texts ?? [])
    .map((item) => item.text?.replace(/\s+/g, " ").trim())
    .filter((text): text is string => Boolean(text))
    .slice(0, 8)
    .join("\n");
  return [
    `Opened ${finalState.title || "the selected search result"}.`,
    finalState.url ? `URL: ${finalState.url}` : "",
    excerpt ? `Visible page text:\n${excerpt}` : "",
  ].filter(Boolean).join("\n").slice(0, 7_500);
}

export function LayaMlxControl({
  session,
  agent,
}: {
  session: HostedSession;
  agent: HostedAgent;
}) {
  const surfaceId = openComputerSurface(agent)?.surfaceId ?? "";
  const [status, setStatus] = useState<LocalLayaStatus | null>(null);
  const [enabled, setEnabled] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem(ENABLED_KEY) === "true",
  );
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await readLocalStatus();
        if (!cancelled) setStatus(next);
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !status?.installed || !surfaceId) {
      setWorking(false);
      return;
    }
    const controller = new AbortController();
    let extensionToken = "";
    let refreshAt = 0;
    const getExtensionToken = async () => {
      if (!extensionToken || Date.now() >= refreshAt) {
        extensionToken = await warmOpenComputerExtensionSession(session, surfaceId);
        refreshAt = tokenRenewalTime(extensionToken);
      }
      return extensionToken;
    };
    const run = async () => {
      try {
        while (!controller.signal.aborted) {
          const profile = "";
          const response = await fetchOpenComputerRelay(
            session,
            surfaceId,
            `/api/v1/laya/tasks/next?profile=${encodeURIComponent(profile)}`,
            { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(17_000)]) },
            await getExtensionToken(),
          );
          const body = await response.json().catch(() => ({})) as { task?: RelayTask | null; error?: string };
          if (!response.ok) throw new Error(body.error || `Laya relay failed (${response.status})`);
          if (!body.task) {
            setWorking(false);
            setMessage("Connected. Waiting for a browser task…");
            continue;
          }

          setWorking(true);
          setMessage(body.task.mode === "form" ? "Filling the requested form fields…" : `Working: ${body.task.goal}`);
          let result: string;
          try {
            result = await executeTask(session, surfaceId, getExtensionToken, body.task, controller.signal);
          } catch (error) {
            result = controller.signal.aborted
              ? "The local Laya worker was stopped. Ask the user if they want to continue with normal Open Computer browser tools."
              : `Laya could not safely complete this browser task: ${error instanceof Error ? error.message : String(error)}`;
          }
          await fetchOpenComputerRelay(
            session,
            surfaceId,
            `/api/v1/laya/tasks/${encodeURIComponent(body.task.id)}/result`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ profile: body.task.profile, result: result.slice(0, 7_500) }),
              signal: AbortSignal.timeout(10_000),
            },
            await getExtensionToken(),
          );
          if (controller.signal.aborted) break;
          setMessage("Ready for the next browser task.");
          setWorking(false);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setMessage(error instanceof Error ? error.message : String(error));
          setWorking(false);
          window.setTimeout(() => {
            if (!controller.signal.aborted) void run();
          }, 5_000);
        }
      }
    };
    void run();
    return () => controller.abort();
  }, [agent.id, enabled, session, status?.installed, surfaceId]);

  const enableLaya = async () => {
    if (status?.installed) {
      toggle();
      return;
    }
    setInstalling(true);
    setMessage("Setting up the local Apple Silicon runtime and enabling Laya…");
    try {
      setStatus(await installLocalLaya());
      window.localStorage.setItem(ENABLED_KEY, "true");
      setEnabled(true);
      setMessage("Laya is enabled and ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      void readLocalStatus().then(setStatus).catch(() => {});
    } finally {
      setInstalling(false);
    }
  };

  const toggle = () => {
    const next = !enabled;
    window.localStorage.setItem(ENABLED_KEY, String(next));
    setEnabled(next);
    setMessage(next ? "Connecting the local browser worker…" : "Fast browser choices are off.");
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--ah-border-subtle)] px-3 py-2 text-[11px]">
      <span className="font-medium text-[var(--ah-text-secondary)]">Fast browser choices</span>
      {!status ? (
        <span className="text-[var(--ah-text-faint)]">Checking local support…</span>
      ) : !status.supported ? (
        <span className="text-[var(--ah-text-faint)]">macOS Apple Silicon only</span>
      ) : (
        <button
          type="button"
          className={`ah-btn ah-btn-sm ${enabled ? "ah-btn-accent" : "ah-btn-outline"}`}
          aria-pressed={enabled}
          onClick={() => void enableLaya()}
          disabled={installing}
        >
          {installing ? "Setting up…" : enabled ? "On" : status.installed ? "Off" : "Enable Laya"}
        </button>
      )}
      <span className="min-w-0 flex-1 text-[var(--ah-text-faint)]" role="status" aria-live="polite">
        {message || (status?.installed
          ? enabled
            ? working ? "Processing a browser task." : "Local worker is ready."
            : "Model weights download on first use."
          : status?.error || "Opt in to use local browser decisions.")}
      </span>
    </div>
  );
}
