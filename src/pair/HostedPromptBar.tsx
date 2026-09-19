import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Attachment01Icon,
  AiComputerIcon,
  Globe02Icon,
  AiUserIcon,
} from "@hugeicons/core-free-icons";
import PromptBar from "@/components/prompt-bar/PromptBar";
import type { HostedBot, HostedChatAttachment, HostedModelOption } from "@/lib/agenthosting/client";
import { prepareHostedImage } from "@/lib/agenthosting/image-files";

export type PromptBarSendPayload = {
  attachments: Array<string | File>;
  model?: { key: string; name: string; tag?: string };
  effort: string;
};

const HOSTED_COMMANDS = [
  { key: "help", name: "/help", description: "List available commands" },
  { key: "status", name: "/status", description: "Show session info" },
  { key: "model", name: "/model", description: "Show or change the model" },
  { key: "reasoning", name: "/reasoning", description: "Change reasoning effort" },
  { key: "retry", name: "/retry", description: "Retry the last message" },
  { key: "undo", name: "/undo", description: "Remove the last exchange" },
  { key: "new", name: "/new", description: "Start a fresh conversation" },
  { key: "stop", name: "/stop", description: "Stop the running agent" },
  { key: "compress", name: "/compress", description: "Compress conversation context" },
  { key: "usage", name: "/usage", description: "Show token usage" },
];

const EFFORTS = ["Low", "Medium", "High", "Extra", "Max"];
// Keep the JSON request comfortably below common proxy limits after base64
// expansion. Images are resized before encoding, while other files are capped
// by the same total budget.
const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
const MAX_ATTACHMENT_PAYLOAD_BYTES = 3 * 1024 * 1024;

function readFileAsAttachment(file: File): Promise<HostedChatAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        base64,
      });
    };
    reader.readAsDataURL(file);
  });
}

async function pickFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*,.pdf,.txt,.md,.csv,.json,.zip";
    input.style.display = "none";
    const cleanup = () => input.remove();
    input.addEventListener("change", () => {
      const files = [...(input.files ?? [])];
      cleanup();
      resolve(files);
    });
    input.addEventListener("cancel", () => {
      cleanup();
      resolve([]);
    });
    document.body.appendChild(input);
    input.click();
  });
}

function dictateOnce(onCancelReady?: (cancel: () => void) => void): Promise<string> {
  const bridge = window.ogb;
  if (bridge?.speechStart && bridge.onSpeechTranscript && bridge.onSpeechEnd) {
    return new Promise((resolve, reject) => {
      let transcript = "";
      let settled = false;
      let offTranscript = () => {};
      let offEnd = () => {};

      const cleanup = () => {
        offTranscript();
        offEnd();
      };
      const settle = (finish: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        finish();
      };
      const cancel = () => {
        if (settled) return;
        settled = true;
        cleanup();
        void bridge.speechStop();
        reject(new Error("Dictation cancelled"));
      };

      onCancelReady?.(cancel);
      offTranscript = bridge.onSpeechTranscript((line) => {
        if (typeof line.text === "string") transcript = line.text;
      });
      offEnd = bridge.onSpeechEnd(({ code, reason }) => {
        if (code === 0) {
          settle(() => resolve(transcript.trim()));
        } else if (code === 2) {
          settle(() => reject(new Error("Dictation is only available on macOS for now.")));
        } else {
          settle(() => reject(new Error(dictationErrorForReason(reason))));
        }
      });
      void bridge.speechStart().catch((err) =>
        settle(() => reject(err instanceof Error ? err : new Error(String(err)))),
      );
    });
  }

  const w = window as Window & {
    SpeechRecognition?: new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: ((event: { error?: string }) => void) | null;
      start: () => void;
      abort?: () => void;
    };
    webkitSpeechRecognition?: new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: ((event: { error?: string }) => void) | null;
      start: () => void;
      abort?: () => void;
    };
  };
  const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;

  if (!SpeechRecognitionCtor) {
    return Promise.reject(new Error("Speech recognition is not available in this browser."));
  }

  return new Promise((resolve, reject) => {
    const recognition = new SpeechRecognitionCtor();
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };
    onCancelReady?.(() => {
      finish(() => {
        recognition.abort?.();
        reject(new Error("Dictation cancelled"));
      });
    });
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      finish(() => resolve(text));
    };
    recognition.onerror = (event) => {
      finish(() => reject(new Error(event.error || "Dictation failed")));
    };
    try {
      recognition.start();
    } catch (err) {
      finish(() => reject(err instanceof Error ? err : new Error(String(err))));
    }
  });
}

function dictationErrorForReason(reason?: string): string {
  switch (reason) {
    case "speech-not-authorized":
      return "macOS denied Speech Recognition for the OpenMausBot speech helper. Enable OpenMausBot or OpenMausBot Speech in System Settings → Privacy & Security → Speech Recognition, then restart Agentbot.";
    case "mic-failed":
      return "macOS could not open the microphone for dictation. Enable Microphone access for OpenMausBot or OpenMausBot Speech in System Settings → Privacy & Security → Microphone.";
    case "recognizer-unavailable":
      return "macOS has no available speech recognizer for the current language. Add a supported dictation language in System Settings and try again.";
    case "helper-build-failed":
      return "The dictation helper could not be built. Install Apple’s Command Line Tools and restart Agentbot.";
    case "helper-start-failed":
      return "The dictation helper could not start. Restart Agentbot and try again.";
    case "recognition-error":
      return "macOS rejected the audio stream. Check Microphone and Speech Recognition access for OpenMausBot or OpenMausBot Speech.";
    default:
      return reason
        ? `Dictation could not start (${reason}). Check Microphone and Speech Recognition access.`
        : "Dictation could not start. Check Microphone and Speech Recognition access.";
  }
}

