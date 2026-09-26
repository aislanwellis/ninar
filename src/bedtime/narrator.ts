import { ambience } from "./ambience";
import { splitSentences, spokenScript, type Story } from "./stories";
import { loadNarration } from "./voice-cache";

type SpeechChunk = { start: number; text: string; count: number };

function packChunks(sentences: string[]): SpeechChunk[] {
  const chunks: SpeechChunk[] = [];
  let buffer: string[] = [];
  let start = 0;
  const flush = () => {
    if (buffer.length === 0) return;
    chunks.push({ start, text: buffer.join(" "), count: buffer.length });
    start += buffer.length;
    buffer = [];
  };
  for (const sentence of sentences) {
    const next = buffer.length === 0 ? sentence.length : buffer.join(" ").length + 1 + sentence.length;
    if (buffer.length > 0 && next > 1600) flush();
    buffer.push(sentence);
  }
  flush();
  if (chunks.length > 0) return chunks;
  return [{ start: 0, text: sentences.join(" "), count: Math.max(sentences.length, 1) }];
}

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

function humanRate(rate: number): number {
  if (rate >= 1.03) return 1.05;
  if (Math.abs(rate - 0.94) < 0.02 || rate < 0.88) return 0.94;
  return 1;
}

export class Narrator {
  private status: PlayStatus = "idle";
  private story: Story | null = null;
  private sentences: string[] = [];
  private index = 0;
  private mode: NarrationMode | null = null;
  private preparing = false;
  private deadline: number | null = null;
  private pausedRemaining: number | null = null;
  private sessionArmed = false;
  private playToken = 0;
  private readTimer = 0;
  private tickTimer = 0;
  private disposed = false;
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private chunks: SpeechChunk[] = [];
  private chunkIndex = 0;

  constructor(private readonly handlers: Handlers) {}

