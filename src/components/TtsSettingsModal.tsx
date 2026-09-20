import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Mic, Volume2, VolumeX, X, AlertTriangle } from "lucide-react";
import {
  createStreamingPlayer,
  speakJaxUtterance,
  stopJaxAudio,
  type JaxProgress,
  type StreamingAudioPlayer,
} from "@/lib/tts/jax-tts";
import { CornerMarkers } from "./andromeda/CornerMarkers";
import { StatusBadge } from "./andromeda/StatusBadge";

export interface TtsSettingsModalProps {
  open: boolean;
  onClose: () => void;
  selectedVoice: string;
  onSelectVoice: (voice: string) => void;
  selectedEngine: string;
  onSelectEngine: (engine: string) => void;
  bargeInEnabled: boolean;
  onToggleBargeIn: (enabled: boolean) => void;
  agentName?: string;
}

export const CHARACTER_VOICES = [
  { id: "alba", name: "Alba", desc: "Balanced narrator, warm & clear", sample: "Hello, I'm Alba. I am ready to speak with you on our call." },
  { id: "azelma", name: "Azelma", desc: "Expressive, animated & playful", sample: "Hey there! I'm Azelma. It's great to talk with you!" },
  { id: "cosette", name: "Cosette", desc: "Bright, youthful & clear", sample: "Hi! I'm Cosette. Ready whenever you want to call." },
  { id: "eponine", name: "Eponine", desc: "Lively, energetic & sharp", sample: "Hey! I'm Eponine. Let's get things done together." },
  { id: "fantine", name: "Fantine", desc: "Soft, gentle & compassionate", sample: "Hello. I am Fantine. It is wonderful to speak with you." },
  { id: "javert", name: "Javert", desc: "Deep, stern & authoritative", sample: "I am Javert. Ready for our conversation." },
  { id: "jean", name: "Jean", desc: "Mature, thoughtful & calm", sample: "Greetings, I am Jean. Thoughtful and ready to assist." },
  { id: "marius", name: "Marius", desc: "Friendly, spirited & youthful", sample: "Hello! I'm Marius. Looking forward to our discussion." },
] as const;

