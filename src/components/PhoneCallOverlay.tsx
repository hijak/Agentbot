import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, PhoneOff, Radio, Volume2 } from "lucide-react";
import { BlobAvatar } from "./andromeda/BlobAvatar";
import {
  loadJaxModel,
  loadVoiceEmbedding,
  speakJaxUtterance,
  stopJaxAudio,
  type JaxProgress,
} from "@/lib/tts/jax-tts";
import { synthesizeCallAudio } from "@/lib/tts/call-audio";
import { BargeInDetector } from "@/lib/call/barge-in";
import { voicesForEngine } from "./TtsSettingsModal";

export type CallPhase = "connecting" | "listening" | "sending" | "speaking";

export interface PhoneCallOverlayProps {
  active: boolean;
  onEndCall: () => void;
  onSendMessage: (text: string) => Promise<boolean>;
  agentName: string;
  avatarSeed?: string;
  avatarSrc?: string | null;
  voice: string;
  onVoiceChange: (voice: string) => void;
  engine: string;
  bargeInEnabled: boolean;
  onToggleBargeIn: (enabled: boolean) => void;
  /** Pass the active bot/assistant streaming text to speak */
  latestAssistantReply?: string;
  isStreamingReply?: boolean;
  sessionId?: string;
}

type TranscriptLine = { role: "user" | "assistant"; text: string; at: string };

/** The banner label for the active synthesis engine. Every selectable
 * engine needs a name here: an unnamed one reads as the system fallback
 * even while its own voice is the one playing. */
function callEngineLabel(engine: string): string {
  if (engine === "jax-js") return "Pocket TTS";
  if (engine === "kokoro") return "Kokoro";
  if (engine === "piper") return "Piper";
  if (engine === "elevenlabs") return "ElevenLabs";
  if (engine === "fish") return "Fish Audio";
  if (engine === "inworld") return "Inworld";
  if (engine === "custom") return "Custom";
  return "System";
}

