import { useEffect, useRef, useState } from "react";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import { ChevronLeft, Heart, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { ChildGender } from "@/bedtime/family";
import type { NarratorSnapshot } from "@/bedtime/narrator";
import { formatClock, splitSentences, themeLabel, type Story } from "@/bedtime/stories";
import { RATE_CHOICES, TIMER_CHOICES } from "@/bedtime/store";
import { Mascot } from "./mascot";

type PlayerProps = {
  story: Story;
  snap: NarratorSnapshot;
  favorite: boolean;
  gender: ChildGender;
  onBack: () => void;
  onToggleFavorite: () => void;
  onToggle: () => void;
  onReplay: () => void;
  onSkip: (delta: number) => void;
  onStop: () => void;
  timerMinutes: number;
  onTimer: (minutes: number) => void;
  rate: number;
  onRate: (rate: number) => void;
  volume: number;
  onVolume: (volume: number) => void;
  autoNext: boolean;
  onAutoNext: (value: boolean) => void;
};

export function Player({
  story,
  snap,
  favorite,
  gender,
  onBack,
  onToggleFavorite,
  onToggle,
  onReplay,
  onSkip,
  onStop,
  timerMinutes,
  onTimer,
  rate,
  onRate,
  volume,
  onVolume,
  autoNext,
  onAutoNext,
}: PlayerProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const active = snap.storyId === story.id;
  const playing = active && snap.status === "playing";
  const paused = active && snap.status === "paused";
  const sentences = active && snap.sentences.length > 0 ? snap.sentences : splitSentences(story.text);
  const index = active ? snap.sentenceIndex : 0;
  const count = Math.max(sentences.length, 1);
  const progress = active ? Math.min(100, snap.progress * 100) : 0;
  const ended = active && snap.status === "idle";

  useEffect(() => {
    const node = scrollerRef.current?.querySelector<HTMLElement>("[data-current='true']");
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [index, story.id]);

  const statusLine = playing
    ? snap.preparing
      ? snap.voiceName && /Baixando|Abrindo/.test(snap.voiceName)
        ? snap.voiceName
        : "Preparando a voz"
      : snap.mode === "reading"
        ? "Texto na tela"
        : "Contando"
    : paused
      ? "Pausado"
      : ended
        ? "Esta história parou"
        : "Pronta para tocar";

  return (
    <section className="fixed inset-0 z-40 flex flex-col bg-bg" aria-label={story.title}>
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
        <header className="flex shrink-0 items-center gap-2 px-3 pt-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
            Biblioteca
          </button>
          <span className="ml-auto text-sm text-muted tabular-nums">
            {snap.remainingMs != null && (playing || paused) ? formatClock(snap.remainingMs) : ""}
          </span>
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? "Remover das favoritas" : "Guardar história"}
            onClick={onToggleFavorite}
            className="grid size-11 place-items-center text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
          >
            <Heart className={`size-5 ${favorite ? "fill-current text-fg" : ""}`} aria-hidden="true" />
          </button>
        </header>

        <div className="shrink-0 px-5 pt-2">
          <Mascot gender={gender} />
          <p className="text-center text-sm text-faint">
            {themeLabel(story.theme)} · {String(story.n).padStart(2, "0")}
          </p>
          <h2 className="mt-1 text-center font-display text-2xl leading-tight text-fg">{story.title}</h2>
          <p className="mt-1 text-center text-sm text-muted">{statusLine}</p>
        </div>

        <div ref={scrollerRef} className="story-scroll mt-2 min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          <div className="mx-auto max-w-[46ch] space-y-4">
            {sentences.map((sentence, sentenceIndex) => {
              const current = sentenceIndex === index;
              return (
                <p
                  key={`${story.id}-${sentenceIndex}`}
                  data-current={current ? "true" : "false"}
                  className={
                    current
                      ? "font-display text-lg leading-relaxed text-fg"
                      : sentenceIndex < index
                        ? "text-sm leading-relaxed text-faint"
                        : "text-sm leading-relaxed text-muted"
                  }
                >
                  {sentence}
                </p>
              );
            })}
          </div>
        </div>

        <div className="max-h-[42dvh] shrink-0 overflow-y-auto border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-3xl">
            <div className="h-1 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
              <div className="h-full rounded-full bg-moon" style={{ width: `${progress}%` }} />
            </div>
            <p className="sr-only">
              Frase {Math.min(index + 1, count)} de {count}
            </p>
            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label="História anterior"
                onClick={() => onSkip(-1)}
                className="grid size-12 place-items-center rounded-full border border-line text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
              >
                <SkipBack className="size-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={playing || paused ? onToggle : onReplay}
                aria-label={playing ? "Pausar" : paused ? "Continuar narração" : "Tocar história"}
                aria-pressed={playing}
                className="grid size-16 place-items-center rounded-full bg-primary text-primary-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
              >
                {playing ? (
                  <Pause className="size-7 fill-current" aria-hidden="true" />
                ) : (
                  <Play className="size-7 fill-current" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                aria-label="Próxima história"
                onClick={() => onSkip(1)}
                className="grid size-12 place-items-center rounded-full border border-line text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
              >
                <SkipForward className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {timerMinutes === 0 ? "Sem limite de tempo" : `Parar em ${timerMinutes} min`}
              </p>
              <button
                type="button"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((open) => !open)}
                className="h-11 rounded-full px-3 text-sm font-medium text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
              >
                {settingsOpen ? "Fechar ajustes" : "Ajustes"}
              </button>
            </div>
            {settingsOpen ? (
              <div className="mt-2 space-y-5 border-t border-line pt-4 pb-2">
                <div>
                  <p className="text-sm font-medium text-fg">Tempo</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TIMER_CHOICES.map((choice) => (
                      <button
                        key={choice.label}
                        type="button"
                        aria-pressed={timerMinutes === choice.minutes}
                        onClick={() => onTimer(choice.minutes)}
                        className={`h-11 rounded-full px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon ${
                          timerMinutes === choice.minutes ? "bg-primary text-primary-fg" : "bg-subtle text-muted"
                        }`}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-fg">Velocidade</p>
                  <div className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-subtle p-1">
                    {RATE_CHOICES.map((choice) => (
                      <button
                        key={choice.label}
                        type="button"
                        aria-pressed={rate === choice.value}
                        onClick={() => onRate(choice.value)}
                        className={`h-10 rounded-full text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon ${
                          rate === choice.value ? "bg-elevated text-fg" : "text-muted"
                        }`}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="text-sm font-medium text-fg">Volume</span>
                  <Slider.Root
                    className="relative mt-3 flex h-11 w-full touch-none items-center"
                    min={0}
                    max={1}
                    step={0.05}
                    value={[volume]}
                    onValueChange={([value]) => onVolume(value ?? 0)}
                    aria-label="Volume"
                  >
                    <Slider.Track className="relative h-1 grow rounded-full bg-subtle">
                      <Slider.Range className="absolute h-full rounded-full bg-moon" />
                    </Slider.Track>
                    <Slider.Thumb className="block size-5 rounded-full bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon" />
                  </Slider.Root>
                </label>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-fg">Seguir sozinho</p>
                    <p className="mt-1 max-w-[36ch] text-xs leading-relaxed text-faint">
                      Quando uma história acaba, a próxima começa, até você pausar ou o tempo terminar.
                    </p>
                  </div>
                  <Switch.Root
                    checked={autoNext}
                    onCheckedChange={onAutoNext}
                    aria-label="Seguir para a próxima história"
                    className="relative h-7 w-12 shrink-0 rounded-full bg-subtle data-[state=checked]:bg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
                  >
                    <Switch.Thumb className="switch-thumb block size-5 rounded-full bg-fg data-[state=checked]:bg-primary-fg" />
                  </Switch.Root>
                </div>
                <button
                  type="button"
                  onClick={onStop}
                  className="h-11 text-sm font-medium text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
                >
                  Encerrar ninar
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