  dispose() {
    this.disposed = true;
    this.playToken += 1;
    this.clearTimers();
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
      voiceName: null,
      remainingMs: this.remainingMs(),
      progress: this.progress(),
    };
  }

  start(story: Story, fromIndex = 0) {
    if (this.disposed) return;
    this.playToken += 1;
    this.clearReadTimer();
    this.stopAudio();
    this.story = story;
    this.sentences = splitSentences(spokenScript(story));
    this.chunks = packChunks(this.sentences);
    this.index = Math.min(Math.max(fromIndex, 0), Math.max(this.sentences.length - 1, 0));
    this.chunkIndex = Math.max(0, this.chunks.findIndex((chunk) => this.index < chunk.start + chunk.count));
    this.status = "playing";
    this.mode = "voice";
    this.preparing = true;
    this.armSessionTimer();
    this.armTick();
    ambience.start(story.theme);
    this.emit();
    const chunk = this.chunks[this.chunkIndex];
    void this.playChunk(this.playToken, chunk ? this.index - chunk.start : 0);
  }

  pause() {
    if (this.status !== "playing") return;
    this.status = "paused";
    if (this.deadline != null) {
      this.pausedRemaining = Math.max(0, this.deadline - Date.now());
      this.deadline = null;
    }
    this.clearReadTimer();
    this.audio?.pause();
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
    if (this.mode === "voice" && this.audio && this.audio.src) {
      this.syncMix();
      ambience.resume();
      void this.audio.play().catch(() => this.fallbackReading());
      this.emit();
      return;
    }
    this.speakReading();
  }

  stop() {
    this.playToken += 1;
    this.status = "idle";
    this.story = null;
    this.sentences = [];
    this.index = 0;
    this.mode = null;
    this.preparing = false;
    this.deadline = null;
    this.pausedRemaining = null;
    this.sessionArmed = false;
    this.clearReadTimer();
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

  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const audio = new Audio();
    audio.preload = "auto";
    audio.preservesPitch = true;
    audio.addEventListener("timeupdate", () => this.onTime());
    audio.addEventListener("ended", () => {
      if (this.status !== "playing" || this.mode !== "voice") return;
      this.advanceChunk();
    });
    this.audio = audio;
    return audio;
  }

  private advanceChunk() {
    const next = this.chunkIndex + 1;
    if (next < this.chunks.length) {
      this.chunkIndex = next;
      this.index = this.chunks[next]?.start ?? this.index;
      this.preparing = true;
      this.emit();
      void this.playChunk(this.playToken, 0);
      return;
    }
    ambience.stop();
    this.finishStory();
  }

  private async playChunk(token: number, localIndex: number) {
    const chunk = this.chunks[this.chunkIndex];
    if (!chunk) return;
    try {
      const blob = await loadNarration(chunk.text);
      if (this.disposed || token !== this.playToken) return;
      if (this.status !== "playing" && this.status !== "paused") return;
      const audio = this.ensureAudio();
      this.preparing = false;
      const url = URL.createObjectURL(blob);
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = url;
      audio.src = url;
      await new Promise<void>((resolve, reject) => {
        const ok = () => {
          cleanup();
          resolve();
        };
        const bad = () => {
          cleanup();
          reject(new Error("audio"));
        };
        const cleanup = () => {
          audio.removeEventListener("loadedmetadata", ok);
          audio.removeEventListener("error", bad);
        };
        if (audio.readyState >= 1 && Number.isFinite(audio.duration)) ok();
        else {
          audio.addEventListener("loadedmetadata", ok);
          audio.addEventListener("error", bad);
        }
      });
      if (this.disposed || token !== this.playToken) return;
      if (this.status !== "playing" && this.status !== "paused") return;
      if (localIndex > 0) audio.currentTime = this.timeForLocal(localIndex);
      this.syncMix();
      this.prefetch();
      this.emit();
      if (this.status === "playing") await audio.play();
    } catch {
      if (this.disposed || token !== this.playToken || this.status === "idle") return;
      this.preparing = false;
      this.fallbackReading();
    }
  }

  private prefetch() {
    const next = this.chunks[this.chunkIndex + 1];
    if (!next) return;
    void loadNarration(next.text).catch(() => {});
  }

  private onTime() {
    const audio = this.audio;
    if (!audio || this.status !== "playing" || this.mode !== "voice") return;
    this.syncMix();
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const next = this.sentenceAt(audio.currentTime);
    if (next !== this.index) {
      this.index = next;
      this.emit();
    }
  }

  private fallbackReading() {
    this.mode = "reading";
    this.audio?.pause();
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
    const ms = Math.max(1200, words * (380 / humanRate(this.handlers.getSettings().rate)));
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

  private chunkSentences(): string[] {
    const chunk = this.chunks[this.chunkIndex];
    if (!chunk) return this.sentences;
    return this.sentences.slice(chunk.start, chunk.start + chunk.count);
  }

  private timeForLocal(localIndex: number): number {
    const duration = this.audio?.duration ?? 0;
    if (!duration) return 0;
    const weights = this.chunkSentences().map((sentence) => Math.max(sentence.length, 1));
    const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    const before = weights.slice(0, localIndex).reduce((sum, weight) => sum + weight, 0);
    return (before / total) * duration;
  }

  private sentenceAt(time: number): number {
    const chunk = this.chunks[this.chunkIndex];
    const duration = this.audio?.duration ?? 0;
    if (!chunk || !duration) return this.index;
    const weights = this.chunkSentences().map((sentence) => Math.max(sentence.length, 1));
    const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
    let cursor = 0;
    const target = (time / duration) * total;
    for (let i = 0; i < weights.length; i += 1) {
      cursor += weights[i] ?? 0;
      if (target < cursor) return chunk.start + i;
    }
    return chunk.start + Math.max(weights.length - 1, 0);
  }

  private progress(): number {
    const chunks = Math.max(this.chunks.length, 1);
    const audio = this.audio;
    if (this.mode === "voice" && audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      return Math.min(1, (this.chunkIndex + audio.currentTime / audio.duration) / chunks);
    }
    if (this.sentences.length === 0) return 0;
    return Math.min(1, this.index / this.sentences.length);
  }

  private syncMix() {
    const audio = this.audio;
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, this.fadedVolume()));
    audio.playbackRate = humanRate(this.handlers.getSettings().rate);
    ambience.setVolume(this.fadedVolume() * 0.82);
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
    this.clearReadTimer();
    this.audio?.pause();
    ambience.stop();
    if (this.sentences.length > 0) this.index = this.sentences.length - 1;
    this.emit();
    if (id) this.handlers.onStoryEnded(id);
  }

  private finishTimer() {
    this.status = "idle";
    this.playToken += 1;
    this.deadline = null;
    this.pausedRemaining = null;
    this.sessionArmed = false;
    this.clearReadTimer();
    this.audio?.pause();
    ambience.stop();
    this.emit();
  }

  private armTick() {
    if (this.tickTimer) return;
    this.tickTimer = window.setInterval(() => {
      if (this.disposed) return;
      if (this.status === "playing") this.syncMix();
      if (this.status === "playing" && this.remainingMs() === 0) {
        this.finishTimer();
        return;
      }
      if (this.status !== "idle") this.emit();
    }, 500);
  }

  private clearReadTimer() {
    if (this.readTimer) window.clearTimeout(this.readTimer);
    this.readTimer = 0;
  }

  private clearTimers() {
    this.clearReadTimer();
    if (this.tickTimer) window.clearInterval(this.tickTimer);
    this.tickTimer = 0;
  }

  private stopAudio() {
    const audio = this.audio;
    if (!audio) return;
    audio.pause();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    audio.removeAttribute("src");
    audio.load();
  }

  private emit() {
    if (this.disposed) return;
    this.handlers.onSnapshot(this.snapshot());
  }
}

export const IDLE_SNAPSHOT = EMPTY;
