import { ambience } from "./ambience";
import { clipFor, loadVoice } from "./neural";
import { splitSentences, spokenScript, type Story } from "./stories";

export type PlayStatus = "idle" | "playing" | "paused";
export type NarrationMode = "voice" | "reading";

export type NarratorSnapshot = {
  status: PlayStatus;
  storyId: string | null;
  title: string | null;
  sentenceIndex: number;
  sentenceCount: number;
  sentences: string[];
  mode: NarrationMode | null;
  preparing: boolean;
  voiceName: string | null;
  remainingMs: number | null;
  progress: number;
};

type Settings = {
  rate: number;
  volume: number;
  timerMinutes: number;
};

type Handlers = {
  onSnapshot: (snapshot: NarratorSnapshot) => void;
  onStoryEnded: (storyId: string) => void;
  getSettings: () => Settings;
};

const EMPTY: NarratorSnapshot = {
  status: "idle",
  storyId: null,
  title: null,
  sentenceIndex: 0,
  sentenceCount: 0,
  sentences: [],
  mode: null,
  preparing: false,
  voiceName: null,
  remainingMs: null,
  progress: 0,
};

function speechRate(rate: number): number {
  if (rate >= 1.03) return 1.02;
  if (rate < 0.97) return 0.92;
  return 0.98;
}

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  return window.speechSynthesis;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = synth()?.getVoices() ?? [];
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = 0;
  for (const voice of voices) {
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase().replace("_", "-");
    let score = 0;
    if (lang.startsWith("pt-br")) score += 60;
    else if (lang.startsWith("pt")) score += 24;
    else continue;
    if (/francisca|luciana|fernanda|joana|maria|google português|portugues do brasil/.test(name)) score += 30;
    if (/natural|neural|premium|enhanced|online/.test(name)) score += 20;
    if (/male|daniel|antonio|grandad/.test(name)) score -= 12;
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

export class Narrator {
  private status: PlayStatus = "idle";
  private story: Story | null = null;
  private sentences: string[] = [];
  private index = 0;
  private mode: NarrationMode | null = null;
  private preparing = false;
  private voiceName: string | null = null;
  private deadline: number | null = null;
  private pausedRemaining: number | null = null;
  private sessionArmed = false;
  private playToken = 0;
  private speakGen = 0;
  private readTimer = 0;
  private tickTimer = 0;
  private keepAlive = 0;
  private disposed = false;
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private rendering = false;
  private neural = false;
  private heard = false;
  private silentSince = 0;

  constructor(private readonly handlers: Handlers) {
    synth()?.getVoices();
  }

  dispose() {
    this.disposed = true;
    this.playToken += 1;
    this.speakGen += 1;
    this.clearTimers();
    synth()?.cancel();
    this.stopAudio();
    ambience.stop();
  }

  snapshot(): NarratorSnapshot {
    return {
      status: this.status,
      storyId: this.story?.id ?? null,
      title: this.story?.title ?? null,
      sentenceIndex: this.index,
      sentenceCount: this.sentences.length,
      sentences: this.sentences,
      mode: this.mode,
      preparing: this.preparing,
      voiceName: this.voiceName,
      remainingMs: this.remainingMs(),
      progress: this.progress(),
    };
  }

  start(story: Story, fromIndex = 0) {
    if (this.disposed) return;
    this.playToken += 1;
    this.clearReadTimer();
    synth()?.cancel();
    this.heard = false;
    this.story = story;
    this.sentences = splitSentences(spokenScript(story));
    this.index = Math.min(Math.max(fromIndex, 0), Math.max(this.sentences.length - 1, 0));
    this.status = "playing";
    this.mode = "voice";
    this.preparing = false;
    this.armSessionTimer();
    this.armTick();
    ambience.start(story.theme);
    void this.playNeural(this.index);
  }

  pause() {
    if (this.status !== "playing") return;
    this.status = "paused";
    if (this.deadline != null) {
      this.pausedRemaining = Math.max(0, this.deadline - Date.now());
      this.deadline = null;
    }
    this.clearReadTimer();
    if (this.neural) this.audio?.pause();
    else if (this.mode === "voice") synth()?.pause();
    ambience.pause();
    this.emit();
  }

  resume() {
    if (this.status !== "paused" || !this.story) return;
    this.status = "playing";
    if (this.pausedRemaining != null) {
      this.deadline = Date.now() + this.pausedRemaining;
      this.pausedRemaining = null;
    }
    ambience.resume();
    if (this.neural) {
      if (this.rendering) {
        this.emit();
        return;
      }
      if (this.audio?.src && this.audio.paused) {
        this.syncMix();
        void this.audio.play().catch(() => this.speakFrom(this.index));
        this.emit();
        return;
      }
      void this.playClip(this.playToken, this.index);
      return;
    }
    const voice = synth();
    if (this.mode === "voice" && voice) {
      if (voice.paused) voice.resume();
      else if (!voice.speaking) this.speakFrom(this.index);
      this.syncMix();
      this.emit();
      return;
    }
    this.speakReading();
  }

  stop() {
    this.playToken += 1;
    this.speakGen += 1;
    this.status = "idle";
    this.story = null;
    this.sentences = [];
    this.index = 0;
    this.mode = null;
    this.preparing = false;
    this.voiceName = null;
    this.deadline = null;
    this.pausedRemaining = null;
    this.sessionArmed = false;
    this.neural = false;
    this.rendering = false;
    this.clearReadTimer();
    synth()?.cancel();
    this.stopAudio();
    ambience.stop();
    this.emit();
  }

  setTimerMinutes(minutes: number) {
    if (this.status === "idle") return;
    if (minutes <= 0) {
      this.deadline = null;
      this.pausedRemaining = null;
      this.sessionArmed = false;
    } else if (this.status === "playing") {
      this.deadline = Date.now() + minutes * 60_000;
      this.pausedRemaining = null;
      this.sessionArmed = true;
    } else {
      this.pausedRemaining = minutes * 60_000;
      this.deadline = null;
      this.sessionArmed = true;
    }
    this.syncMix();
    this.emit();
  }

  private async playNeural(fromIndex: number) {
    const token = this.playToken;
    this.neural = true;
    this.preparing = true;
    this.voiceName = "Preparando a voz";
    this.mode = "voice";
    this.index = fromIndex;
    synth()?.cancel();
    this.stopAudio();
    this.emit();
    try {
      await loadVoice((label) => {
        if (this.disposed || token !== this.playToken) return;
        this.voiceName = label;
        this.preparing = true;
        this.emit();
      });
    } catch {
      if (token === this.playToken) this.speakFrom(fromIndex);
      return;
    }
    if (this.disposed || token !== this.playToken) return;
    void this.playClip(token, fromIndex);
  }

  private async playClip(token: number, index: number) {
    if (this.disposed || token !== this.playToken || !this.story) return;
    if (this.status !== "playing" && this.status !== "paused") return;
    if (this.remainingMs() === 0) {
      this.finishTimer();
      return;
    }
    if (index >= this.sentences.length) {
      this.finishStory();
      return;
    }
    const sentence = this.sentences[index]?.trim();
    if (!sentence) {
      void this.playClip(token, index + 1);
      return;
    }
    this.index = index;
    this.preparing = true;
    this.neural = true;
    this.emit();
    const speed = speechRate(this.handlers.getSettings().rate);
    const next = this.sentences[index + 1]?.trim();
    if (next) void clipFor(this.story.id, next, speed).catch(() => {});
    this.rendering = true;
    let blob: Blob;
    try {
      blob = await clipFor(this.story.id, sentence, speed);
    } catch {
      this.rendering = false;
      if (token === this.playToken) this.speakFrom(index);
      return;
    }
    this.rendering = false;
    if (this.disposed || token !== this.playToken || !this.neural) return;
    if (this.status !== "playing" && this.status !== "paused") return;
    const audio = this.ensureAudio();
    audio.onended = null;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    const url = URL.createObjectURL(blob);
    this.objectUrl = url;
    audio.src = url;
    this.preparing = false;
    this.heard = true;
    this.voiceName = "Voz brasileira";
    this.syncMix();
    this.emit();
    audio.onended = () => {
      if (this.disposed || token !== this.playToken || !this.neural || this.status !== "playing") return;
      void this.playClip(token, index + 1);
    };
    if (this.status !== "playing") return;
    try {
      await audio.play();
    } catch {
      if (token === this.playToken) this.speakFrom(index);
    }
  }

  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const audio = new Audio();
    audio.preload = "auto";
    this.audio = audio;
    return audio;
  }

  private stopAudio() {
    const audio = this.audio;
    if (!audio) return;
    audio.onended = null;
    audio.pause();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    audio.removeAttribute("src");
    audio.load();
  }

  private speakFrom(fromIndex: number) {
    const voiceBox = synth();
    if (!voiceBox || this.sentences.length === 0) {
      this.fallbackReading();
      return;
    }
    this.speakGen += 1;
    const gen = this.speakGen;
    this.silentSince = 0;
    voiceBox.cancel();
    this.neural = false;
    this.stopAudio();
    const voice = pickVoice();
    this.voiceName = voice?.name ?? "Voz do celular";
    this.mode = "voice";
    this.preparing = false;
    const settings = this.handlers.getSettings();
    const rate = speechRate(settings.rate);
    const volume = Math.max(0, Math.min(1, settings.volume));
    this.index = fromIndex;
    for (let i = fromIndex; i < this.sentences.length; i += 1) {
      const sentence = this.sentences[i]?.trim();
      if (!sentence) continue;
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.lang = "pt-BR";
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = volume;
      if (voice) utterance.voice = voice;
      utterance.onstart = () => {
        if (this.disposed || gen !== this.speakGen) return;
        this.index = i;
        this.preparing = false;
        this.heard = true;
        if (this.remainingMs() === 0) {
          this.finishTimer();
          return;
        }
        this.emit();
      };
      utterance.onend = () => {
        if (this.disposed || gen !== this.speakGen || this.status !== "playing") return;
        if (i >= this.sentences.length - 1) this.finishStory();
      };
      utterance.onerror = (event) => {
        const reason = event.error;
        if (reason === "interrupted" || reason === "canceled") return;
        if (this.disposed || gen !== this.speakGen || this.status === "idle") return;
        const live = synth();
        if (live && (live.speaking || live.pending)) return;
        this.fallbackReading();
      };
      voiceBox.speak(utterance);
    }
    this.armKeepAlive();
    this.syncMix();
    this.emit();
  }

  private fallbackReading() {
    this.mode = "reading";
    this.preparing = false;
    synth()?.cancel();
    this.speakReading();
  }

  private speakReading() {
    if (this.disposed || this.status !== "playing" || !this.story) return;
    if (this.remainingMs() === 0) {
      this.finishTimer();
      return;
    }
    const sentence = this.sentences[this.index];
    if (!sentence) {
      this.finishStory();
      return;
    }
    this.clearReadTimer();
    this.emit();
    const words = sentence.split(/\s+/).length;
    const ms = Math.max(1200, words * (380 / speechRate(this.handlers.getSettings().rate)));
    this.readTimer = window.setTimeout(() => {
      if (this.status !== "playing" || this.mode !== "reading") return;
      this.advanceReading();
    }, ms);
  }

  private advanceReading() {
    if (this.remainingMs() === 0) {
      this.finishTimer();
      return;
    }
    if (this.index >= this.sentences.length - 1) {
      this.finishStory();
      return;
    }
    this.index += 1;
    this.speakReading();
  }

  private progress(): number {
    if (this.sentences.length === 0) return 0;
    return Math.min(1, this.index / this.sentences.length);
  }

  private syncMix() {
    const level = Math.max(0, Math.min(1, this.fadedVolume()));
    ambience.setVolume(level * 0.45);
    const audio = this.audio;
    if (!audio) return;
    audio.volume = level;
    audio.playbackRate = speechRate(this.handlers.getSettings().rate);
  }

  private armSessionTimer() {
    if (this.sessionArmed || this.deadline != null || this.pausedRemaining != null) return;
    const minutes = this.handlers.getSettings().timerMinutes;
    if (minutes > 0) {
      this.deadline = Date.now() + minutes * 60_000;
      this.sessionArmed = true;
    }
  }

  private remainingMs(): number | null {
    if (this.deadline != null) return Math.max(0, this.deadline - Date.now());
    if (this.pausedRemaining != null) return this.pausedRemaining;
    if (this.sessionArmed) return 0;
    return null;
  }

  private fadedVolume(): number {
    const base = this.handlers.getSettings().volume;
    const remaining = this.remainingMs();
    if (remaining == null) return base;
    const fadeWindow = 20_000;
    if (remaining >= fadeWindow) return base;
    return base * (remaining / fadeWindow);
  }

  private finishStory() {
    const id = this.story?.id;
    this.status = "idle";
    this.playToken += 1;
    this.speakGen += 1;
    this.clearReadTimer();
    synth()?.cancel();
    this.stopAudio();
    ambience.stop();
    if (this.sentences.length > 0) this.index = this.sentences.length - 1;
    this.emit();
    if (id) this.handlers.onStoryEnded(id);
  }

  private finishTimer() {
    this.status = "idle";
    this.playToken += 1;
    this.speakGen += 1;
    this.deadline = null;
    this.pausedRemaining = null;
    this.sessionArmed = false;
    this.neural = false;
    this.clearReadTimer();
    synth()?.cancel();
    this.stopAudio();
    ambience.stop();
    this.emit();
  }

  private armTick() {
    if (this.tickTimer) return;
    this.tickTimer = window.setInterval(() => {
      if (this.disposed) return;
      if (this.status === "playing") {
        this.syncMix();
        this.recoverVoice();
      }
      if (this.status === "playing" && this.remainingMs() === 0) {
        this.finishTimer();
        return;
      }
      if (this.status !== "idle") this.emit();
    }, 500);
  }

  private recoverVoice() {
    if (this.neural || this.mode !== "voice" || !this.heard) return;
    const voice = synth();
    if (!voice || voice.speaking || voice.paused) {
      this.silentSince = 0;
      return;
    }
    if (!this.silentSince) {
      this.silentSince = Date.now();
      return;
    }
    if (Date.now() - this.silentSince < 1600) return;
    this.silentSince = 0;
    this.speakFrom(this.index);
  }

  private armKeepAlive() {
    if (this.keepAlive) return;
    const ios = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (ios) return;
    this.keepAlive = window.setInterval(() => {
      const voice = synth();
      if (!voice || this.disposed || this.status !== "playing" || this.mode !== "voice") return;
      if (!voice.speaking || voice.paused) return;
      voice.pause();
      voice.resume();
    }, 12000);
  }

  private clearReadTimer() {
    if (this.readTimer) window.clearTimeout(this.readTimer);
    this.readTimer = 0;
  }

  private clearTimers() {
    this.clearReadTimer();
    if (this.tickTimer) window.clearInterval(this.tickTimer);
    if (this.keepAlive) window.clearInterval(this.keepAlive);
    this.tickTimer = 0;
    this.keepAlive = 0;
  }

  private emit() {
    if (this.disposed) return;
    this.handlers.onSnapshot(this.snapshot());
  }
}

export const IDLE_SNAPSHOT = EMPTY;
