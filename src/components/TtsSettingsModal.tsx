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
import {
  activateLocalModel,
  checkLocalModelStatus,
  type UnifiedModelStatus,
} from "@/lib/tts/model-client";
import { speakKokoroUtterance } from "@/lib/tts/kokoro-tts";
import { readTtsKey, saveTtsKey } from "@/lib/tts/tts-keys";
import {
  refreshEngineVoices as fetchEngineVoices,
  useFetchedVoices,
  type FetchedVoiceEngine,
  type TtsVoiceOption,
} from "@/lib/tts/engine-voices";
import { useDesktopCapabilities } from "./DesktopCapabilities";
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

export const KOKORO_CHARACTER_VOICES = [
  { id: "af_heart", name: "Heart", desc: "Warm & natural narrator (American Female)", sample: "Hello, I'm Heart. Speaking with Kokoro on Apple Silicon." },
  { id: "af_bella", name: "Bella", desc: "Energetic, clear & expressive (American Female)", sample: "Hey there! I'm Bella. Excited to speak with you!" },
  { id: "af_nicole", name: "Nicole", desc: "Crisp, confident & focused (American Female)", sample: "Hi! I'm Nicole. Ready whenever you want to call." },
  { id: "am_adam", name: "Adam", desc: "Warm, engaging & conversational (American Male)", sample: "Hello! I'm Adam. Looking forward to our discussion." },
  { id: "am_michael", name: "Michael", desc: "Deep, authoritative & rich (American Male)", sample: "Greetings. I am Michael. Ready for our conversation." },
  { id: "bf_emma", name: "Emma", desc: "Bright, articulate & youthful (British Female)", sample: "Hello! I'm Emma. Let's get things done together." },
  { id: "bm_george", name: "George", desc: "Warm, thoughtful & resonant (British Male)", sample: "Good day. I am George. Thoughtful and ready to assist." },
] as const;

export const PIPER_CHARACTER_VOICES = [
  { id: "en_US-lessac-medium", name: "Lessac", desc: "Clear & natural (American Female)", sample: "Hello, I'm Lessac. Ready to speak with you." },
  { id: "en_US-amy-medium", name: "Amy", desc: "Warm & expressive (American Female)", sample: "Hey there! I'm Amy. Let's talk!" },
  { id: "en_US-ryan-medium", name: "Ryan", desc: "Smooth & articulate (American Male)", sample: "Hi, I'm Ryan. Ready for our call." },
  { id: "en_GB-alan-medium", name: "Alan", desc: "Natural & clear (British Male)", sample: "Hello, I am Alan. Looking forward to speaking." },
] as const;

export const SYSTEM_CHARACTER_VOICES = [
  { id: "Samantha", name: "Samantha", desc: "Warm & natural standard macOS voice (American Female)", sample: "Hello, I'm Samantha. Speaking with macOS built-in voice synthesis." },
  { id: "Daniel", name: "Daniel", desc: "Natural & clear narrator (British Male)", sample: "Hello, I am Daniel. Ready for our conversation." },
  { id: "Karen", name: "Karen", desc: "Expressive & articulate (Australian Female)", sample: "G'day! I'm Karen. Ready whenever you want to call." },
  { id: "Fred", name: "Fred", desc: "Classic & distinctive (American Male)", sample: "Hello, I'm Fred. Nice to talk with you." },
  { id: "Moira", name: "Moira", desc: "Warm & rhythmic (Irish Female)", sample: "Hello, I am Moira. Ready to speak with you." },
  { id: "Tessa", name: "Tessa", desc: "Bright & friendly (South African Female)", sample: "Hello, I'm Tessa. Let's get started." },
  { id: "Albert", name: "Albert", desc: "Distinctive & quirky (American Male)", sample: "Hello! My name is Albert." },
  { id: "Ralph", name: "Ralph", desc: "Deep & resonant (American Male)", sample: "Hello, I am Ralph. Ready to assist." },
] as const;

export const ELEVENLABS_CHARACTER_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", desc: "Calm, warm & natural (American Female)", sample: "Hello, I'm Rachel. Powered by ElevenLabs." },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", desc: "Empathic, strong & clear (American Female)", sample: "Hey there! I'm Domi. Ready to speak with you." },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", desc: "Soft, engaging & friendly (American Female)", sample: "Hi! I'm Bella. Excited to speak with you!" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", desc: "Well-rounded, warm & friendly (American Male)", sample: "Hello! I'm Antoni. Ready for our conversation." },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", desc: "Young, clear & lively (American Female)", sample: "Hello! I'm Elli. Let's get things done." },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", desc: "Young, relaxed & casual (American Male)", sample: "Hey, what's up? I'm Josh." },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", desc: "Crisp, authoritative & deep (American Male)", sample: "Greetings. I am Arnold. Ready to assist." },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", desc: "Deep, smooth & conversational (American Male)", sample: "Hello! I'm Adam. Looking forward to our discussion." },
] as const;

export const FISH_CHARACTER_VOICES = [
  { id: "7f4a8e0344b043f4a621757e14f4fc3a", name: "Energy", desc: "Lively & expressive narrator", sample: "Hello! Speaking with Fish Audio." },
  { id: "e58d095865cf43f3806950075b1c9470", name: "Calm", desc: "Soft, soothing & steady", sample: "Hello. I'm here and ready to speak with you." },
] as const;

