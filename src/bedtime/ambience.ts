import type { ThemeId } from "./types";

type Layer = "birds" | "waves" | "notes" | "crickets" | "owl" | "moo" | "cluck" | "frog" | "bee" | "steps" | "clock" | "wind";

const BEDS: Record<ThemeId, { filter: number; gain: number; layers: Layer[] }> = {
  lua: { filter: 900, gain: 0.42, layers: ["notes", "wind"] },
  floresta: { filter: 1800, gain: 0.48, layers: ["birds", "crickets", "owl", "wind"] },
  mar: { filter: 900, gain: 0.55, layers: ["waves"] },
  fazenda: { filter: 1400, gain: 0.5, layers: ["moo", "cluck", "birds"] },
  bichos: { filter: 1600, gain: 0.48, layers: ["birds", "frog", "moo"] },
  jardim: { filter: 1700, gain: 0.46, layers: ["birds", "bee", "notes"] },
  caminho: { filter: 1000, gain: 0.4, layers: ["steps", "wind", "birds"] },
  casinha: { filter: 700, gain: 0.38, layers: ["clock", "notes"] },
  nuvem: { filter: 800, gain: 0.46, layers: ["wind", "notes"] },
  sonho: { filter: 700, gain: 0.4, layers: ["notes", "wind"] },
};

function brownNoise(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
    data[i] = last * 3.2;
  }
  return buffer;
}

class AmbienceEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timers: number[] = [];
  private volume = 0.7;
  private theme: ThemeId | null = null;

  setVolume(volume: number) {
    this.volume = volume;
    if (this.master && this.theme) this.master.gain.value = volume * BEDS[this.theme].gain;
  }

  start(theme: ThemeId) {
    if (this.theme === theme && this.ctx && this.ctx.state !== "closed") {
      void this.ctx.resume();
      return;
    }
    this.stop();
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    this.ctx = ctx;
    this.theme = theme;
    const bed = BEDS[theme];
    const master = ctx.createGain();
    master.gain.value = this.volume * bed.gain;
    master.connect(ctx.destination);
    this.master = master;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = bed.filter;
    filter.connect(master);
    const source = ctx.createBufferSource();
    source.buffer = brownNoise(ctx);
    source.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = bed.layers.includes("waves") ? 0.7 : 0.18;
    source.connect(noiseGain);
    noiseGain.connect(filter);
    source.start();

    if (bed.layers.includes("waves")) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.15;
      lfoGain.gain.value = 0.4;
      lfo.connect(lfoGain);
      lfoGain.connect(noiseGain.gain);
      lfo.start();
    }

    for (const layer of bed.layers) {
      if (layer === "birds") this.every(ctx, 900, 2600, () => this.chirp(ctx, master));
      if (layer === "notes") this.every(ctx, 1400, 3200, () => this.chime(ctx, master));
      if (layer === "crickets") this.every(ctx, 400, 900, () => this.cricket(ctx, master));
      if (layer === "owl") this.every(ctx, 5000, 8000, () => this.owl(ctx, master));
      if (layer === "moo") this.every(ctx, 4000, 7000, () => this.moo(ctx, master));
      if (layer === "cluck") this.every(ctx, 1800, 3600, () => this.cluck(ctx, master));
      if (layer === "frog") this.every(ctx, 2200, 4200, () => this.frog(ctx, master));
      if (layer === "bee") this.bee(ctx, master);
      if (layer === "steps") this.every(ctx, 700, 1100, () => this.step(ctx, master));
      if (layer === "clock") this.every(ctx, 980, 1040, () => this.tick(ctx, master));
      if (layer === "wind") this.wind(ctx, master);
    }
    void ctx.resume();
  }

  pause() {
    void this.ctx?.suspend();
  }

  resume() {
    void this.ctx?.resume();
  }

  stop() {
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers = [];
    this.theme = null;
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    if (ctx) void ctx.close().catch(() => {});
  }

  private every(ctx: AudioContext, min: number, max: number, play: () => void) {
    const loop = () => {
      if (this.ctx !== ctx) return;
      play();
      this.timers.push(window.setTimeout(loop, min + Math.random() * (max - min)));
    };
    this.timers.push(window.setTimeout(loop, 400 + Math.random() * 800));
  }

  private blip(ctx: AudioContext, master: GainNode, freq: number, ms: number, gainValue: number, type: OscillatorType = "sine") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(master);
    const now = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);
    osc.start(now);
    osc.stop(now + ms / 1000 + 0.02);
    return osc;
  }

  private chirp(ctx: AudioContext, master: GainNode) {
    const osc = this.blip(ctx, master, 1500 + Math.random() * 1400, 160, 0.05);
    osc.frequency.exponentialRampToValueAtTime(Math.min(4200, osc.frequency.value * 1.5), ctx.currentTime + 0.1);
  }

  private chime(ctx: AudioContext, master: GainNode) {
    const notes = [523, 587, 659, 784, 880, 988];
    this.blip(ctx, master, notes[Math.floor(Math.random() * notes.length)] ?? 523, 1500, 0.035);
  }

  private cricket(ctx: AudioContext, master: GainNode) {
    this.blip(ctx, master, 3800 + Math.random() * 400, 40, 0.03, "square");
  }

  private owl(ctx: AudioContext, master: GainNode) {
    const osc = this.blip(ctx, master, 520, 420, 0.04);
    osc.frequency.exponentialRampToValueAtTime(340, ctx.currentTime + 0.35);
  }

  private moo(ctx: AudioContext, master: GainNode) {
    const osc = this.blip(ctx, master, 180, 700, 0.06);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.6);
  }

  private cluck(ctx: AudioContext, master: GainNode) {
    this.blip(ctx, master, 700 + Math.random() * 200, 90, 0.04, "triangle");
  }

  private frog(ctx: AudioContext, master: GainNode) {
    this.blip(ctx, master, 220, 120, 0.05, "triangle");
    window.setTimeout(() => {
      if (this.ctx === ctx) this.blip(ctx, master, 180, 140, 0.04, "triangle");
    }, 140);
  }

  private bee(ctx: AudioContext, master: GainNode) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 190;
    gain.gain.value = 0.012;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 500;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
  }

  private step(ctx: AudioContext, master: GainNode) {
    this.blip(ctx, master, 90 + Math.random() * 30, 80, 0.04, "triangle");
  }

  private tick(ctx: AudioContext, master: GainNode) {
    this.blip(ctx, master, 1400, 30, 0.025, "square");
  }

  private wind(ctx: AudioContext, master: GainNode) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 0.08;
    gain.gain.value = 0.04;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    osc.connect(gain);
    gain.connect(filter.frequency);
    filter.connect(master);
    const noise = ctx.createBufferSource();
    noise.buffer = brownNoise(ctx);
    noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.08;
    noise.connect(noiseGain);
    noiseGain.connect(filter);
    noise.start();
    osc.start();
  }
}

export const ambience = new AmbienceEngine();
