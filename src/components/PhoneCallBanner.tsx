import { useEffect, useRef, useState } from "react";
import { FolderOpen, Loader2, Mic, MicOff, PhoneOff, Radio, Volume2 } from "lucide-react";
import { BlobAvatar } from "./andromeda/BlobAvatar";
import {
  loadJaxModel,
  loadVoiceEmbedding,
  speakJaxUtterance,
  stopJaxAudio,
  type JaxProgress,
} from "@/lib/tts/jax-tts";
import { synthesizeCallAudio, type ServerCallEngine } from "@/lib/tts/call-audio";
import { BargeInDetector } from "@/lib/call/barge-in";
import { takeSpeakableChunks } from "@/lib/call/speech-chunks";
import { useFetchedVoices } from "@/lib/tts/engine-voices";
import { voicesForEngine } from "./TtsSettingsModal";

export type CallPhase = "connecting" | "listening" | "sending" | "speaking";

/** Silence that ends the caller's turn. Every millisecond here is dead air
 * before the agent even starts; much below this cuts people off at ordinary
 * mid-sentence pauses. */
const CALL_ENDPOINT_MS = 1200;

const SERVER_CALL_ENGINES = new Set<string>(["kokoro", "piper", "system", "elevenlabs", "fish", "inworld", "custom"]);

function isServerCallEngine(engine: string): engine is ServerCallEngine {
  return SERVER_CALL_ENGINES.has(engine);
}

/** Settles when `work` does or when `signal` aborts. Players that miss a
 * cancellation (a closed AudioContext never fires `ended`) would otherwise
 * hold the speech queue shut into the next call. */
function untilAborted(work: Promise<void>, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    signal.addEventListener("abort", () => resolve(), { once: true });
    work.then(resolve, reject);
  });
}

/** A sentence waiting to be spoken. Server engines start synthesis when the
 * chunk is prepared, so the next sentence renders while the current one plays. */
type PreparedChunk = { text: string; audio?: Promise<Blob> };

export interface PhoneCallBannerProps {
  active: boolean;
  onEndCall: () => void;
  onSendMessage: (text: string) => Promise<boolean>;
  /** Stops the reply that is still generating. Called on barge-in, since
   * speech now starts before the reply finishes. */
  onInterrupt?: () => void;
  /** Receives in-progress dictation so the chat can show it as it's spoken. */
  onLiveTranscript?: (text: string) => void;
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
  /** True when the call opened with a greeting as the latest reply, so it
   * is spoken. Otherwise the latest reply predates the call and stays quiet. */
  speakLatestOnConnect?: boolean;
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

export function PhoneCallBanner({
  active,
  onEndCall,
  onSendMessage,
  onInterrupt,
  onLiveTranscript,
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
  speakLatestOnConnect = false,
  sessionId = "local-call",
}: PhoneCallBannerProps) {
  const [phase, setPhase] = useState<CallPhase>("connecting");
  const [downloadProgress, setDownloadProgress] = useState<JaxProgress | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [micMuted, setMicMutedState] = useState(false);
  /** Read by startSpeechRecognition, which runs from effects and callbacks
   * created before the latest render. */
  const micMutedRef = useRef(false);
  const setMicMuted = (muted: boolean) => {
    micMutedRef.current = muted;
    setMicMutedState(muted);
  };
  const [bargeInTriggered, setBargeInTriggered] = useState(false);
  /** False from the start of a reply until its first sound plays. The text
   * streams in seconds before the audio is ready, and "Speaking…" over that
   * silence reads as the voice having failed. */
  const [voiceAudible, setVoiceAudible] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState("");
  const [callDirectory, setCallDirectory] = useState("");
  const [savedTranscriptPath, setSavedTranscriptPath] = useState("");
  const [storageNote, setStorageNote] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const bargeInDetectorRef = useRef<BargeInDetector | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  /** The prefix of the latest reply that has already been queued for speech. */
  const spokenTextRef = useRef<string>("");
  const speechQueueRef = useRef<string[]>([]);
  /** The signal of the reply whose queue is draining. An aborted signal
   * left here by an earlier reply doesn't count as speaking. */
  const speakingRef = useRef<AbortSignal | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const streamingRef = useRef(false);
  /** True from the first queued sentence of a reply until it has all played. */
  const replyActiveRef = useRef(false);
  /** Set by barge-in: the rest of the interrupted reply stays silent. */
  const replyMutedRef = useRef(false);
  const latestReplyRef = useRef("");
  const conversationRef = useRef<TranscriptLine[]>([]);
  const nativeSpeechRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUtteranceRef = useRef("");
  // Same list as the voice settings modal: the provider's own voices once
  // loaded, otherwise the built-in characters.
  const fetchedVoices = useFetchedVoices(engine, active);
  const voiceOptions = voicesForEngine(engine, fetchedVoices);
  const currentVoiceListed = voiceOptions.some((v) => v.id.toLowerCase() === voice.toLowerCase());

  const setLiveTranscript = (text: string) => onLiveTranscript?.(text);

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
    replyMutedRef.current = true;
    replyActiveRef.current = false;
    if (latestReplyRef.current.trim()) appendTranscript("assistant", latestReplyRef.current);
    // The caller's next turn can't be sent while this reply is still
    // generating, so stop it rather than let it finish unheard.
    if (streamingRef.current) onInterrupt?.();
    stopPlayback();
    setPhase("listening");
    startSpeechRecognition();
  };