export async function filesToHostedAttachments(
  files: Array<string | File>,
): Promise<HostedChatAttachment[]> {
  const realFiles = files.filter((f): f is File => typeof f !== "string");
  const out: HostedChatAttachment[] = [];
  let total = 0;
  let encodedTotal = 0;
  for (const file of realFiles.slice(0, 5)) {
    const prepared = await prepareHostedImage(file);
    if (prepared.size + total > MAX_ATTACHMENT_BYTES) {
      throw new Error("Attachments exceed the 6 MB limit.");
    }
    total += prepared.size;
    const attachment = await readFileAsAttachment(prepared);
    const encodedBytes = Math.ceil(attachment.base64.length * 0.75);
    encodedTotal += encodedBytes;
    if (encodedTotal > MAX_ATTACHMENT_PAYLOAD_BYTES) {
      throw new Error("Attachments are too large to send. Try a smaller image or fewer files.");
    }
    out.push(attachment);
  }
  return out;
}

/** Andromeda-styled PromptBar wired to AgentHosting chat actions. */
export function HostedPromptBar({
  models,
  defaultModel,
  bots,
  computerEnabled,
  showComputer,
  onToggleComputer,
  onSelectBot,
  busy,
  onSend,
  onStop,
  onModelChange,
  onEffortChange,
  placeholder,
}: {
  models: HostedModelOption[];
  defaultModel: string;
  bots: HostedBot[];
  computerEnabled: boolean;
  showComputer: boolean;
  onToggleComputer: () => void;
  onSelectBot?: (botName: string) => void;
  busy: boolean;
  onSend: (text: string, payload: PromptBarSendPayload) => void | Promise<void>;
  onStop: () => void;
  onModelChange?: (model: HostedModelOption) => void;
  onEffortChange?: (effort: string) => void;
  placeholder?: string;
}) {
  const dictationCancelRef = useRef<(() => void) | null>(null);
  const [dictationError, setDictationError] = useState<string | null>(null);

  useEffect(() => () => dictationCancelRef.current?.(), []);

  const sources = useMemo(
    () => [
      {
        key: "files",
        name: "Photos & files",
        description: "Upload from this device",
        icon: Attachment01Icon,
        attach: true,
      },
      ...(computerEnabled
        ? [
            {
              key: "computer",
              name: "Open Computer",
              description: showComputer ? "Hide desktop panel" : "Show desktop panel",
              icon: AiComputerIcon,
              action: onToggleComputer,
            },
          ]
        : []),
      {
        key: "web",
        name: "Web search",
        description: "Ask the agent to search the web",
        icon: Globe02Icon,
      },
      ...bots.map((bot) => ({
        key: `bot-${bot.name}`,
        name: bot.name,
        description: bot.title || `Talk with ${bot.name}`,
        icon: AiUserIcon,
        action: onSelectBot ? () => onSelectBot(bot.name) : undefined,
      })),
    ],
    [bots, computerEnabled, onSelectBot, onToggleComputer, showComputer],
  );

  const promptModels = useMemo(
    () =>
      models.map((m) => ({
        key: m.key,
        name: m.name,
        tag: m.tag ?? "",
        provider: m.provider ?? m.tag ?? "Other",
      })),
    [models],
  );

  const handleAttach = useCallback(async () => pickFiles(), []);
  const handleDictate = useCallback(() => {
    setDictationError(null);
    const promise = dictateOnce((cancel) => {
      dictationCancelRef.current = cancel;
    });
    promise.then(
      () => {
        dictationCancelRef.current = null;
      },
      () => {
        dictationCancelRef.current = null;
      },
    );
    return promise;
  }, []);
  const handleDictateStop = useCallback(() => {
    const cancel = dictationCancelRef.current;
    dictationCancelRef.current = null;
    cancel?.();
  }, []);
  const handleDictateError = useCallback((message: string) => {
    if (message !== "Dictation cancelled") setDictationError(message);
  }, []);
  const handleSend = useCallback(
    (text: string, payload: PromptBarSendPayload) => {
      void onSend(text, payload);
    },
    [onSend],
  );

  return (
    <>
      {dictationError && (
        <div className="mb-2 border border-[var(--ah-fault-400)] bg-[var(--ah-fault-alpha)] px-3 py-2 text-xs text-[var(--ah-fault-100)]">
          {dictationError}
        </div>
      )}
      <PromptBar
        className="ah-prompt-bar"
        placeholder={placeholder ?? "Message…"}
        sources={sources}
        commands={HOSTED_COMMANDS}
        models={promptModels}
        defaultModel={defaultModel}
        efforts={EFFORTS}
        defaultEffort="Medium"
        busy={busy}
        onSend={handleSend}
        onStop={onStop}
        onAttach={handleAttach}
        onDictate={handleDictate}
        onDictateStop={handleDictateStop}
        onDictateError={handleDictateError}
        onModelChange={(row: { key: string; name: string; tag?: string }) => {
          onModelChange?.({ key: row.key, name: row.name, tag: row.tag });
        }}
        onEffortChange={onEffortChange}
        background="var(--ah-surface-raised)"
        color="var(--ah-text-primary)"
        menuBackground="var(--ah-surface-overlay)"
        sparkColor="var(--ah-accent-300)"
        width={720}
        radius={0}
        maxRows={6}
      />
    </>
  );
}