export function TtsSettingsModal({
  open,
  onClose,
  selectedVoice,
  onSelectVoice,
  selectedEngine,
  onSelectEngine,
  bargeInEnabled,
  onToggleBargeIn,
  agentName = "Agent",
}: TtsSettingsModalProps) {
  const [samplePlaying, setSamplePlaying] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<JaxProgress | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const playerRef = useRef<StreamingAudioPlayer | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Clean up audio when modal closes or unmounts
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      playerRef.current?.stop();
      playerRef.current = null;
      stopJaxAudio();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!open) return null;

  const stopCurrentPlayback = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    playerRef.current?.stop();
    playerRef.current = null;
    stopJaxAudio();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSamplePlaying(null);
    setDownloadProgress(null);
  };

  const playVoiceSample = async (voiceId: string) => {
    setPlaybackError(null);

    // If already playing this voice, stop it
    if (samplePlaying === voiceId) {
      stopCurrentPlayback();
      return;
    }

    // Stop previous audio
    stopCurrentPlayback();

    const voiceObj = CHARACTER_VOICES.find((v) => v.id === voiceId);
    const text = voiceObj?.sample ?? `Hello, I'm ${voiceId}. Ready for our phone call.`;

    const abort = new AbortController();
    abortRef.current = abort;
    setSamplePlaying(voiceId);
    setDownloadProgress(null);

    if (selectedEngine === "jax-js") {
      // Synchronously create player on user click gesture so browser AudioContext starts unlocked
      const player = createStreamingPlayer();
      playerRef.current = player;

      try {
        await speakJaxUtterance(text, {
          voice: voiceId,
          signal: abort.signal,
          player,
          onProgress: (progress) => {
            setDownloadProgress(progress);
          },
        });
      } catch (err: unknown) {
        if (!abort.signal.aborted) {
          console.error("Failed to synthesize preview audio with jax-js:", err);
          setPlaybackError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!abort.signal.aborted) {
          setSamplePlaying(null);
          setDownloadProgress(null);
          playerRef.current = null;
        }
      }
    } else {
      // System / Web Speech fallback
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.onend = () => setSamplePlaying(null);
        utterance.onerror = () => setSamplePlaying(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setSamplePlaying(null);
      }
    }
  };

  const modal = (
    <div
      role="presentation"
      className="andromeda fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          stopCurrentPlayback();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tts-settings-title"
        className="relative flex max-h-[88vh] w-full max-w-xl flex-col rounded-none border border-[var(--ah-border-base)] bg-[var(--ah-surface-base)] shadow-2xl overflow-hidden"
      >
        <CornerMarkers size={12} offset={-1} borderWidth={1} color="var(--ah-border-bright)" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--ah-border-subtle)] px-5 py-4 bg-[var(--ah-surface-base)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center border border-[var(--ah-accent-400)] bg-[var(--ah-accent-alpha)] text-[var(--ah-accent-300)] rounded-none">
              <Volume2 size={16} />
            </div>
            <div className="min-w-0">
              <h2 id="tts-settings-title" className="ah-mono truncate text-sm font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
                Voice &amp; TTS Settings
              </h2>
              <p className="truncate text-xs text-[var(--ah-text-secondary)]">
                Configure voice engine and phone call options for {agentName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCurrentPlayback();
              onClose();
            }}
            aria-label="Close voice settings"
            className="flex size-7 shrink-0 items-center justify-center border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] text-[var(--ah-text-secondary)] hover:border-[var(--ah-border-bright)] hover:text-[var(--ah-text-primary)] hover:bg-[var(--ah-surface-hover)] rounded-none transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Error Banner if synthesis failed */}
          {playbackError && (
            <div className="border border-[var(--ah-fault-400)] bg-[var(--ah-fault-alpha)] p-3 text-xs text-[var(--ah-fault-100)] flex items-start gap-2.5 rounded-none animate-fade-in">
              <AlertTriangle size={16} className="shrink-0 text-[var(--ah-fault-300)] mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="ah-mono uppercase font-semibold text-[var(--ah-fault-300)] block">Preview Error</span>
                <span className="break-words">{playbackError}</span>
              </div>
            </div>
          )}

          {/* Engine Selection */}
          <section className="space-y-2">
            <label className="ah-micro text-[var(--ah-text-muted)] block">Voice Engine</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onSelectEngine("jax-js")}
                data-active={selectedEngine === "jax-js" ? "true" : "false"}
                className={`group flex flex-col p-3 text-left transition-all rounded-none border ${
                  selectedEngine === "jax-js"
                    ? "border-[var(--ah-accent-400)] bg-[var(--ah-surface-hover)] shadow-[0_0_12px_var(--ah-accent-alpha)]"
                    : "border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] hover:border-[var(--ah-border-bright)] hover:bg-[var(--ah-surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="ah-mono text-xs font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
                    In-Browser (jax-js)
                  </span>
                  {selectedEngine === "jax-js" ? (
                    <StatusBadge variant="accent" label="ACTIVE" />
                  ) : (
                    <span className="text-[10px] ah-mono uppercase text-[var(--ah-text-faint)]">SELECT</span>
                  )}
                </div>
                <span className="mt-1.5 text-xs text-[var(--ah-text-secondary)]">
                  Kyutai Pocket TTS neural model · 8 distinct character voices
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectEngine("system")}
                data-active={selectedEngine === "system" ? "true" : "false"}
                className={`group flex flex-col p-3 text-left transition-all rounded-none border ${
                  selectedEngine === "system"
                    ? "border-[var(--ah-accent-400)] bg-[var(--ah-surface-hover)] shadow-[0_0_12px_var(--ah-accent-alpha)]"
                    : "border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] hover:border-[var(--ah-border-bright)] hover:bg-[var(--ah-surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="ah-mono text-xs font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
                    Web Speech / System
                  </span>
                  {selectedEngine === "system" ? (
                    <StatusBadge variant="accent" label="ACTIVE" />
                  ) : (
                    <span className="text-[10px] ah-mono uppercase text-[var(--ah-text-faint)]">SELECT</span>
                  )}
                </div>
                <span className="mt-1.5 text-xs text-[var(--ah-text-secondary)]">
                  Standard browser speech synthesis
                </span>
              </button>
            </div>
          </section>

          {/* Character Voices */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="ah-micro text-[var(--ah-text-muted)] block">Character Voices</label>
              <span className="ah-mono text-[10px] uppercase text-[var(--ah-text-faint)] tracking-wider">
                8 Kyutai neural voices
              </span>
            </div>

            {/* Weights Download Progress Banner if downloading during preview */}
            {downloadProgress && downloadProgress.phase === "downloading" && (
              <div className="border border-[var(--ah-accent-400)] bg-[var(--ah-surface-raised)] p-3 space-y-2 rounded-none animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="ah-mono uppercase text-[var(--ah-accent-300)] font-semibold flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin" />
                    Downloading Pocket TTS weights for previews…
                  </span>
                  <span className="ah-mono text-[var(--ah-text-primary)] font-bold">
                    {downloadProgress.percent ?? 0}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-none bg-[var(--ah-border-subtle)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--ah-accent-300)] transition-all duration-300"
                    style={{ width: `${downloadProgress.percent ?? 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-[var(--ah-text-muted)]">
                  Downloading neural weights (~100MB). Cached locally in OPFS/Cache API for instant playback.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CHARACTER_VOICES.map((v) => {
                const isSelected = selectedVoice.toLowerCase() === v.id;
                const isPlaying = samplePlaying === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => onSelectVoice(v.id)}
                    data-active={isSelected ? "true" : "false"}
                    className={`flex items-center justify-between p-2.5 cursor-pointer transition-all rounded-none border ${
                      isSelected
                        ? "border-[var(--ah-accent-400)] bg-[var(--ah-surface-hover)]"
                        : "border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] hover:border-[var(--ah-border-bright)] hover:bg-[var(--ah-surface-hover)]"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="ah-mono text-xs font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
                          {v.name}
                        </span>
                        {isSelected && (
                          <StatusBadge variant="accent" label="Active" className="text-[10px] px-1.5 py-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--ah-text-secondary)] truncate mt-0.5">{v.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void playVoiceSample(v.id);
                      }}
                      title={isPlaying ? "Stop sample" : "Play sample with this character voice"}
                      aria-label={isPlaying ? `Stop ${v.name} sample` : `Play ${v.name} sample`}
                      className={`flex size-8 shrink-0 items-center justify-center rounded-none border transition-all ${
                        isPlaying
                          ? "border-[var(--ah-accent-400)] bg-[var(--ah-accent-alpha)] text-[var(--ah-accent-300)] shadow-[0_0_12px_var(--ah-accent-alpha)]"
                          : "border-[var(--ah-border-subtle)] bg-[var(--ah-surface-overlay)] text-[var(--ah-text-secondary)] hover:border-[var(--ah-border-bright)] hover:text-[var(--ah-text-primary)]"
                      }`}
                    >
                      {isPlaying ? (
                        downloadProgress?.phase === "downloading" ? (
                          <Loader2 size={14} className="animate-spin text-[var(--ah-accent-300)]" />
                        ) : (
                          <VolumeX size={14} />
                        )
                      ) : (
                        <Volume2 size={14} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Voice Barge-In Toggle Section */}
          <section className="border border-[var(--ah-border-base)] bg-[var(--ah-surface-raised)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-none">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Mic size={16} className={bargeInEnabled ? "text-[var(--ah-accent-300)]" : "text-[var(--ah-text-muted)]"} />
                <span className="ah-mono text-xs font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
                  Voice Barge-In (Speech Interruption)
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ah-text-secondary)]">
                Acoustic Echo Cancellation (AEC) listens while the bot speaks, letting you naturally interrupt by talking.
              </p>
            </div>

            {/* Andromeda Status Badge + Switch */}
            <div className="flex items-center gap-3 shrink-0">
              <StatusBadge
                variant={bargeInEnabled ? "accent" : "subtle"}
                label={bargeInEnabled ? "ON" : "OFF"}
              />

              <button
                type="button"
                role="switch"
                aria-checked={bargeInEnabled}
                aria-label="Toggle voice barge-in"
                onClick={() => onToggleBargeIn(!bargeInEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-150 ease-in-out focus:outline-none ${
                  bargeInEnabled
                    ? "border-[var(--ah-accent-400)] bg-[var(--ah-accent-300)]"
                    : "border-[var(--ah-border-base)] bg-[var(--ah-surface-active)]"
                }`}
              >
                <span
                  className={`inline-block size-5 transform rounded-full bg-white shadow-md transition duration-150 ease-in-out ${
                    bargeInEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Model Weights Note */}
          <div className="border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] p-3 text-xs text-[var(--ah-text-secondary)] leading-relaxed rounded-none">
            <span className="ah-mono uppercase font-semibold text-[var(--ah-accent-300)]">Neural Audio Previews:</span>{" "}
            Clicking preview downloads the Kyutai Pocket TTS model weights (~100MB) on demand and runs the real character neural voices directly in your browser. All weights are cached locally in OPFS/Cache API so future previews and calls start instantly.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[var(--ah-border-subtle)] bg-[var(--ah-surface-base)] px-5 py-3">
          <button
            type="button"
            onClick={() => {
              stopCurrentPlayback();
              onClose();
            }}
            className="ah-btn rounded-none h-9 px-5"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" && document.body
    ? createPortal(modal, document.body)
    : modal;
}