  const stopPlayback = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    speechQueueRef.current = [];
    stopJaxAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const persistConversation = (lines: TranscriptLine[]) => {
    conversationRef.current = lines;
    const payload = {
      sessionId,
      agentName,
      startedAt: callStartedAt || new Date().toISOString(),
      lines,
    };
    if (window.ogb?.phoneCalls?.saveTranscript) {
      void window.ogb.phoneCalls.saveTranscript(payload).then((result) => {
        setSavedTranscriptPath(result.path);
      }).catch(() => setStorageNote("Call transcript could not be saved locally."));
    } else {
      try {
        localStorage.setItem(`agentbot-phone-call:${sessionId}`, JSON.stringify(payload));
      } catch {
        setStorageNote("Browser storage is unavailable, so the call transcript isn't saved.");
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
    if (typeof window === "undefined" || micMutedRef.current) return;
    if (window.ogb?.speechStart) {
      nativeSpeechRef.current = true;
      setPhase("listening");
      void window.ogb.speechStart({ endpointMs: CALL_ENDPOINT_MS }).catch(() => {
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

      // Continuous mode keeps listening through pauses; the turn ends only
      // after CALL_ENDPOINT_MS without new words.
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      pendingUtteranceRef.current = "";

      recognition.onstart = () => {
        setPhase("listening");
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        const text = transcript.trim();
        pendingUtteranceRef.current = text;
        setLiveTranscript(text);
        clearSilenceTimer();
        if (!text) return;
        silenceTimerRef.current = setTimeout(() => {
          silenceTimerRef.current = null;
          const utterance = pendingUtteranceRef.current;
          if (utterance) void handleUserUtterance(utterance);
        }, CALL_ENDPOINT_MS);
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          console.warn("Speech recognition error:", event.error);
        }
      };

      recognition.onend = () => {
        // stopSpeechRecognition detaches the ref first, so only an ending
        // the browser chose on its own gets here.
        if (recognitionRef.current !== recognition) return;
        clearSilenceTimer();
        const utterance = pendingUtteranceRef.current;
        if (utterance) {
          void handleUserUtterance(utterance);
          return;
        }
        try {
          recognition.start();
        } catch {
          // ignore
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("Failed to start speech recognition:", err);
    }
  };

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
  };

  const stopSpeechRecognition = () => {
    clearSilenceTimer();
    pendingUtteranceRef.current = "";
    if (nativeSpeechRef.current) {
      void window.ogb?.speechStop();
      nativeSpeechRef.current = false;
    }
    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    }
  };

  const handleUserUtterance = async (text: string) => {
    stopSpeechRecognition();
    appendTranscript("user", text);
    // The sent message replaces the dictation bubble in the chat.
    setLiveTranscript("");
    setPhase("sending");
    spokenTextRef.current = "";
    replyMutedRef.current = false;
    const sent = await onSendMessage(text);
    // A refused send (for example a reply still in flight) would otherwise
    // leave the call on "Thinking…" with the mic off. Read the ref: the call
    // may have ended while the send was pending.
    if (!sent && activeRef.current) {
      setPhase("listening");
      startSpeechRecognition();
    }
  };

  // Per-call state. Runs only when the call opens so an engine switch
  // mid-call can't replay the latest reply. Declared before the reply
  // effect, which reads spokenTextRef in the same commit.
  useEffect(() => {
    if (!active) return;
    setCallStartedAt(new Date().toISOString());
    conversationRef.current = [];
    setSavedTranscriptPath("");
    setStorageNote(null);
    spokenTextRef.current = speakLatestOnConnect ? "" : latestAssistantReply ?? "";
    speechQueueRef.current = [];
    speakingRef.current = null;
    abortControllerRef.current = null;
    replyActiveRef.current = false;
    replyMutedRef.current = false;
    // The banner stays mounted between calls, so a mute left on at the end
    // of the last call would keep this one's mic off.
    setMicMuted(false);
  }, [active]);

  // Connect on call start
  useEffect(() => {
    if (!active) return;
    setPhase("connecting");

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

  const prepareChunk = (text: string, signal: AbortSignal): PreparedChunk => {
    if (!isServerCallEngine(engine)) return { text };
    const audio = synthesizeCallAudio(text, voice, engine, signal);
    // Rejections surface when the chunk plays; don't report them twice.
    audio.catch(() => {});
    return { text, audio };
  };

  const markAudible = (signal: AbortSignal) => {
    if (!signal.aborted) setVoiceAudible(true);
  };

  const playChunk = async ({ text, audio: pendingAudio }: PreparedChunk, signal: AbortSignal) => {
    if (signal.aborted) return;
    if (engine === "jax-js") {
      // Audio streams out frame by frame from the start of generation.
      await speakJaxUtterance(text, {
        voice,
        signal,
        onProgress: (p) => {
          if (p.phase === "generating") markAudible(signal);
        },
      });
    } else if (pendingAudio) {
      const blob = await pendingAudio;
      if (signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await new Promise<void>((resolve) => {
        const finish = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onplaying = () => markAudible(signal);
        audio.onended = finish;
        audio.onerror = finish;
        signal.addEventListener("abort", () => {
          audio.pause();
          finish();
        }, { once: true });
        audio.play().catch(finish);
      });
    } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const matched = voices.find(
          (v) =>
            v.name.toLowerCase() === voice.toLowerCase() ||
            v.voiceURI.toLowerCase() === voice.toLowerCase(),
        );
        if (matched) utterance.voice = matched;
        utterance.onstart = () => markAudible(signal);
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
    }
  };

  const beginReply = () => {
    replyActiveRef.current = true;
    abortControllerRef.current = new AbortController();
    setVoiceAudible(false);
    setPhase("speaking");
    stopSpeechRecognition();
    setLiveTranscript("");
    if (bargeInEnabled && bargeInDetectorRef.current) {
      void bargeInDetectorRef.current.start(handleBargeIn);
    }
  };

  /** Hands the mic back once the reply has finished generating and every
   * queued sentence has played. */
  const finishReplyIfDone = () => {
    const speaking = speakingRef.current && !speakingRef.current.aborted;
    if (!replyActiveRef.current || streamingRef.current || speaking) return;
    if (speechQueueRef.current.length) return;
    replyActiveRef.current = false;
    abortControllerRef.current = null;
    bargeInDetectorRef.current?.stop();
    if (activeRef.current) {
      setPhase("listening");
      startSpeechRecognition();
    }
  };

  const drainSpeechQueue = async () => {
    const signal = abortControllerRef.current?.signal;
    const draining = speakingRef.current && !speakingRef.current.aborted;
    if (draining || !signal || signal.aborted) return;
    speakingRef.current = signal;
    const take = () => {
      const text = speechQueueRef.current.shift();
      return text ? prepareChunk(text, signal) : null;
    };
    try {
      let current = take();
      while (current && !signal.aborted) {
        const upcoming = take();
        try {
          await untilAborted(playChunk(current, signal), signal);
        } catch (err) {
          if (!signal.aborted) {
            console.warn("Speech playback error:", err);
            setStorageNote(`The voice couldn't be generated: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        current = upcoming ?? take();
      }
    } finally {
      if (speakingRef.current === signal) speakingRef.current = null;
    }
    if (!signal.aborted) finishReplyIfDone();
  };

  // Speak each sentence as soon as it has streamed in, rather than waiting
  // for the whole reply.
  useEffect(() => {
    streamingRef.current = Boolean(isStreamingReply);
    latestReplyRef.current = latestAssistantReply ?? "";
    if (!active || !latestAssistantReply) return;
    const final = !isStreamingReply;

    if (!replyMutedRef.current) {
      const alreadyQueued = spokenTextRef.current.length;
      const { chunks, consumed } = takeSpeakableChunks(latestAssistantReply.slice(alreadyQueued), final);
      spokenTextRef.current = latestAssistantReply.slice(0, alreadyQueued + consumed);
      if (chunks.length) {
        if (!replyActiveRef.current) beginReply();
        speechQueueRef.current.push(...chunks);
        void drainSpeechQueue();
      }
    }

    if (final && replyActiveRef.current) {
      appendTranscript("assistant", latestAssistantReply);
      finishReplyIfDone();
    }
  }, [active, latestAssistantReply, isStreamingReply]);

  // Cleanup when call ends
  useEffect(() => {
    if (!active) {
      stopPlayback();
      stopSpeechRecognition();
      bargeInDetectorRef.current?.stop();
      setLiveTranscript("");
    }
  }, [active]);

  if (!active) return null;

  const statusLabel = bargeInTriggered
    ? "Heard you, listening"
    : downloadProgress?.phase === "downloading"
      ? `Downloading voice model · ${downloadProgress.percent ?? 0}%`
      : phase === "connecting"
        ? "Connecting call…"
        : phase === "listening"
          ? micMuted
            ? "Muted"
            : "Listening…"
          : phase === "sending"
            ? "Thinking…"
            : voiceAudible
              ? "Speaking…"
              : "Preparing voice…";
  const audible = phase === "speaking" && voiceAudible;

  const saveHint = storageNote
    ?? (savedTranscriptPath ? `Transcript saved to ${savedTranscriptPath}` : callDirectory ? `Transcripts save to ${callDirectory}` : undefined);

  return (
    <div
      role="region"
      aria-label="Phone call"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--ah-accent-400)]/40 bg-[var(--ah-accent-alpha)] px-4 py-2 animate-fade-in"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="relative shrink-0">
          {audible && (
            <span className="absolute inset-0 rounded-full border border-[var(--ah-accent-400)]/60 animate-ping" />
          )}
          <BlobAvatar seed={avatarSeed || agentName} src={avatarSrc} label={agentName} size={28} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex size-2 shrink-0 rounded-full bg-[var(--ah-accent-400)] animate-pulse" />
            <span className="ah-mono truncate text-xs font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
              On call with {agentName} · {formatDuration(callDuration)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--ah-text-secondary)]">
            {phase === "connecting" && <Loader2 size={11} className="shrink-0 animate-spin text-[var(--ah-accent-300)]" />}
            {phase === "listening" && !micMuted && <Mic size={11} className="shrink-0 text-[var(--ah-accent-300)] animate-pulse" />}
            {phase === "sending" && <Radio size={11} className="shrink-0 text-[var(--ah-warning)] animate-spin" />}
            {phase === "speaking" && !voiceAudible && <Loader2 size={11} className="shrink-0 animate-spin text-[var(--ah-accent-300)]" />}
            {audible && <Volume2 size={11} className="shrink-0 text-[var(--ah-accent-300)]" />}
            <span className="truncate">
              {statusLabel} · Voice: {voiceOptions.find((v) => v.id === voice)?.name ?? voice} · {callEngineLabel(engine)}
            </span>
            {storageNote && <span className="truncate ah-fault" title={storageNote}>· {storageNote}</span>}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <select
          value={voice}
          onChange={(e) => onVoiceChange(e.target.value)}
          className="rounded-none border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] px-2 py-1 text-[11px] ah-mono uppercase text-[var(--ah-text-primary)] focus:outline-none focus:border-[var(--ah-accent-400)]"
          title="Character voice"
          aria-label="Character voice"
        >
          {!currentVoiceListed && voice && <option value={voice}>{voice}</option>}
          {voiceOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onToggleBargeIn(!bargeInEnabled)}
          className={`flex items-center gap-1.5 rounded-none border px-2 py-1 text-[11px] ah-mono uppercase tracking-wider transition-all ${
            bargeInEnabled
              ? "bg-[var(--ah-accent-alpha)] text-[var(--ah-accent-300)] border-[var(--ah-accent-400)]"
              : "bg-[var(--ah-surface-raised)] text-[var(--ah-text-secondary)] border-[var(--ah-border-subtle)] hover:border-[var(--ah-border-bright)]"
          }`}
          title={bargeInEnabled ? "Speaking over the bot interrupts it. Click to turn off." : "Speaking over the bot doesn't interrupt it. Click to turn on."}
        >
          <span className={`ah-badge-dot ${bargeInEnabled ? "bg-[var(--ah-accent-300)]" : "bg-[var(--ah-text-faint)]"}`} />
          Barge-in {bargeInEnabled ? "on" : "off"}
        </button>

        {window.ogb?.pickFolder && (
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full border border-[var(--ah-border-base)] bg-[var(--ah-surface-raised)] text-[var(--ah-text-secondary)] hover:bg-[var(--ah-surface-hover)]"
            title={saveHint ? `${saveHint}. Click to change the folder.` : "Change where call transcripts save"}
            aria-label="Change call transcript folder"
            onClick={() => void window.ogb?.pickFolder?.(callDirectory).then((chosen) => {
              if (!chosen || !window.ogb?.phoneCalls?.setDirectory) return;
              return window.ogb.phoneCalls.setDirectory(chosen).then((result) => setCallDirectory(result.path));
            })}
          >
            <FolderOpen size={14} />
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            const next = !micMuted;
            setMicMuted(next);
            if (next) {
              stopSpeechRecognition();
              setLiveTranscript("");
            } else startSpeechRecognition();
          }}
          className={`flex size-8 items-center justify-center rounded-full border transition-all ${
            micMuted
              ? "border-[var(--ah-fault-400)] bg-[var(--ah-fault-400)] text-white"
              : "border-[var(--ah-border-base)] bg-[var(--ah-surface-raised)] text-[var(--ah-text-primary)] hover:bg-[var(--ah-surface-hover)]"
          }`}
          title={micMuted ? "Unmute microphone" : "Mute microphone"}
          aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
        >
          {micMuted ? <MicOff size={14} /> : <Mic size={14} />}
        </button>

        <button
          type="button"
          onClick={() => {
            stopPlayback();
            stopSpeechRecognition();
            onEndCall();
          }}
          className="flex h-8 items-center gap-1.5 rounded-full bg-[var(--ah-fault-400)] px-3 text-xs font-medium text-white hover:brightness-110 active:scale-95 transition-all"
          title="End phone call"
        >
          <PhoneOff size={14} />
          End
        </button>
      </div>
    </div>
  );
}