export function PhoneCallOverlay({
  active,
  onEndCall,
  onSendMessage,
  agentName,
  avatarSeed,
  avatarSrc,
  voice,
  onVoiceChange,
  engine,
  bargeInEnabled,
  onToggleBargeIn,
  latestAssistantReply,
  isStreamingReply,
  sessionId = "local-call",
}: PhoneCallOverlayProps) {
  const [phase, setPhase] = useState<CallPhase>("connecting");
  const [downloadProgress, setDownloadProgress] = useState<JaxProgress | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [micMuted, setMicMuted] = useState(false);
  const [bargeInTriggered, setBargeInTriggered] = useState(false);
  const [conversation, setConversation] = useState<TranscriptLine[]>([]);
  const [callStartedAt, setCallStartedAt] = useState("");
  const [callDirectory, setCallDirectory] = useState("");
  const [savedTranscriptPath, setSavedTranscriptPath] = useState("");
  const [storageNote, setStorageNote] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const bargeInDetectorRef = useRef<BargeInDetector | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const spokenTextRef = useRef<string>("");
  const conversationRef = useRef<TranscriptLine[]>([]);
  const nativeSpeechRef = useRef(false);
  // The engine→voice-list mapping lives with the lists themselves.
  const voiceOptions = voicesForEngine(engine);

  // Format call duration MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Call timer
  useEffect(() => {
    if (!active) {
      setCallDuration(0);
      return;
    }
    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [active]);

  // Voice Barge-in detector initialization
  useEffect(() => {
    if (!active || !bargeInEnabled) {
      bargeInDetectorRef.current?.stop();
      bargeInDetectorRef.current = null;
      return;
    }
    bargeInDetectorRef.current = new BargeInDetector({
      // Speakers leak into the mic: sustained loud energy, not a 150ms
      // blip, plus a grace window while AEC converges. Headphone users
      // can still interrupt by speaking over the bot.
      threshold: 0.09,
      consecutiveFrames: 8,
      graceMs: 1200,
    });
    return () => {
      bargeInDetectorRef.current?.stop();
      bargeInDetectorRef.current = null;
    };
  }, [active, bargeInEnabled]);

  // Handle barge-in trigger
  const handleBargeIn = () => {
    setBargeInTriggered(true);
    setTimeout(() => setBargeInTriggered(false), 2000);
    stopPlayback();
    setPhase("listening");
    startSpeechRecognition();
  };

  const stopPlayback = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    stopJaxAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const persistConversation = (lines: TranscriptLine[]) => {
    conversationRef.current = lines;
    setConversation(lines);
    const payload = {
      sessionId,
      agentName,
      startedAt: callStartedAt || new Date().toISOString(),
      lines,
    };
    if (window.ogb?.phoneCalls?.saveTranscript) {
      void window.ogb.phoneCalls.saveTranscript(payload).then((result) => {
        setSavedTranscriptPath(result.path);
      }).catch(() => setStorageNote("Transcript is visible here but could not be saved locally."));
    } else {
      try {
        localStorage.setItem(`agentbot-phone-call:${sessionId}`, JSON.stringify(payload));
      } catch {
        setStorageNote("Transcript is visible here but browser storage is unavailable.");
      }
    }
  };

  const appendTranscript = (role: TranscriptLine["role"], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const last = conversationRef.current.at(-1);
    if (last?.role === role && last.text === clean) return;
    persistConversation([...conversationRef.current, { role, text: clean, at: new Date().toISOString() }]);
  };

  // Start speech recognition
  const startSpeechRecognition = () => {
    if (typeof window === "undefined" || micMuted) return;
    if (window.ogb?.speechStart) {
      nativeSpeechRef.current = true;
      setPhase("listening");
      void window.ogb.speechStart({ endpointMs: 850 }).catch(() => {
        setStorageNote("The microphone could not start. Check Microphone and Speech Recognition access.");
      });
      return;
    }
    nativeSpeechRef.current = false;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setPhase("listening");
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setPhase("listening");
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setLiveTranscript(finalTranscript || interimTranscript);

        if (finalTranscript.trim()) {
          handleUserUtterance(finalTranscript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          console.warn("Speech recognition error:", event.error);
        }
      };

      recognition.onend = () => {
        if (phase === "listening" && active && !micMuted) {
          try {
            recognition.start();
          } catch {
            // ignore
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("Failed to start speech recognition:", err);
    }
  };

  const stopSpeechRecognition = () => {
    if (nativeSpeechRef.current) {
      void window.ogb?.speechStop();
      nativeSpeechRef.current = false;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  };

  const handleUserUtterance = async (text: string) => {
    stopSpeechRecognition();
    appendTranscript("user", text);
    setLiveTranscript(text);
    setPhase("sending");
    spokenTextRef.current = "";
    await onSendMessage(text);
  };

  // Connect on call start
  useEffect(() => {
    if (!active) return;
    setPhase("connecting");
    const startedAt = new Date().toISOString();
    setCallStartedAt(startedAt);
    conversationRef.current = [];
    setConversation([]);
    setSavedTranscriptPath("");
    setStorageNote(null);
    spokenTextRef.current = "";

    void window.ogb?.phoneCalls?.directory().then((result) => setCallDirectory(result.path)).catch(() => {});
    const bridge = window.ogb;
    const offTranscript = bridge?.onSpeechTranscript((line) => {
      if (!nativeSpeechRef.current) return;
      if (line.error) {
        setStorageNote("Dictation stopped unexpectedly. Check Microphone and Speech Recognition access.");
        return;
      }
      if (typeof line.text !== "string") return;
      setLiveTranscript(line.text);
      if (line.partial === false && line.text.trim()) void handleUserUtterance(line.text);
    });
    const offEnd = bridge?.onSpeechEnd(({ code }) => {
      if (!nativeSpeechRef.current) return;
      if (code === 2) {
        setStorageNote("Native dictation is unavailable on this platform. Use a Chromium browser with microphone access.");
      } else if (code !== 0) {
        setStorageNote("Microphone or Speech Recognition access was denied.");
      }
    });

    // Capture starts immediately; loading the playback model must not block the mic.
    startSpeechRecognition();

    // Preload voice if jax-js. Every engine shares the one cleanup below:
    // the dictation listeners and mic session belong to the call, not to
    // the engine, and a jax-js-only early return would keep adding
    // transcript listeners on every call until each line fired twice.
    let cancelled = false;
    if (engine === "jax-js") {
      loadJaxModel((progress) => {
        if (!cancelled) setDownloadProgress(progress);
      })
        .then(async () => {
          if (!cancelled) {
            setDownloadProgress(null);
            await loadVoiceEmbedding(voice);
            if (!nativeSpeechRef.current) setPhase("listening");
          }
        })
        .catch((err) => {
          console.error("Failed to load jax-js voice:", err);
          if (!nativeSpeechRef.current) setPhase("listening");
        });
    } else {
      if (!nativeSpeechRef.current) setPhase("listening");
    }

    return () => {
      cancelled = true;
      offTranscript?.();
      offEnd?.();
      void window.ogb?.speechStop();
      nativeSpeechRef.current = false;
    };
  }, [active, engine]);

  // When agent is streaming a reply or finishes
  useEffect(() => {
    if (!active || !latestAssistantReply) return;

    const newText = latestAssistantReply.slice(spokenTextRef.current.length).trim();
    if (!newText || isStreamingReply) return;

    // Full sentence ready to speak
    spokenTextRef.current = latestAssistantReply;
    appendTranscript("assistant", latestAssistantReply);
    setPhase("speaking");
    stopSpeechRecognition();

    // Activate Barge-In detector while speaking
    if (bargeInEnabled && bargeInDetectorRef.current) {
      void bargeInDetectorRef.current.start(handleBargeIn);
    }

    const abort = new AbortController();
    abortControllerRef.current = abort;

    const speak = async () => {
      try {
        if (engine === "jax-js") {
          await speakJaxUtterance(latestAssistantReply, {
            voice,
            signal: abort.signal,
          });
        } else if (
          engine === "kokoro" ||
          engine === "piper" ||
          engine === "system" ||
          engine === "elevenlabs" ||
          engine === "fish" ||
          engine === "inworld" ||
          engine === "custom"
        ) {
          const blob = await synthesizeCallAudio(latestAssistantReply, voice, engine, abort.signal);
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          await new Promise<void>((resolve) => {
            const finish = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onended = finish;
            audio.onerror = finish;
            abort.signal.addEventListener("abort", () => {
              audio.pause();
              finish();
            }, { once: true });
            audio.play().catch(finish);
          });
        } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
          await new Promise<void>((resolve) => {
            const utterance = new SpeechSynthesisUtterance(latestAssistantReply);
            const voices = window.speechSynthesis.getVoices();
            const matched = voices.find(
              (v) =>
                v.name.toLowerCase() === voice.toLowerCase() ||
                v.voiceURI.toLowerCase() === voice.toLowerCase(),
            );
            if (matched) utterance.voice = matched;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
          });
        }
      } catch (err) {
        if (!abort.signal.aborted) {
          console.warn("Speech playback error:", err);
        }
      } finally {
        // Only the latest run owns shared state: a superseded run must not
        // stop the next run's detector or flip the phase back to listening.
        if (abortControllerRef.current === abort) {
          abortControllerRef.current = null;
          bargeInDetectorRef.current?.stop();
        }
        if (active && !abort.signal.aborted) {
          setPhase("listening");
          startSpeechRecognition();
        }
      }
    };

    void speak();

    return () => {
      // A newer reply (or unmount) supersedes this one: halt its audio
      // without touching state owned by the next run.
      if (abortControllerRef.current === abort) abortControllerRef.current = null;
      abort.abort();
    };
  }, [active, latestAssistantReply, isStreamingReply, engine, voice, bargeInEnabled]);

  // Cleanup when call ends
  useEffect(() => {
    if (!active) {
      stopPlayback();
      stopSpeechRecognition();
      bargeInDetectorRef.current?.stop();
    }
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-between bg-[var(--ah-surface-base)]/98 p-6 backdrop-blur-md animate-fade-in">
      {/* Top Header */}
      <div className="flex w-full max-w-2xl items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-2.5 rounded-full bg-[var(--ah-accent-400)] animate-pulse" />
          <span className="ah-mono text-xs uppercase tracking-wider text-[var(--ah-text-muted)]">
            Phone Call · {formatDuration(callDuration)}
          </span>
        </div>

        {/* Quick Voice Switcher */}
        <div className="flex items-center gap-2">
          <select
            value={voice}
            onChange={(e) => onVoiceChange(e.target.value)}
            className="rounded-none border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] px-2.5 py-1 text-xs ah-mono uppercase text-[var(--ah-text-primary)] focus:outline-none focus:border-[var(--ah-accent-400)]"
            title="Character voice"
          >
            {voiceOptions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          {/* Barge-in badge */}
          <button
            type="button"
            onClick={() => onToggleBargeIn(!bargeInEnabled)}
            className={`flex items-center gap-1.5 rounded-none px-2.5 py-1 text-xs ah-mono uppercase tracking-wider transition-all border ${
              bargeInEnabled
                ? "bg-[var(--ah-accent-alpha)] text-[var(--ah-accent-300)] border-[var(--ah-accent-400)]"
                : "bg-[var(--ah-surface-raised)] text-[var(--ah-text-secondary)] border-[var(--ah-border-subtle)] hover:border-[var(--ah-border-bright)]"
            }`}
            title={bargeInEnabled ? "Voice Barge-In is ENABLED (click to disable)" : "Voice Barge-In is DISABLED (click to enable)"}
          >
            <span className={`ah-badge-dot ${bargeInEnabled ? "bg-[var(--ah-accent-300)]" : "bg-[var(--ah-text-faint)]"}`} />
            Barge-in: {bargeInEnabled ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Center Avatar & Status */}
      <div className="flex flex-col items-center text-center max-w-md w-full my-auto space-y-6">
        {/* Pulsing Avatar Container */}
        <div className="relative flex items-center justify-center">
          {phase === "speaking" && (
            <div className="absolute size-40 rounded-full border border-[var(--ah-accent-400)]/40 animate-ping" />
          )}
          {phase === "listening" && (
            <div className="absolute size-36 rounded-full border border-[var(--ah-accent-300)]/30 animate-pulse" />
          )}
          <div className="relative z-10 size-28 rounded-full ring-4 ring-[var(--ah-border-base)] shadow-2xl overflow-hidden flex items-center justify-center bg-[var(--ah-surface-raised)]">
            <BlobAvatar
              seed={avatarSeed || agentName}
              src={avatarSrc}
              label={agentName}
              size={112}
            />
          </div>
        </div>

        <div>
          <h2 className="ah-mono text-xl font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
            {agentName}
          </h2>
          <p className="text-xs text-[var(--ah-text-muted)] mt-1">
            Voice: {voiceOptions.find((v) => v.id === voice)?.name ?? voice} · {callEngineLabel(engine)}
          </p>
        </div>

        {/* Dynamic Status / Progress Bar */}
        <div className="w-full">
          {downloadProgress && downloadProgress.phase === "downloading" ? (
            <div className="rounded-none border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="ah-mono uppercase text-[var(--ah-accent-300)] font-semibold">Downloading voice model</span>
                <span className="ah-mono text-[var(--ah-text-muted)]">
                  {downloadProgress.percent ?? 0}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-none bg-[var(--ah-border-subtle)] overflow-hidden">
                <div
                  className="h-full bg-[var(--ah-accent-300)] transition-all duration-300"
                  style={{ width: `${downloadProgress.percent ?? 0}%` }}
                />
              </div>
              <p className="text-[11px] text-[var(--ah-text-secondary)]">
                Cached locally in browser storage for instant future calls.
              </p>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-none border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] px-4 py-1.5 text-xs ah-mono uppercase tracking-wider text-[var(--ah-text-secondary)]">
              {phase === "connecting" && <Loader2 size={13} className="animate-spin text-[var(--ah-accent-300)]" />}
              {phase === "listening" && <Mic size={13} className="text-[var(--ah-accent-300)] animate-pulse" />}
              {phase === "sending" && <Radio size={13} className="text-[var(--ah-warning)] animate-spin" />}
              {phase === "speaking" && <Volume2 size={13} className="text-[var(--ah-accent-300)]" />}
              <span>
                {phase === "connecting"
                  ? "Connecting call…"
                  : phase === "listening"
                    ? "Listening… speak to interrupt"
                    : phase === "sending"
                      ? "Thinking…"
                      : "Speaking…"}
              </span>
            </div>
          )}
        </div>

        {/* Live speech transcription or barge-in alert */}
        <div className="min-h-[48px] w-full text-center">
          {bargeInTriggered && (
            <div className="animate-fade-in inline-flex items-center gap-1.5 text-xs text-[var(--ah-accent-200)] ah-mono uppercase font-semibold bg-[var(--ah-accent-alpha)] px-3 py-1 rounded-none border border-[var(--ah-accent-400)]">
              ⚡ Voice barge-in: Speech detected, listening to you
            </div>
          )}
          {!bargeInTriggered && liveTranscript && (
            <p className="text-xs text-[var(--ah-text-secondary)] italic">
              “{liveTranscript}”
            </p>
          )}
        </div>

        <div className="w-full space-y-2 text-left">
          <label htmlFor="phone-call-transcript" className="ah-mono text-[10px] uppercase tracking-wider text-[var(--ah-text-muted)]">
            Conversation transcript
          </label>
          <textarea
            id="phone-call-transcript"
            readOnly
            value={conversation.map((line) => `${line.role === "user" ? "You" : agentName}: ${line.text}`).join("\n\n")}
            placeholder="Your conversation will appear here as text."
            className="h-28 w-full resize-none rounded-none border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] p-3 text-xs leading-relaxed text-[var(--ah-text-primary)] outline-none"
            aria-label="Phone call conversation transcript"
          />
          <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--ah-text-muted)]">
            <span className="truncate" title={savedTranscriptPath || callDirectory}>{storageNote ?? (savedTranscriptPath ? `Saved locally · ${savedTranscriptPath}` : callDirectory ? `Saving to ${callDirectory}…` : "Saving locally…")}</span>
            {window.ogb?.pickFolder && (
              <button
                type="button"
                className="shrink-0 underline hover:text-[var(--ah-text-primary)]"
                onClick={() => void window.ogb?.pickFolder?.(callDirectory).then((chosen) => {
                  if (!chosen || !window.ogb?.phoneCalls?.setDirectory) return;
                  return window.ogb.phoneCalls.setDirectory(chosen).then((result) => setCallDirectory(result.path));
                })}
              >
                Change save folder
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center gap-6 pb-4">
        {/* Mute Button */}
        <button
          type="button"
          onClick={() => {
            const next = !micMuted;
            setMicMuted(next);
            if (next) stopSpeechRecognition();
            else startSpeechRecognition();
          }}
          className={`flex size-13 items-center justify-center rounded-full border transition-all ${
            micMuted
              ? "border-[var(--ah-fault-400)] bg-[var(--ah-fault-400)] text-white"
              : "border-[var(--ah-border-base)] bg-[var(--ah-surface-raised)] text-[var(--ah-text-primary)] hover:bg-[var(--ah-surface-hover)]"
          }`}
          title={micMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={() => {
            stopPlayback();
            stopSpeechRecognition();
            onEndCall();
          }}
          className="flex size-16 items-center justify-center rounded-full bg-[var(--ah-fault-400)] text-white shadow-xl hover:brightness-110 active:scale-95 transition-all"
          title="End phone call (Esc)"
        >
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}