export const INWORLD_CHARACTER_VOICES = [
  { id: "Sarah", name: "Sarah", desc: "Warm, natural & engaging narrator (American Female)", sample: "Hello, I'm Sarah. Speaking with Inworld AI voice synthesis." },
  { id: "Alex", name: "Alex", desc: "Clear, balanced & conversational (American Male)", sample: "Hello, I'm Alex. Ready for our conversation." },
  { id: "Ashley", name: "Ashley", desc: "Lively, expressive & friendly (American Female)", sample: "Hey there! I'm Ashley. Excited to speak with you!" },
  { id: "Edward", name: "Edward", desc: "Deep, articulate & authoritative (British Male)", sample: "Greetings. I am Edward. Ready to assist." },
  { id: "Elena", name: "Elena", desc: "Soft, graceful & melodic (European Female)", sample: "Hello! I am Elena. Looking forward to our discussion." },
  { id: "Marcus", name: "Marcus", desc: "Authoritative, smooth & resonant (American Male)", sample: "I am Marcus. Ready for our call." },
] as const;

export const CUSTOM_CHARACTER_VOICES = [
  { id: "alloy", name: "Alloy", desc: "Neutral, balanced and clear", sample: "Hello, I'm Alloy. Speaking via your custom speech endpoint." },
  { id: "echo", name: "Echo", desc: "Smooth, warm and conversational", sample: "Hello, I'm Echo. Ready for our call." },
  { id: "fable", name: "Fable", desc: "Expressive with British accent", sample: "Greetings! I'm Fable. Let's get things done." },
  { id: "onyx", name: "Onyx", desc: "Deep, authoritative and resonant", sample: "I am Onyx. Ready for our discussion." },
  { id: "nova", name: "Nova", desc: "Energetic, bright and friendly", sample: "Hey there! I'm Nova. Excited to chat with you!" },
  { id: "shimmer", name: "Shimmer", desc: "Clear, expressive and crisp", sample: "Hi! I'm Shimmer. Ready whenever you need." },
] as const;

export type { TtsVoiceOption };

/** The voice list for one engine: the provider's dynamic list once it has
 * loaded, otherwise the built-in character list. Shared by this modal and
 * the phone-call banner so an engine's list is spelled out once. */
