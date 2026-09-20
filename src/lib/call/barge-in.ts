// Voice barge-in detection for phone calls.
//
// Enables full-duplex conversational interruption:
// 1. Activates an Acoustic Echo Cancellation (AEC) microphone stream while
//    the bot is speaking. Chromium/WebRTC AEC subtracts the bot's speaker
//    output from the microphone input.
// 2. Applies a bandpass filter (200Hz - 3500Hz) focusing on human speech
//    frequencies while attenuating room rumble, fan noise, and clicks.
// 3. Monitors RMS energy: when human speech exceeds the threshold for ~150ms,
//    triggers the barge-in callback to immediately halt playback and open the mic.

export interface BargeInOptions {
  /** RMS threshold to detect speech (default: 0.045) */
  threshold?: number;
  /** Consecutive frames above threshold required to trigger (default: 3 frames ~150ms) */
  consecutiveFrames?: number;
  /** Polling interval in ms (default: 50ms) */
  pollIntervalMs?: number;
}

export class BargeInDetector {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private highpass: BiquadFilterNode | null = null;
  private lowpass: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private consecutiveCount = 0;
  private active = false;
  private onBargeIn: (() => void) | null = null;

  private threshold: number;
  private requiredFrames: number;
  private pollIntervalMs: number;

  constructor(options: BargeInOptions = {}) {
    this.threshold = options.threshold ?? 0.045;
    this.requiredFrames = options.consecutiveFrames ?? 3;
    this.pollIntervalMs = options.pollIntervalMs ?? 50;
  }

  get isActive(): boolean {
    return this.active;
  }

  async start(onBargeIn: () => void): Promise<boolean> {
    this.stop();
    this.onBargeIn = onBargeIn;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      return false;
    }

    try {
      // Request microphone stream with Acoustic Echo Cancellation and noise suppression
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioCtx) {
        this.stop();
        return false;
      }

      this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === "suspended") {
        await this.audioCtx.resume();
      }

      this.source = this.audioCtx.createMediaStreamSource(this.stream);

      // Highpass at 200 Hz: cuts table bumps, AC hum, laptop vibration
      this.highpass = this.audioCtx.createBiquadFilter();
      this.highpass.type = "highpass";
      this.highpass.frequency.value = 200;

      // Lowpass at 3500 Hz: cuts high-frequency speaker hiss
      this.lowpass = this.audioCtx.createBiquadFilter();
      this.lowpass.type = "lowpass";
      this.lowpass.frequency.value = 3500;

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2;

      this.source.connect(this.highpass);
      this.highpass.connect(this.lowpass);
      this.lowpass.connect(this.analyser);

      this.active = true;
      this.consecutiveCount = 0;

      const buffer = new Float32Array(this.analyser.fftSize);
      this.timer = setInterval(() => {
        if (!this.active || !this.analyser) return;

        this.analyser.getFloatTimeDomainData(buffer);
        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i++) {
          sumSquares += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sumSquares / buffer.length);

        if (rms >= this.threshold) {
          this.consecutiveCount += 1;
          if (this.consecutiveCount >= this.requiredFrames) {
            const callback = this.onBargeIn;
            this.stop();
            callback?.();
          }
        } else {
          this.consecutiveCount = Math.max(0, this.consecutiveCount - 1);
        }
      }, this.pollIntervalMs);

      return true;
    } catch {
      this.stop();
      return false;
    }
  }

  stop(): void {
    this.active = false;
    this.consecutiveCount = 0;
    this.onBargeIn = null;

    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        // ignore
      }
      this.source = null;
    }

    if (this.highpass) {
      try {
        this.highpass.disconnect();
      } catch {
        // ignore
      }
      this.highpass = null;
    }

    if (this.lowpass) {
      try {
        this.lowpass.disconnect();
      } catch {
        // ignore
      }
      this.lowpass = null;
    }

    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        // ignore
      }
      this.analyser = null;
    }

    if (this.audioCtx) {
      void this.audioCtx.close();
      this.audioCtx = null;
    }

    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
  }
}
