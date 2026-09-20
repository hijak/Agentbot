// Per-agent voice profile. The key is shared; the voice and autoplay choice
// belong to the selected bot.
//
// The voice list comes from the harness, which holds cloud provider keys —
// the renderer never talks to ElevenLabs or Fish Audio itself.
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Volume2 } from "lucide-react";

import { api, useStore, type Bot, type ConfigStatus } from "@/state/store";
import { useDesktopCapabilities } from "@/components/DesktopCapabilities";
import {
  activateLocalModel,
  checkLocalModelStatus,
  type UnifiedModelStatus,
} from "@/lib/tts/model-client";
import { speaker } from "@/lib/tts";
import {
  listLocalSystemVoices,
  localSystemVoicesAvailable,
  remoteSystemVoice,
  remoteVoiceProvider,
  setRemoteSystemVoice,
  setRemoteVoiceProvider,
  type RemoteVoiceProvider,
} from "@/lib/local-voice";
import { cn } from "@/lib/cn";
import { voiceKeyDraftValue, type VoiceKeyDraft } from "@/lib/voice-key-draft";
import { Switch } from "./SettingsPrimitives";

const SAMPLE = "Morning. Overnight the tests went green, and I left two notes for you in the thread.";

export function VoiceSettings({
  bot,
  onPatch,
  workspaceConfigurationLocked = false,
}: {
  bot: Bot;
  onPatch: (patch: Partial<Pick<Bot, "voice" | "speakReplies">>) => void;
  workspaceConfigurationLocked?: boolean;
}) {
  const { state, dispatch } = useStore();
  const tts = state.config?.tts;

  const [keyDraft, setKeyDraft] = useState<VoiceKeyDraft>({ provider: null, value: "" });
  const [serverUrl, setServerUrl] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingServer, setSavingServer] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<Array<{ id: string; label: string; description?: string }>>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);

  const { capabilities } = useDesktopCapabilities();
  const localMacClient = workspaceConfigurationLocked && localSystemVoicesAvailable();
  const [deviceProvider, setDeviceProvider] = useState<RemoteVoiceProvider>(() => remoteVoiceProvider());
  const [deviceVoice, setDeviceVoice] = useState(() => remoteSystemVoice(bot.id));
  const usesLocalSystem = localMacClient && deviceProvider === "system";
  // Host configuration still controls host-rendered cloud audio. A
  // paired Mac owns its installed-voice choice locally.
  const provider = tts?.provider ?? "elevenlabs";
  const cloudProvider = provider === "inworld"
    ? {
        id: "inworld" as const,
        name: "Inworld AI",
        credential: "inworldApiKey" as const,
        configField: "inworldKey" as const,
        placeholder: "Paste your Inworld API key",
        keyUrl: "https://docs.inworld.ai/",
      }
    : provider === "fish"
      ? {
          id: "fish" as const,
          name: "Fish Audio",
          credential: "fishAudioKey" as const,
          configField: "fishKey" as const,
          placeholder: "Paste your Fish Audio API key",
          keyUrl: "https://fish.audio/app/api-keys/",
        }
      : provider === "elevenlabs"
        ? {
            id: "elevenlabs" as const,
            name: "ElevenLabs",
            credential: "ttsKey" as const,
            configField: "key" as const,
            placeholder: "Paste your ElevenLabs API key",
            keyUrl: "https://elevenlabs.io/app/settings/api-keys",
          }
        : null;
  const key = cloudProvider ? voiceKeyDraftValue(keyDraft, cloudProvider.id) : "";
  const hostProviderLabel = provider === "inworld"
    ? "Host · Inworld AI"
    : provider === "custom"
      ? "Host · Custom endpoint"
      : provider === "fish"
        ? "Host · Fish Audio"
        : provider === "elevenlabs"
          ? "Host · ElevenLabs"
          : provider === "chatterbox"
            ? "Host · Chatterbox"
            : provider === "jax-js"
              ? "Host · In-browser (jax-js)"
              : provider === "kokoro"
                ? "Host · Kokoro (MLX)"
                : provider === "piper"
                  ? "Host · Piper"
                  : "Host voice";
  const systemVoicesAvailable = capabilities.host.platform === "darwin";
  const kokoroAvailable = capabilities.host.platform === "darwin";
  const hostConfigured = Boolean(tts?.configured);
  const configured = usesLocalSystem || hostConfigured;

  useEffect(() => {
    setDeviceVoice(remoteSystemVoice(bot.id));
  }, [bot.id]);

  useEffect(() => {
    setServerUrl(tts?.baseUrl ?? "");
    setModel(tts?.model ?? "");
  }, [tts?.baseUrl, tts?.model]);

  // Provider selection can also change from a paired phone or another open
  // client. Discard an unsaved draft on every transition, and keep the draft
  // tagged below so a render that lands before this effect still cannot send
  // one provider's credential to another service.
  useEffect(() => {
    setKeyDraft({ provider: null, value: "" });
  }, [provider]);

  useEffect(() => {
    if (usesLocalSystem) {
      const load = () => setVoices(listLocalSystemVoices());
      load();
      window.speechSynthesis.addEventListener("voiceschanged", load);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
    }
    if (!hostConfigured) {
      setVoices([]);
      return;
    }
    let alive = true;
    setLoadingVoices(true);
    api("/api/tts/voices")
      .then((r: { voices?: typeof voices; error?: string }) => {
        if (!alive) return;
        setVoices(r.voices ?? []);
        if (r.error) setError(r.error);
      })
      .catch(() => alive && setVoices([]))
      .finally(() => alive && setLoadingVoices(false));
    return () => {
      alive = false;
    };
  }, [hostConfigured, provider, usesLocalSystem]);

  const chooseDeviceProvider = (next: RemoteVoiceProvider) => {
    setRemoteVoiceProvider(next);
    setDeviceProvider(next);
    setError(null);
  };

  const chooseVoice = (voiceId: string) => {
    if (usesLocalSystem) {
      setRemoteSystemVoice(bot.id, voiceId);
      setDeviceVoice(voiceId);
      return;
    }
    onPatch({ voice: voiceId });
  };

  const [modelStatus, setModelStatus] = useState<UnifiedModelStatus | null>(null);
  const activeActivationRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (provider === "jax-js" || provider === "kokoro" || provider === "piper") {
      void checkLocalModelStatus(provider).then((status) => {
        setModelStatus(status);
      });
    } else {
      setModelStatus(null);
    }
  }, [provider]);

  const setProvider = (next: "elevenlabs" | "fish" | "inworld" | "custom" | "system" | "chatterbox" | "jax-js" | "kokoro" | "piper") => {
    if (next === provider || switching || ((next === "system" || next === "kokoro") && !systemVoicesAvailable)) return;
    setSwitching(true);
    setKeyDraft({ provider: null, value: "" });
    setError(null);

    // Download model weights on activation for local neural engines
    if (next === "jax-js" || next === "kokoro" || next === "piper") {
      activeActivationRef.current?.abort();
      const controller = new AbortController();
      activeActivationRef.current = controller;

      setModelStatus({
        provider: next,
        downloaded: false,
        downloading: true,
        progress: { percent: 0, phase: "downloading" },
      });

      void activateLocalModel(next, {
        signal: controller.signal,
        onProgress: (p) => {
          setModelStatus({
            provider: next,
            downloaded: p.phase === "ready" || (p.percent === 100 && p.phase !== "downloading"),
            downloading: p.phase === "downloading" || p.phase === "initializing",
            progress: p,
          });
        },
      })
        .then(() => {
          setModelStatus({
            provider: next,
            downloaded: true,
            downloading: false,
            progress: { percent: 100, phase: "ready" },
          });
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setModelStatus({
              provider: next,
              downloaded: false,
              downloading: false,
              progress: {
                error: err instanceof Error ? err.message : String(err),
                phase: "failed",
              },
            });
          }
        });
    }

    // the provider is a setting, not a secret — it rides the ordinary
    // config write, and the key row reappears or disappears with it
    api("/api/config", { method: "PUT", body: JSON.stringify({ tts: { provider: next } }) })
      .then((status: ConfigStatus) => dispatch({ type: "configStatus", config: status }))
      .catch((e: Error) => setError(e.message))
      .finally(() => setSwitching(false));
  };

  const saveKey = () => {
    const nextKey = key.trim();
    if (!nextKey || !cloudProvider || keyDraft.provider !== cloudProvider.id) return Promise.resolve();
    setSaving(true);
    setError(null);
    const request = window.ogb?.setCredential
      ? window.ogb.setCredential(cloudProvider.credential, nextKey)
      : api("/api/config", {
          method: "PUT",
          body: JSON.stringify({ tts: { [cloudProvider.configField]: nextKey } }),
        });
    return request
      .then((status: ConfigStatus) => {
        dispatch({ type: "configStatus", config: status });
        setKeyDraft({ provider: null, value: "" });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false));
  };

  const saveServer = () => {
    const next = serverUrl.trim();
    if (!next || savingServer) return Promise.resolve();
    if (!/^https?:\/\//i.test(next)) {
      setError("The server address must start with http:// or https://");
      return Promise.resolve();
    }
    setSavingServer(true);
    setError(null);
    // both fields commit together: an address without its model id (or the
    // reverse) is half a setting
    return api("/api/config", { method: "PUT", body: JSON.stringify({ tts: { baseUrl: next, model: model.trim() } }) })
      .then((status: ConfigStatus) => dispatch({ type: "configStatus", config: status }))
      .catch((e: Error) => setError(e.message))
      .finally(() => setSavingServer(false));
  };

  if (!tts) return null;

  const selectedVoice = usesLocalSystem ? deviceVoice : (bot.voice ?? "");
  const ready = usesLocalSystem || (hostConfigured && Boolean(selectedVoice || tts.voice));

  return (
    <div className="rounded-xl bg-card p-4">
      <div className="text-[15px] font-medium text-ink">Voice</div>
      <div className="mt-0.5 text-[13px] text-ink-secondary">
        {localMacClient
          ? "Choose whether this Mac speaks with its installed voices or audio generated by the host."
          : workspaceConfigurationLocked
            ? "Choose this agent’s voice and spoken-reply preference."
            : <>Give this agent a voice for calls and spoken replies. The voice choice belongs to this agent;
              {provider === "system"
                ? systemVoicesAvailable
                  ? " the voices are the ones already installed on this Mac."
                  : " built-in Mac voices are unavailable here. Switch to a hosted or cross-platform local voice provider to keep using voice."
                : provider === "kokoro"
                  ? " Kokoro runs on Apple Silicon unified memory via MLX."
                  : provider === "piper"
                    ? " the Piper server address is shared by the workspace."
                    : provider === "custom"
                      ? " the custom TTS endpoint address is shared by the workspace."
                      : provider === "chatterbox"
                        ? " the Chatterbox server address is shared by the workspace."
                        : provider === "jax-js"
                          ? " audio is synthesized on-device in your browser using Kyutai Pocket TTS."
                          : ` the ${cloudProvider?.name ?? "voice provider"} key is shared by the workspace.`}</>}
      </div>

      {localMacClient && (
        <div className="mt-4">
          <div className="mb-2 text-[13px] text-ink-secondary">Voice output on this Mac</div>
          <div className="inline-flex rounded-xl bg-inset p-1" role="radiogroup" aria-label="Voice output on this Mac">
            {([
              { value: "system", label: "Built-in Mac voices", available: true },
              { value: "host", label: hostProviderLabel, available: hostConfigured },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={deviceProvider === option.value}
                disabled={!option.available}
                title={!option.available ? "Voice output is not configured on the host" : undefined}
                onClick={() => chooseDeviceProvider(option.value)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-[12.5px] transition-colors disabled:opacity-50",
                  deviceProvider === option.value ? "bg-raised text-ink shadow" : "text-ink-secondary hover:text-ink",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!workspaceConfigurationLocked && (
        <div className="mt-4">
          <div className="mb-2 text-[13px] text-ink-secondary">Voice engine</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-xl bg-inset p-1.5" role="radiogroup" aria-label="Voice engine">
            {([
              { value: "elevenlabs", label: "ElevenLabs", available: true },
              { value: "fish", label: "Fish Audio", available: true },
              { value: "inworld", label: "Inworld AI", available: true },
              { value: "custom", label: "Custom (API)", available: true },
              {
                value: "kokoro",
                label: "Kokoro (MLX)",
                badge: "Apple Silicon",
                available: kokoroAvailable,
                unavailableReason: "Kokoro MLX requires macOS with Apple Silicon",
              },
              {
                value: "system",
                label: "Built-in Mac voices",
                badge: "macOS",
                available: systemVoicesAvailable,
                unavailableReason: "Built-in voices are available only on macOS",
              },
              { value: "jax-js", label: "In-browser (jax-js)", available: true },
              { value: "chatterbox", label: "Chatterbox (local)", available: true },
              { value: "piper", label: "Piper (local)", available: true },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={provider === option.value}
                disabled={switching || !option.available}
                title={!option.available ? option.unavailableReason : undefined}
                onClick={() => setProvider(option.value)}
                className={cn(
                  "flex flex-col items-center justify-center rounded-lg px-2 py-1.5 text-[12px] transition-colors",
                  !option.available && "opacity-40 cursor-not-allowed",
                  provider === option.value
                    ? "bg-raised text-ink shadow font-medium"
                    : option.available
                      ? "text-ink-secondary hover:text-ink"
                      : "text-ink-secondary/60",
                )}
              >
                <span className="truncate max-w-full">{option.label}</span>
                {"badge" in option && (
                  <span
                    className={cn(
                      "mt-0.5 text-[9px] px-1.5 py-0.2 rounded font-mono uppercase tracking-wider",
                      option.available
                        ? "bg-accent/15 text-accent font-semibold"
                        : "bg-hairline/30 text-ink-secondary",
                    )}
                  >
                    {option.available ? option.badge : "macOS only"}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {!workspaceConfigurationLocked && (provider === "jax-js" || provider === "kokoro" || provider === "piper") && (
        <div className="mt-4 rounded-xl border border-hairline/40 bg-inset p-3.5 text-[13px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-ink">
              <span
                className={cn(
                  "size-2 rounded-full",
                  modelStatus?.downloaded
                    ? "bg-success ring-2 ring-success/20"
                    : modelStatus?.downloading
                      ? "bg-accent animate-pulse"
                      : "bg-ink-secondary/40",
                )}
              />
              <span>
                {provider === "jax-js"
                  ? "In-browser Kyutai Pocket TTS"
                  : provider === "kokoro"
                    ? "Kokoro-82M (Apple Silicon MLX)"
                    : "Piper Local Neural TTS"}
              </span>
            </div>
            {modelStatus?.downloaded ? (
              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success flex items-center gap-1">
                <Check size={12} /> Weights Ready
              </span>
            ) : modelStatus?.downloading ? (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" />
                Downloading {modelStatus.progress?.percent ?? 0}%
              </span>
            ) : (
              <span className="rounded-full bg-raised px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                Not Downloaded
              </span>
            )}
          </div>
          <div className="mt-1.5 text-[12px] leading-relaxed text-ink-secondary">
            {provider === "jax-js"
              ? "Runs privately on-device via WebGPU / WebAssembly. Model weights (~100 MB) are downloaded on activation and cached in local storage."
              : provider === "kokoro"
                ? "Runs at >30x real-time speed on Apple Silicon GPU/ANE. Model weights (~312 MB) are downloaded on activation to local storage."
                : "Fast, lightweight CPU neural text-to-speech. Model weights (~63 MB) are downloaded on activation to local storage."}
          </div>

          {modelStatus?.downloading && (
            <div className="mt-2.5 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-ink-secondary font-mono">
                <span>Downloading weights...</span>
                <span>{modelStatus.progress?.percent ?? 0}%</span>
              </div>
              <div className="h-1.5 w-full bg-card rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${modelStatus.progress?.percent ?? 0}%` }}
                />
              </div>
            </div>
          )}

          {modelStatus?.progress?.error && (
            <div className="mt-2 text-[12px] text-danger">
              Download failed: {modelStatus.progress.error}
            </div>
          )}
        </div>
      )}

      {!workspaceConfigurationLocked && cloudProvider && (
        <div className="mt-4">
        <div className="mb-1.5 flex items-center gap-2 text-[13px] text-ink-secondary">
          <span className={cn("size-1.5 rounded-full", configured ? "bg-success" : "bg-raised-hover")} />
          <span>{cloudProvider.name} key</span>
          {configured && <span className="text-[11px] text-success">Connected</span>}
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKeyDraft({ provider: cloudProvider.id, value: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && key.trim() && void saveKey()}
            placeholder={configured ? "••••••••  (paste to replace)" : cloudProvider.placeholder}
            aria-label={`${cloudProvider.name} key`}
            autoComplete="off"
            className="w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
          />
          <button
            onClick={() => void saveKey()}
            disabled={saving || !key.trim()}
            className="flex w-[72px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-control py-2 text-[13px] text-ink hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <><Check size={13} />Save</>}
          </button>
        </div>
        {!configured && (
          <a
            href={cloudProvider.keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block text-[12px] font-medium text-accent hover:underline"
          >
            Get a key from {cloudProvider.name}
          </a>
        )}
        </div>
      )}

      {!workspaceConfigurationLocked && provider === "chatterbox" && (
        <div className="mt-4">
        <div className="mb-1.5 flex items-center gap-2 text-[13px] text-ink-secondary">
          <span className={cn("size-1.5 rounded-full", configured ? "bg-success" : "bg-raised-hover")} />
          <span>Chatterbox server</span>
          {configured && <span className="text-[11px] text-success">Saved</span>}
        </div>
        <div className="flex gap-2">
          <input
            type="url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void saveServer()}
            placeholder="http://127.0.0.1:4123"
            aria-label="Chatterbox server address"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
          />
          <button
            onClick={() => void saveServer()}
            disabled={savingServer || !serverUrl.trim()}
            className="flex w-[72px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-control py-2 text-[13px] text-ink hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingServer ? <Loader2 size={13} className="animate-spin" /> : <><Check size={13} />Save</>}
          </button>
        </div>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void saveServer()}
          placeholder="Model id — default chatterbox-turbo"
          aria-label="Chatterbox model"
          autoComplete="off"
          spellCheck={false}
          className="mt-2 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
        />
        <div className="mt-1.5 text-[11.5px] leading-relaxed text-ink-secondary">
          Any OpenAI-compatible server running Chatterbox works, no key needed.{" "}
          <a
            href="https://github.com/resemble-ai/chatterbox"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            How to run one locally
          </a>
        </div>
        </div>
      )}

      {!workspaceConfigurationLocked && provider === "kokoro" && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[13px] text-ink-secondary">
            <div className="flex items-center gap-2">
              <span className={cn("size-1.5 rounded-full", configured ? "bg-success" : "bg-raised-hover")} />
              <span>Kokoro MLX server</span>
              {configured && <span className="text-[11px] text-success">Saved</span>}
            </div>
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
              Apple Silicon Accelerated
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void saveServer()}
              placeholder="http://127.0.0.1:8880"
              aria-label="Kokoro MLX server address"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
            />
            <button
              onClick={() => void saveServer()}
              disabled={savingServer || !serverUrl.trim()}
              className="flex w-[72px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-control py-2 text-[13px] text-ink hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingServer ? <Loader2 size={13} className="animate-spin" /> : <><Check size={13} />Save</>}
            </button>
          </div>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void saveServer()}
            placeholder="Model id — default kokoro-82m"
            aria-label="Kokoro model"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
          />
          <div className="mt-1.5 text-[11.5px] leading-relaxed text-ink-secondary">
            Runs at &gt;30x real-time speed via Apple Silicon unified memory &amp; MLX. Any OpenAI-compatible server hosting Kokoro-82M works (e.g. Kokoro-FastAPI or mlx-audio on port 8880).
          </div>
        </div>
      )}

      {!workspaceConfigurationLocked && provider === "piper" && (
        <div className="mt-4 text-[12px] text-ink-secondary leading-relaxed">
          Fast, lightweight local neural TTS with low resource overhead. Uses integrated default endpoint <code className="font-mono text-[11px] text-ink">http://127.0.0.1:5000</code>.
        </div>
      )}

      {!workspaceConfigurationLocked && provider === "custom" && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-2 text-[13px] text-ink-secondary">
            <span className={cn("size-1.5 rounded-full", configured ? "bg-success" : "bg-raised-hover")} />
            <span>Custom speech endpoint</span>
            {configured && <span className="text-[11px] text-success">Saved</span>}
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void saveServer()}
              placeholder="http://127.0.0.1:8000/v1/audio/speech"
              aria-label="Custom speech server address"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
            />
            <button
              onClick={() => void saveServer()}
              disabled={savingServer || !serverUrl.trim()}
              className="flex w-[72px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-control py-2 text-[13px] text-ink hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingServer ? <Loader2 size={13} className="animate-spin" /> : <><Check size={13} />Save</>}
            </button>
          </div>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void saveServer()}
            placeholder="Model id — default tts-1"
            aria-label="Custom model"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink placeholder:text-ink-secondary focus:border-hairline focus:outline-none"
          />
          <div className="mt-1.5 text-[11.5px] leading-relaxed text-ink-secondary">
            Connects to any OpenAI-compatible speech endpoint or custom speech API (e.g. LocalAI, vLLM, XTTS, CosyVoice).
          </div>
        </div>
      )}

      {configured && (
        <div className="mt-4">
          <div className="mb-1.5 text-[13px] text-ink-secondary">Voice</div>
          <div className="flex gap-2">
            <select
              value={selectedVoice}
              onChange={(e) => chooseVoice(e.target.value)}
              aria-label={`${bot.name}'s voice`}
              className="w-full rounded-lg border border-hairline/40 bg-inset px-3 py-2 text-[13px] text-ink focus:border-hairline focus:outline-none"
            >
              <option value="">
                {loadingVoices
                  ? "Loading voices…"
                  : usesLocalSystem
                    ? "Mac system default"
                    : tts.voice
                      ? "Workspace default"
                      : "Pick a voice"}
              </option>
              {selectedVoice && !voices.some((voice) => voice.id === selectedVoice) && (
                <option value={selectedVoice}>Current agent voice</option>
              )}
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                  {v.description ? ` — ${v.description}` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => void speaker.speak(SAMPLE, { voiceId: bot.voice, botId: bot.id })}
              disabled={!ready}
              title={ready ? "Hear this voice" : "Pick a voice first"}
              aria-label="Hear this voice"
              className="flex w-[72px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-control py-2 text-[13px] text-ink hover:bg-raised-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Volume2 size={14} /> Try
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-hairline/40 pt-4">
        <div>
          <div className="text-[13px] font-medium text-ink">Read replies aloud</div>
          <div className="mt-0.5 text-[11.5px] leading-relaxed text-ink-secondary">
            Speak this agent's answers as they arrive, even from another chat.
          </div>
        </div>
        <Switch
          checked={Boolean(bot.speakReplies)}
          aria-label="Read this bot's replies aloud"
          onClick={() => onPatch({ speakReplies: !bot.speakReplies })}
        />
      </div>

      {error && <div role="alert" className="mt-2 text-[12px] text-danger">{error}</div>}
    </div>
  );
}