export function voicesForEngine(
  engine: string,
  dynamicVoices?: Record<string, TtsVoiceOption[]>,
): readonly TtsVoiceOption[] {
  if (dynamicVoices?.[engine]?.length) return dynamicVoices[engine];
  if (engine === "kokoro") return KOKORO_CHARACTER_VOICES;
  if (engine === "piper") return PIPER_CHARACTER_VOICES;
  if (engine === "system") return SYSTEM_CHARACTER_VOICES;
  if (engine === "elevenlabs") return ELEVENLABS_CHARACTER_VOICES;
  if (engine === "fish") return FISH_CHARACTER_VOICES;
  if (engine === "inworld") return INWORLD_CHARACTER_VOICES;
  if (engine === "custom") return CUSTOM_CHARACTER_VOICES;
  return CHARACTER_VOICES;
}

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

  const { capabilities } = useDesktopCapabilities();
  const isMac = capabilities.host.platform === "darwin";
  const kokoroAvailable = isMac;
  const systemVoicesAvailable = isMac;

  const [modelStatuses, setModelStatuses] = useState<Record<string, UnifiedModelStatus>>({});
  const activeActivationRef = useRef<AbortController | null>(null);

  // Cloud TTS keys. Each Save also writes them to this machine's local key
  // store so the inputs repopulate after a reopen and phone calls can
  // attach them; the server config and the desktop's OS-encrypted store
  // keep their own copies.
  const [elevenlabsKey, setElevenlabsKey] = useState(() => readTtsKey("elevenlabs"));
  const [savingElevenlabsKey, setSavingElevenlabsKey] = useState(false);
  const [elevenlabsKeySaved, setElevenlabsKeySaved] = useState(false);
  const [elevenlabsConfigured, setElevenlabsConfigured] = useState(false);

  const [fishKey, setFishKey] = useState(() => readTtsKey("fish"));
  const [savingFishKey, setSavingFishKey] = useState(false);
  const [fishKeySaved, setFishKeySaved] = useState(false);
  const [fishConfigured, setFishConfigured] = useState(false);

  const [inworldKey, setInworldKey] = useState(() => readTtsKey("inworld"));
  const [savingInworldKey, setSavingInworldKey] = useState(false);
  const [inworldKeySaved, setInworldKeySaved] = useState(false);
  const [inworldConfigured, setInworldConfigured] = useState(false);
  const [inworldModel, setInworldModel] = useState("inworld-tts-2");

  const [customServerUrl, setCustomServerUrl] = useState("http://127.0.0.1:8000/v1/audio/speech");
  const [customKey, setCustomKey] = useState(() => readTtsKey("custom"));
  const [customModel, setCustomModel] = useState("tts-1");
  const [savingCustomConfig, setSavingCustomConfig] = useState(false);
  const [customConfigSaved, setCustomConfigSaved] = useState(false);
  const [customConfigured, setCustomConfigured] = useState(false);

  const dynamicVoices = useFetchedVoices(selectedEngine, open);

  useEffect(() => {
    if (!open) return;
    for (const engine of ["jax-js", "kokoro", "piper"] as const) {
      void checkLocalModelStatus(engine).then((status) => {
        setModelStatuses((prev) => ({ ...prev, [engine]: status }));
      });
    }
    void fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.tts?.baseUrl === "string" && data.tts.baseUrl.trim() && data.tts.provider === "custom") {
          setCustomServerUrl(data.tts.baseUrl.trim());
        }
        if (data?.tts) {
          if (data.tts.provider === "elevenlabs" && data.tts.configured) {
            setElevenlabsConfigured(true);
          }
          if (data.tts.provider === "fish" && data.tts.configured) {
            setFishConfigured(true);
          }
          if (data.tts.provider === "inworld" && data.tts.configured) {
            setInworldConfigured(true);
          }
          if (data.tts.provider === "custom" && data.tts.configured) {
            setCustomConfigured(true);
          }
          if (typeof data.tts.model === "string" && data.tts.model.trim()) {
            if (data.tts.provider === "inworld") {
              setInworldModel(data.tts.model.trim());
            } else if (data.tts.provider === "custom") {
              setCustomModel(data.tts.model.trim());
            }
          }
        }
      })
      .catch(() => {});
  }, [open]);

  // A provider that lists voices has a working key, so its CONFIGURED flag
  // follows the shared list. Key Saves refetch through refreshEngineVoices.
  useEffect(() => {
    if (dynamicVoices.elevenlabs?.length) setElevenlabsConfigured(true);
    if (dynamicVoices.fish?.length) setFishConfigured(true);
    if (dynamicVoices.inworld?.length) setInworldConfigured(true);
    if (dynamicVoices.custom?.length) setCustomConfigured(true);
  }, [dynamicVoices]);

  const refreshEngineVoices = (engine: FetchedVoiceEngine) => {
    void fetchEngineVoices(engine);
  };

  const handleSaveElevenlabsKey = async () => {
    const k = elevenlabsKey.trim();
    if (!k) return;
    setSavingElevenlabsKey(true);
    setPlaybackError(null);
    try {
      saveTtsKey("elevenlabs", k);
      if (window.ogb?.setCredential) {
        await window.ogb.setCredential("ttsKey", k);
      }
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tts: { key: k, provider: "elevenlabs" } }),
      });
      if (res.ok) {
        setElevenlabsKeySaved(true);
        setElevenlabsConfigured(true);
        setTimeout(() => setElevenlabsKeySaved(false), 2500);
        refreshEngineVoices("elevenlabs");
      }
    } catch {
      // ignore
    } finally {
      setSavingElevenlabsKey(false);
    }
  };

  const handleSaveFishKey = async () => {
    const k = fishKey.trim();
    if (!k) return;
    setSavingFishKey(true);
    setPlaybackError(null);
    try {
      saveTtsKey("fish", k);
      if (window.ogb?.setCredential) {
        await window.ogb.setCredential("fishAudioKey", k);
      }
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tts: { fishKey: k, provider: "fish" } }),
      });
      if (res.ok) {
        setFishKeySaved(true);
        setFishConfigured(true);
        setTimeout(() => setFishKeySaved(false), 2500);
        refreshEngineVoices("fish");
      }
    } catch {
      // ignore
    } finally {
      setSavingFishKey(false);
    }
  };

  const handleSaveInworldKey = async () => {
    const k = inworldKey.trim();
    if (!k) return;
    setSavingInworldKey(true);
    setPlaybackError(null);
    try {
      saveTtsKey("inworld", k);
      if (window.ogb?.setCredential) {
        await window.ogb.setCredential("inworldApiKey", k);
      }
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tts: {
            inworldKey: k,
            provider: "inworld",
            ...(inworldModel ? { model: inworldModel.trim() } : {}),
          },
        }),
      });
      if (res.ok) {
        setInworldKeySaved(true);
        setInworldConfigured(true);
        setTimeout(() => setInworldKeySaved(false), 2500);
        refreshEngineVoices("inworld");
      }
    } catch {
      // ignore
    } finally {
      setSavingInworldKey(false);
    }
  };

  const handleSaveCustomConfig = async () => {
    const url = customServerUrl.trim() || "http://127.0.0.1:8000/v1/audio/speech";
    const k = customKey.trim();
    const m = customModel.trim();
    setSavingCustomConfig(true);
    setPlaybackError(null);
    try {
      saveTtsKey("custom", k);
      if (k && window.ogb?.setCredential) {
        await window.ogb.setCredential("customTtsApiKey", k);
      }
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tts: {
            baseUrl: url,
            provider: "custom",
            ...(k ? { customKey: k } : {}),
            ...(m ? { model: m } : {}),
          },
        }),
      });
      if (res.ok) {
        setCustomConfigSaved(true);
        setCustomConfigured(true);
        setTimeout(() => setCustomConfigSaved(false), 2500);
        refreshEngineVoices("custom");
      }
    } catch {
      // ignore
    } finally {
      setSavingCustomConfig(false);
    }
  };

  const handleSelectEngine = async (engine: string) => {
    // Re-clicking the active engine card is a no-op: skip the config write
    // and the model download it would otherwise restart.
    if (engine === selectedEngine) return;
    onSelectEngine(engine);
    void fetch("/api/config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tts: { provider: engine } }),
    }).catch(() => {});

    if (engine === "jax-js" || engine === "kokoro" || engine === "piper") {
      activeActivationRef.current?.abort();
      const controller = new AbortController();
      activeActivationRef.current = controller;

      setModelStatuses((prev) => ({
        ...prev,
        [engine]: {
          provider: engine as any,
          downloaded: false,
          downloading: true,
          progress: { percent: 0, phase: "downloading" },
        },
      }));

      try {
        await activateLocalModel(engine, {
          signal: controller.signal,
          onProgress: (p) => {
            setModelStatuses((prev) => ({
              ...prev,
              [engine]: {
                provider: engine as any,
                downloaded: p.phase === "ready" || (p.percent === 100 && p.phase !== "downloading"),
                downloading: p.phase === "downloading" || p.phase === "initializing",
                progress: p,
              },
            }));
          },
        });
        setModelStatuses((prev) => ({
          ...prev,
          [engine]: {
            provider: engine as any,
            downloaded: true,
            downloading: false,
            progress: { percent: 100, phase: "ready" },
          },
        }));
      } catch (err) {
        if (!controller.signal.aborted) {
          setModelStatuses((prev) => ({
            ...prev,
            [engine]: {
              provider: engine as any,
              downloaded: false,
              downloading: false,
              progress: {
                error: err instanceof Error ? err.message : String(err),
                phase: "failed",
              },
            },
          }));
        }
      }
    }
  };

  // The shared preview tail: POST to /api/tts/speak — with the request's
  // own (possibly unsaved draft) key — then play the returned audio. Every
  // server-synthesized engine branch uses these two, so the error shape
  // and the object-URL cleanup stay identical across engines.
  const speakOnServer = async (
    body: Record<string, unknown>,
    signal: AbortSignal,
    label: string,
    keyPrompt?: string,
  ): Promise<Blob> => {
    const res = await fetch("/api/tts/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 409 && keyPrompt) throw new Error(errData.error || keyPrompt);
      throw new Error(errData.error || `${label} failed (${res.status})`);
    }
    return res.blob();
  };

  const playBlob = (blob: Blob) =>
    new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      const finish = () => {
        URL.revokeObjectURL(url);
        setSamplePlaying(null);
      };
      audio.onended = finish;
      audio.onerror = finish;
      audio.play().then(resolve, reject);
    });

  const playVoiceSample = async (voiceId: string) => {
    setPlaybackError(null);

    // If already playing this voice, stop it
    if (samplePlaying === voiceId) {
      stopCurrentPlayback();
      return;
    }

    // Stop previous audio
    stopCurrentPlayback();

    const activeList = voicesForEngine(selectedEngine, dynamicVoices);
    const voiceObj = activeList.find((v) => v.id.toLowerCase() === voiceId.toLowerCase());
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
    } else if (selectedEngine === "kokoro") {
      try {
        let blob: Blob;
        try {
          blob = await speakKokoroUtterance(text, {
            voice: voiceId,
            signal: abort.signal,
          });
        } catch (clientErr) {
          if (abort.signal.aborted) return;
          // Fall back to server-side local Kokoro synthesis
          const res = await fetch("/api/tts/speak", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text, voiceId, provider: "kokoro" }),
            signal: abort.signal,
          });
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `Kokoro preview failed: ${clientErr instanceof Error ? clientErr.message : String(clientErr)}`);
          }
          blob = await res.blob();
        }

        if (abort.signal.aborted) return;
        await playBlob(blob);
      } catch (err: unknown) {
        if (!abort.signal.aborted) {
          console.error("Failed to synthesize preview audio with Kokoro:", err);
          setPlaybackError(err instanceof Error ? err.message : String(err));
          setSamplePlaying(null);
        }
      }
    } else if (selectedEngine === "piper") {
      try {
        const blob = await speakOnServer(
          {
            text,
            voiceId,
            provider: "piper",
          },
          abort.signal,
          "Piper synthesis",
        );
        if (abort.signal.aborted) return;
        await playBlob(blob);
      } catch (err: unknown) {
        if (!abort.signal.aborted) {
          console.error("Failed to synthesize preview audio with Piper:", err);
          setPlaybackError(err instanceof Error ? err.message : String(err));
          setSamplePlaying(null);
        }
      }
    } else if (selectedEngine === "system") {
      try {
        const blob = await speakOnServer(
          {
            text,
            voiceId,
            provider: "system",
          },
          abort.signal,
          "System voice synthesis",
        );
        if (abort.signal.aborted) return;
        await playBlob(blob);
      } catch (err: unknown) {
        if (!abort.signal.aborted) {
          console.warn("Server system TTS speak failed, falling back to window.speechSynthesis:", err);
          if (typeof window !== "undefined" && "speechSynthesis" in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            const voices = window.speechSynthesis.getVoices();
            const matchedVoice = voices.find(
              (v) =>
                v.name.toLowerCase() === voiceId.toLowerCase() ||
                v.name.toLowerCase().includes(voiceId.toLowerCase()) ||
                v.voiceURI.toLowerCase() === voiceId.toLowerCase(),
            );
            if (matchedVoice) {
              utterance.voice = matchedVoice;
            }
            utterance.rate = 1.0;
            utterance.onend = () => setSamplePlaying(null);
            utterance.onerror = () => setSamplePlaying(null);
            window.speechSynthesis.speak(utterance);
          } else {
            setPlaybackError(err instanceof Error ? err.message : String(err));
            setSamplePlaying(null);
          }
        }
      }
    } else if (selectedEngine === "elevenlabs" || selectedEngine === "fish") {
      try {
        const key = selectedEngine === "elevenlabs" ? elevenlabsKey.trim() : fishKey.trim();
        const blob = await speakOnServer(
          {
            text,
            voiceId,
            provider: selectedEngine,
            ...(key ? { key } : {}),
          },
          abort.signal,
          `${selectedEngine} synthesis`,
          `Please configure your ${selectedEngine === "elevenlabs" ? "ElevenLabs" : "Fish Audio"} API key above to preview voices.`,
        );
        if (abort.signal.aborted) return;
        await playBlob(blob);
      } catch (err: unknown) {
        if (!abort.signal.aborted) {
          console.error(`Failed to synthesize preview audio with ${selectedEngine}:`, err);
          setPlaybackError(err instanceof Error ? err.message : String(err));
          setSamplePlaying(null);
        }
      }
    } else if (selectedEngine === "inworld") {
      try {
        const key = inworldKey.trim();
        const blob = await speakOnServer(
          {
            text,
            voiceId,
            provider: "inworld",
            ...(key ? { key } : {}),
            ...(inworldModel ? { model: inworldModel.trim() } : {}),
          },
          abort.signal,
          "Inworld synthesis",
          "Please configure your Inworld API key above to preview voices.",
        );
        if (abort.signal.aborted) return;
        await playBlob(blob);
      } catch (err: unknown) {
        if (!abort.signal.aborted) {
          console.error("Failed to synthesize preview audio with Inworld:", err);
          setPlaybackError(err instanceof Error ? err.message : String(err));
          setSamplePlaying(null);
        }
      }
    } else if (selectedEngine === "custom") {
      try {
        const url = customServerUrl.trim() || "http://127.0.0.1:8000/v1/audio/speech";
        const key = customKey.trim();
        const model = customModel.trim();
        const blob = await speakOnServer(
          {
            text,
            voiceId,
            provider: "custom",
            baseUrl: url,
            ...(key ? { key } : {}),
            ...(model ? { model } : {}),
          },
          abort.signal,
          "Custom endpoint synthesis",
          "Please configure your custom TTS endpoint address above to preview voices.",
        );
        if (abort.signal.aborted) return;
        await playBlob(blob);
      } catch (err: unknown) {
        if (!abort.signal.aborted) {
          console.error("Failed to synthesize preview audio with custom endpoint:", err);
          setPlaybackError(err instanceof Error ? err.message : String(err));
          setSamplePlaying(null);
        }
      }
    } else {
      // General fallback
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const matchedVoice = voices.find(
          (v) =>
            v.name.toLowerCase() === voiceId.toLowerCase() ||
            v.voiceURI.toLowerCase() === voiceId.toLowerCase(),
        );
        if (matchedVoice) utterance.voice = matchedVoice;
        utterance.rate = 1.0;
        utterance.onend = () => setSamplePlaying(null);
        utterance.onerror = () => setSamplePlaying(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setSamplePlaying(null);
      }
    }
  };

  const activeList = voicesForEngine(selectedEngine, dynamicVoices);

  if (!open) return null;

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
                onClick={() => handleSelectEngine("jax-js")}
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
                    modelStatuses["jax-js"]?.downloading ? (
                      <StatusBadge variant="accent" label={`DOWNLOADING ${modelStatuses["jax-js"]?.progress?.percent ?? 0}%`} />
                    ) : (
                      <StatusBadge variant="accent" label={modelStatuses["jax-js"]?.downloaded ? "ACTIVE · CACHED" : "ACTIVE"} />
                    )
                  ) : modelStatuses["jax-js"]?.downloaded ? (
                    <StatusBadge variant="subtle" label="CACHED" />
                  ) : (
                    <span className="text-[10px] ah-mono uppercase text-[var(--ah-text-faint)]">SELECT</span>
                  )}
                </div>
                <span className="mt-1.5 text-xs text-[var(--ah-text-secondary)]">
                  Kyutai Pocket TTS neural model · 8 distinct character voices
                </span>
                {modelStatuses["jax-js"]?.downloading && (
                  <div className="mt-2 space-y-1 w-full">
                    <div className="flex items-center justify-between text-[10px] ah-mono text-[var(--ah-accent-400)]">
                      <span>Downloading weights...</span>
                      <span>{modelStatuses["jax-js"]?.progress?.percent ?? 0}%</span>
                    </div>
                    <div className="h-1 w-full bg-[var(--ah-surface-faint)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--ah-accent-400)] transition-all duration-300"
                        style={{ width: `${modelStatuses["jax-js"]?.progress?.percent ?? 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>

              <button
                type="button"
                disabled={!kokoroAvailable}
                title={!kokoroAvailable ? "Kokoro MLX requires macOS with Apple Silicon" : undefined}
                onClick={() => kokoroAvailable && handleSelectEngine("kokoro")}
                data-active={selectedEngine === "kokoro" ? "true" : "false"}
                className={`group flex flex-col p-3 text-left transition-all rounded-none border ${
                  !kokoroAvailable
                    ? "opacity-40 cursor-not-allowed border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)]"
                    : selectedEngine === "kokoro"
                      ? "border-[var(--ah-accent-400)] bg-[var(--ah-surface-hover)] shadow-[0_0_12px_var(--ah-accent-alpha)]"
                      : "border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] hover:border-[var(--ah-border-bright)] hover:bg-[var(--ah-surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="ah-mono text-xs font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
                    Kokoro (Apple Silicon MLX)
                  </span>
                  {selectedEngine === "kokoro" ? (
                    modelStatuses["kokoro"]?.downloading ? (
                      <StatusBadge variant="accent" label={`DOWNLOADING ${modelStatuses["kokoro"]?.progress?.percent ?? 0}%`} />
                    ) : (
                      <StatusBadge variant="accent" label={modelStatuses["kokoro"]?.downloaded ? "ACTIVE · CACHED" : "ACTIVE"} />
                    )
                  ) : !kokoroAvailable ? (
                    <StatusBadge variant="subtle" label="macOS ONLY" />
                  ) : modelStatuses["kokoro"]?.downloaded ? (
                    <StatusBadge variant="subtle" label="CACHED" />
                  ) : (
                    <span className="text-[10px] ah-mono uppercase text-[var(--ah-text-faint)]">SELECT</span>
                  )}
                </div>
                <span className="mt-1.5 text-xs text-[var(--ah-text-secondary)]">
                  Ultra-fast neural TTS on Apple Silicon GPU/ANE via MLX
                </span>
                {kokoroAvailable && modelStatuses["kokoro"]?.downloading && (
                  <div className="mt-2 space-y-1 w-full">
                    <div className="flex items-center justify-between text-[10px] ah-mono text-[var(--ah-accent-400)]">
                      <span>Downloading weights...</span>
                      <span>{modelStatuses["kokoro"]?.progress?.percent ?? 0}%</span>
                    </div>
                    <div className="h-1 w-full bg-[var(--ah-surface-faint)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--ah-accent-400)] transition-all duration-300"
                        style={{ width: `${modelStatuses["kokoro"]?.progress?.percent ?? 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>

              <button
                type="button"
                disabled={!systemVoicesAvailable}
                title={!systemVoicesAvailable ? "Built-in voices are available only on macOS" : undefined}
                onClick={() => systemVoicesAvailable && onSelectEngine("system")}
                data-active={selectedEngine === "system" ? "true" : "false"}
                className={`group flex flex-col p-3 text-left transition-all rounded-none border ${
                  !systemVoicesAvailable
                    ? "opacity-40 cursor-not-allowed border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)]"
                    : selectedEngine === "system"
                      ? "border-[var(--ah-accent-400)] bg-[var(--ah-surface-hover)] shadow-[0_0_12px_var(--ah-accent-alpha)]"
                      : "border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] hover:border-[var(--ah-border-bright)] hover:bg-[var(--ah-surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="ah-mono text-xs font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
                    Built-in Mac Voices
                  </span>
                  {selectedEngine === "system" ? (
                    <StatusBadge variant="accent" label="ACTIVE" />
                  ) : !systemVoicesAvailable ? (
                    <StatusBadge variant="subtle" label="macOS ONLY" />
                  ) : (
                    <span className="text-[10px] ah-mono uppercase text-[var(--ah-text-faint)]">SELECT</span>
                  )}
                </div>
                <span className="mt-1.5 text-xs text-[var(--ah-text-secondary)]">
                  Standard macOS system speech synthesis
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectEngine("piper")}
                data-active={selectedEngine === "piper" ? "true" : "false"}
                className={`group flex flex-col p-3 text-left transition-all rounded-none border ${
                  selectedEngine === "piper"
                    ? "border-[var(--ah-accent-400)] bg-[var(--ah-surface-hover)] shadow-[0_0_12px_var(--ah-accent-alpha)]"
                    : "border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] hover:border-[var(--ah-border-bright)] hover:bg-[var(--ah-surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="ah-mono text-xs font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
                    Piper (Local)
                  </span>
                  {selectedEngine === "piper" ? (
                    modelStatuses["piper"]?.downloading ? (
                      <StatusBadge variant="accent" label={`DOWNLOADING ${modelStatuses["piper"]?.progress?.percent ?? 0}%`} />
                    ) : (
                      <StatusBadge variant="accent" label={modelStatuses["piper"]?.downloaded ? "ACTIVE · CACHED" : "ACTIVE"} />
                    )
                  ) : modelStatuses["piper"]?.downloaded ? (
                    <StatusBadge variant="subtle" label="CACHED" />
                  ) : (
                    <span className="text-[10px] ah-mono uppercase text-[var(--ah-text-faint)]">SELECT</span>
                  )}
                </div>
                <span className="mt-1.5 text-xs text-[var(--ah-text-secondary)]">
                  Fast local neural TTS — synthesizes in-app; the voice downloads on first use
                </span>
                {modelStatuses["piper"]?.downloading && (
                  <div className="mt-2 space-y-1 w-full">
                    <div className="flex items-center justify-between text-[10px] ah-mono text-[var(--ah-accent-400)]">
                      <span>Downloading voice model...</span>
                      <span>{modelStatuses["piper"]?.progress?.percent ?? 0}%</span>
                    </div>
                    <div className="h-1 w-full bg-[var(--ah-surface-faint)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--ah-accent-400)] transition-all duration-300"
                        style={{ width: `${modelStatuses["piper"]?.progress?.percent ?? 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectEngine("elevenlabs")}
                data-active={selectedEngine === "elevenlabs" ? "true" : "false"}
                className={`group flex flex-col p-3 text-left transition-all rounded-none border ${
                  selectedEngine === "elevenlabs"
                    ? "border-[var(--ah-accent-400)] bg-[var(--ah-surface-hover)] shadow-[0_0_12px_var(--ah-accent-alpha)]"
                    : "border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] hover:border-[var(--ah-border-bright)] hover:bg-[var(--ah-surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="ah-mono text-xs font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
                    ElevenLabs (Cloud)
                  </span>
                  {selectedEngine === "elevenlabs" ? (
                    <StatusBadge variant="accent" label={elevenlabsConfigured ? "ACTIVE · KEY SET" : "ACTIVE"} />
                  ) : elevenlabsConfigured ? (
                    <StatusBadge variant="subtle" label="KEY SET" />
                  ) : (
                    <span className="text-[10px] ah-mono uppercase text-[var(--ah-text-faint)]">SELECT</span>
                  )}
                </div>
                <span className="mt-1.5 text-xs text-[var(--ah-text-secondary)]">
                  Ultra-realistic voices · Low-latency Eleven Flash v2.5
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectEngine("fish")}
                data-active={selectedEngine === "fish" ? "true" : "false"}
                className={`group flex flex-col p-3 text-left transition-all rounded-none border ${
                  selectedEngine === "fish"
                    ? "border-[var(--ah-accent-400)] bg-[var(--ah-surface-hover)] shadow-[0_0_12px_var(--ah-accent-alpha)]"
                    : "border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] hover:border-[var(--ah-border-bright)] hover:bg-[var(--ah-surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="ah-mono text-xs font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
                    Fish Audio (Cloud)
                  </span>
                  {selectedEngine === "fish" ? (
                    <StatusBadge variant="accent" label={fishConfigured ? "ACTIVE · KEY SET" : "ACTIVE"} />
                  ) : fishConfigured ? (
                    <StatusBadge variant="subtle" label="KEY SET" />
                  ) : (
                    <span className="text-[10px] ah-mono uppercase text-[var(--ah-text-faint)]">SELECT</span>
                  )}
                </div>
                <span className="mt-1.5 text-xs text-[var(--ah-text-secondary)]">
                  Fast, expressive cloud neural voice synthesis
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectEngine("inworld")}
                data-active={selectedEngine === "inworld" ? "true" : "false"}
                className={`group flex flex-col p-3 text-left transition-all rounded-none border ${
                  selectedEngine === "inworld"
                    ? "border-[var(--ah-accent-400)] bg-[var(--ah-surface-hover)] shadow-[0_0_12px_var(--ah-accent-alpha)]"
                    : "border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] hover:border-[var(--ah-border-bright)] hover:bg-[var(--ah-surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="ah-mono text-xs font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
                    Inworld AI (Cloud)
                  </span>
                  {selectedEngine === "inworld" ? (
                    <StatusBadge variant="accent" label={inworldConfigured ? "ACTIVE · KEY SET" : "ACTIVE"} />
                  ) : inworldConfigured ? (
                    <StatusBadge variant="subtle" label="KEY SET" />
                  ) : (
                    <span className="text-[10px] ah-mono uppercase text-[var(--ah-text-faint)]">SELECT</span>
                  )}
                </div>
                <span className="mt-1.5 text-xs text-[var(--ah-text-secondary)]">
                  Expressive interactive AI voices · Inworld TTS
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectEngine("custom")}
                data-active={selectedEngine === "custom" ? "true" : "false"}
                className={`group flex flex-col p-3 text-left transition-all rounded-none border ${
                  selectedEngine === "custom"
                    ? "border-[var(--ah-accent-400)] bg-[var(--ah-surface-hover)] shadow-[0_0_12px_var(--ah-accent-alpha)]"
                    : "border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] hover:border-[var(--ah-border-bright)] hover:bg-[var(--ah-surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="ah-mono text-xs font-semibold uppercase tracking-wider text-[var(--ah-text-primary)]">
                    Custom (API Endpoint)
                  </span>
                  {selectedEngine === "custom" ? (
                    <StatusBadge variant="accent" label={customConfigured ? "ACTIVE · CONFIGURED" : "ACTIVE"} />
                  ) : customConfigured ? (
                    <StatusBadge variant="subtle" label="CONFIGURED" />
                  ) : (
                    <span className="text-[10px] ah-mono uppercase text-[var(--ah-text-faint)]">SELECT</span>
                  )}
                </div>
                <span className="mt-1.5 text-xs text-[var(--ah-text-secondary)]">
                  OpenAI-compatible /v1/audio/speech or custom HTTP endpoint
                </span>
              </button>
            </div>

            {selectedEngine === "elevenlabs" && (
              <div className="mt-3 p-3 border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="ah-mono text-xs text-[var(--ah-text-primary)] font-medium">
                    ElevenLabs API Key
                  </label>
                  {elevenlabsKeySaved && (
                    <span className="text-[10px] ah-mono text-[var(--ah-accent-400)]">
                      SAVED
                    </span>
                  )}
                  {elevenlabsConfigured && !elevenlabsKeySaved && (
                    <span className="text-[10px] ah-mono text-[var(--ah-accent-400)]">
                      CONFIGURED
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={elevenlabsKey}
                    onChange={(e) => setElevenlabsKey(e.target.value)}
                    placeholder="Paste your ElevenLabs API key"
                    className="flex-1 bg-[var(--ah-surface-faint)] border border-[var(--ah-border-subtle)] px-2.5 py-1.5 text-xs text-[var(--ah-text-primary)] focus:outline-none focus:border-[var(--ah-accent-400)] ah-mono"
                  />
                  <button
                    type="button"
                    disabled={savingElevenlabsKey || !elevenlabsKey.trim()}
                    onClick={handleSaveElevenlabsKey}
                    className="px-3 py-1.5 text-xs ah-mono uppercase bg-[var(--ah-accent-400)] text-[var(--ah-accent-contrast)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {savingElevenlabsKey ? "Saving..." : "Save"}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[var(--ah-text-secondary)]">
                    Requires Text to Speech and Voices permissions.
                  </span>
                  <a
                    href="https://elevenlabs.io/app/settings/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--ah-accent-400)] hover:underline ah-mono"
                  >
                    Get API Key ↗
                  </a>
                </div>
              </div>
            )}

            {selectedEngine === "fish" && (
              <div className="mt-3 p-3 border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="ah-mono text-xs text-[var(--ah-text-primary)] font-medium">
                    Fish Audio API Key
                  </label>
                  {fishKeySaved && (
                    <span className="text-[10px] ah-mono text-[var(--ah-accent-400)]">
                      SAVED
                    </span>
                  )}
                  {fishConfigured && !fishKeySaved && (
                    <span className="text-[10px] ah-mono text-[var(--ah-accent-400)]">
                      CONFIGURED
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={fishKey}
                    onChange={(e) => setFishKey(e.target.value)}
                    placeholder="Paste your Fish Audio API key"
                    className="flex-1 bg-[var(--ah-surface-faint)] border border-[var(--ah-border-subtle)] px-2.5 py-1.5 text-xs text-[var(--ah-text-primary)] focus:outline-none focus:border-[var(--ah-accent-400)] ah-mono"
                  />
                  <button
                    type="button"
                    disabled={savingFishKey || !fishKey.trim()}
                    onClick={handleSaveFishKey}
                    className="px-3 py-1.5 text-xs ah-mono uppercase bg-[var(--ah-accent-400)] text-[var(--ah-accent-contrast)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {savingFishKey ? "Saving..." : "Save"}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[var(--ah-text-secondary)]">
                    Fast, ultra-realistic voice models via Fish Audio API.
                  </span>
                  <a
                    href="https://fish.audio/app/api-keys/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--ah-accent-400)] hover:underline ah-mono"
                  >
                    Get API Key ↗
                  </a>
                </div>
              </div>
            )}

            {selectedEngine === "inworld" && (
              <div className="mt-3 p-3 border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="ah-mono text-xs text-[var(--ah-text-primary)] font-medium">
                    Inworld API Key
                  </label>
                  {inworldKeySaved && (
                    <span className="text-[10px] ah-mono text-[var(--ah-accent-400)]">
                      SAVED
                    </span>
                  )}
                  {inworldConfigured && !inworldKeySaved && (
                    <span className="text-[10px] ah-mono text-[var(--ah-accent-400)]">
                      CONFIGURED
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={inworldKey}
                    onChange={(e) => setInworldKey(e.target.value)}
                    placeholder="Paste your Inworld API key"
                    className="flex-1 bg-[var(--ah-surface-faint)] border border-[var(--ah-border-subtle)] px-2.5 py-1.5 text-xs text-[var(--ah-text-primary)] focus:outline-none focus:border-[var(--ah-accent-400)] ah-mono"
                  />
                  <button
                    type="button"
                    disabled={savingInworldKey || !inworldKey.trim()}
                    onClick={handleSaveInworldKey}
                    className="px-3 py-1.5 text-xs ah-mono uppercase bg-[var(--ah-accent-400)] text-[var(--ah-accent-contrast)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {savingInworldKey ? "Saving..." : "Save"}
                  </button>
                </div>
                <div>
                  <label className="ah-mono text-[11px] text-[var(--ah-text-secondary)] font-medium block mb-1">
                    Model (optional)
                  </label>
                  <input
                    type="text"
                    value={inworldModel}
                    onChange={(e) => setInworldModel(e.target.value)}
                    placeholder="inworld-tts-2"
                    className="w-full bg-[var(--ah-surface-faint)] border border-[var(--ah-border-subtle)] px-2.5 py-1.5 text-xs text-[var(--ah-text-primary)] focus:outline-none focus:border-[var(--ah-accent-400)] ah-mono"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[var(--ah-text-secondary)]">
                    Generates expressive natural voices via Inworld AI TTS API.
                  </span>
                  <a
                    href="https://docs.inworld.ai/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--ah-accent-400)] hover:underline ah-mono"
                  >
                    Inworld Portal ↗
                  </a>
                </div>
              </div>
            )}

            {selectedEngine === "custom" && (
              <div className="mt-3 p-3 border border-[var(--ah-border-subtle)] bg-[var(--ah-surface-raised)] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="ah-mono text-xs text-[var(--ah-text-primary)] font-medium">
                    Custom Speech Endpoint URL
                  </label>
                  {customConfigSaved && (
                    <span className="text-[10px] ah-mono text-[var(--ah-accent-400)]">
                      SAVED
                    </span>
                  )}
                  {customConfigured && !customConfigSaved && (
                    <span className="text-[10px] ah-mono text-[var(--ah-accent-400)]">
                      CONFIGURED
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customServerUrl}
                    onChange={(e) => setCustomServerUrl(e.target.value)}
                    placeholder="http://127.0.0.1:8000/v1/audio/speech"
                    className="flex-1 bg-[var(--ah-surface-faint)] border border-[var(--ah-border-subtle)] px-2.5 py-1.5 text-xs text-[var(--ah-text-primary)] focus:outline-none focus:border-[var(--ah-accent-400)] ah-mono"
                  />
                  <button
                    type="button"
                    disabled={savingCustomConfig || !customServerUrl.trim()}
                    onClick={handleSaveCustomConfig}
                    className="px-3 py-1.5 text-xs ah-mono uppercase bg-[var(--ah-accent-400)] text-[var(--ah-accent-contrast)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {savingCustomConfig ? "Saving..." : "Save"}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="ah-mono text-[11px] text-[var(--ah-text-secondary)] font-medium block mb-1">
                      API Key (optional)
                    </label>
                    <input
                      type="password"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      placeholder="Bearer token or API key"
                      className="w-full bg-[var(--ah-surface-faint)] border border-[var(--ah-border-subtle)] px-2.5 py-1.5 text-xs text-[var(--ah-text-primary)] focus:outline-none focus:border-[var(--ah-accent-400)] ah-mono"
                    />
                  </div>
                  <div>
                    <label className="ah-mono text-[11px] text-[var(--ah-text-secondary)] font-medium block mb-1">
                      Model ID (optional)
                    </label>
                    <input
                      type="text"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      placeholder="tts-1"
                      className="w-full bg-[var(--ah-surface-faint)] border border-[var(--ah-border-subtle)] px-2.5 py-1.5 text-xs text-[var(--ah-text-primary)] focus:outline-none focus:border-[var(--ah-accent-400)] ah-mono"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-[var(--ah-text-secondary)]">
                  Connects to any OpenAI-compatible <code>/v1/audio/speech</code> or custom HTTP audio endpoint (LocalAI, vLLM, XTTS, CosyVoice, etc.).
                </p>
              </div>
            )}
          </section>

          {/* Character Voices */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="ah-micro text-[var(--ah-text-muted)] block">Character Voices</label>
              <span className="ah-mono text-[10px] uppercase text-[var(--ah-text-faint)] tracking-wider">
                {selectedEngine === "kokoro"
                  ? "7 Kokoro MLX neural voices"
                  : selectedEngine === "piper"
                    ? "4 Piper neural voices"
                    : selectedEngine === "system"
                      ? `${activeList.length} macOS speech voices`
                      : selectedEngine === "elevenlabs"
                        ? `${activeList.length} ElevenLabs cloud voices`
                        : selectedEngine === "fish"
                          ? `${activeList.length} Fish Audio cloud voices`
                          : selectedEngine === "inworld"
                            ? `${activeList.length} Inworld neural voices`
                            : selectedEngine === "custom"
                              ? `${activeList.length} Custom endpoint voices`
                              : "8 Kyutai neural voices"}
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
              {activeList.map((v) => {
                const isSelected = selectedVoice.toLowerCase() === v.id.toLowerCase();
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
            Clicking preview runs neural voice synthesis locally on your machine. Kyutai Pocket TTS executes directly in-browser via WebGPU; Kokoro-82M leverages Apple Silicon unified memory and MLX for ultra-low latency.
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
