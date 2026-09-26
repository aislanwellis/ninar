import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import { familyReady, normalizeFamily } from "@/bedtime/family";
import { fold, presentStories, presentStory, storyById, STORIES, themeLabel, type Story } from "@/bedtime/stories";
import { useBedtime } from "@/bedtime/store";
import { useNarrator } from "@/bedtime/use-narrator";
import { Ficha } from "./ficha";
import { Library, type LibraryFilter } from "./library";
import { Lights } from "./lights";
import { Mascot } from "./mascot";
import { Player } from "./player";

function queueFor(story: Story, visible: Story[]): string[] {
  if (visible.some((item) => item.id === story.id)) return visible.map((item) => item.id);
  return STORIES.map((item) => item.id);
}

export function BedtimeApp() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("todas");
  const [playerOpen, setPlayerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [booted, setBooted] = useState(false);
  const favorites = useBedtime((state) => state.favorites);
  const toggleFavorite = useBedtime((state) => state.toggleFavorite);
  const timerMinutes = useBedtime((state) => state.timerMinutes);
  const setTimerMinutes = useBedtime((state) => state.setTimerMinutes);
  const rate = useBedtime((state) => state.rate);
  const setRate = useBedtime((state) => state.setRate);
  const volume = useBedtime((state) => state.volume);
  const setVolume = useBedtime((state) => state.setVolume);
  const autoNext = useBedtime((state) => state.autoNext);
  const setAutoNext = useBedtime((state) => state.setAutoNext);
  const resume = useBedtime((state) => state.resume);
  const family = normalizeFamily(useBedtime((state) => state.family));
  const setFamily = useBedtime((state) => state.setFamily);
  const { snap, play, toggle, stop, skip } = useNarrator();

  useLayoutEffect(() => {
    let alive = true;
    const finish = () => {
      if (!alive) return;
      const current = useBedtime.getState().rate;
      if (current === 0.78) useBedtime.getState().setRate(0.94);
      else if (current === 0.9) useBedtime.getState().setRate(1);
      setBooted(true);
    };
    const unsub = useBedtime.persist.onFinishHydration(finish);
    if (useBedtime.persist.hasHydrated()) finish();
    else void Promise.resolve(useBedtime.persist.rehydrate()).catch(() => finish());
    const timer = window.setTimeout(finish, 280);
    return () => {
      alive = false;
      unsub();
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.key !== " " || snap.status === "idle") return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [snap.status, toggle]);

  const catalog = useMemo(() => presentStories(family), [family]);

  const visible = useMemo(() => {
    let list = catalog;
    if (filter === "favoritas") list = list.filter((story) => favorites.includes(story.id));
    else if (filter !== "todas") list = list.filter((story) => story.theme === filter);
    const needle = fold(query.trim());
    if (!needle) return list;
    return list.filter((story) =>
      fold(`${story.title} ${story.text} ${themeLabel(story.theme)}`).includes(needle),
    );
  }, [catalog, favorites, filter, query]);

  const openBase = snap.storyId ? storyById(snap.storyId) : undefined;
  const openStory = openBase ? presentStory(openBase, family) : undefined;
  const resumeBase = resume ? storyById(resume.id) : undefined;
  const resumeStory = resumeBase ? presentStory(resumeBase, family) : undefined;
  const sessionOn = snap.status === "playing" || snap.status === "paused";
  const saved = familyReady(family);

  const startStory = (story: Story, from = 0) => {
    play(story, queueFor(story, visible), from);
    setPlayerOpen(true);
  };

  const endSession = () => {
    stop();
    setPlayerOpen(false);
  };

  if (!booted) {
    return (
      <main className="relative grid min-h-dvh place-items-center" data-screen="opening">
        <div className="sky" aria-hidden="true" />
        <Lights />
        <div>
          <Mascot gender={family.childGender} />
          <p className="text-center font-display text-3xl text-fg">Ninar</p>
        </div>
      </main>
    );
  }

  if (!saved || editing) {
    return (
      <main className="relative min-h-dvh" data-screen="ficha">
        <div className="sky" aria-hidden="true" />
        <Lights />
        <Ficha
          initial={family}
          onCancel={saved ? () => setEditing(false) : null}
          onSave={(next) => {
            stop();
            setPlayerOpen(false);
            setFamily(next);
            setEditing(false);
            setQuery("");
          }}
        />
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh" data-screen={playerOpen ? "player" : "library"} data-playback={snap.status}>
      <div className="sky" aria-hidden="true" />
      <Lights />
      <div inert={playerOpen} aria-hidden={playerOpen}>
        <Library
          query={query}
          onQuery={setQuery}
          filter={filter}
          onFilter={setFilter}
          stories={visible}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onPlay={(story) => startStory(story, 0)}
          timerMinutes={timerMinutes}
          onTimer={setTimerMinutes}
          resumeTitle={resumeStory?.title ?? null}
          onResume={() => {
            if (!resumeStory || !resume) return;
            startStory(resumeStory, resume.sentence);
          }}
          padBottom={sessionOn && !playerOpen}
          childName={family.childName}
          childGender={family.childGender}
          onEditFamily={() => setEditing(true)}
        />
      </div>

      {playerOpen && openStory ? (
        <Player
          story={openStory}
          snap={snap}
          favorite={favorites.includes(openStory.id)}
          gender={family.childGender}
          onBack={() => setPlayerOpen(false)}
          onToggleFavorite={() => toggleFavorite(openStory.id)}
          onToggle={toggle}
          onReplay={() => startStory(openStory, 0)}
          onSkip={skip}
          onStop={endSession}
          timerMinutes={timerMinutes}
          onTimer={setTimerMinutes}
          rate={rate}
          onRate={setRate}
          volume={volume}
          onVolume={setVolume}
          autoNext={autoNext}
          onAutoNext={setAutoNext}
        />
      ) : null}

      {sessionOn && !playerOpen && openStory ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-elevated px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <button
              type="button"
              onClick={() => setPlayerOpen(true)}
              className="min-w-0 flex-1 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
            >
              <span className="block truncate font-medium text-fg">{openStory.title}</span>
              <span className="block text-xs text-faint">
                {snap.preparing ? "Preparando a voz" : snap.status === "playing" ? "Tocando" : "Pausado"}
              </span>
            </button>
            <button
              type="button"
              aria-label={snap.status === "playing" ? "Pausar" : "Continuar narração"}
              onClick={toggle}
              className="grid size-11 place-items-center rounded-full bg-primary text-primary-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
            >
              {snap.status === "playing" ? (
                <Pause className="size-5 fill-current" aria-hidden="true" />
              ) : (
                <Play className="size-5 fill-current" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              aria-label="Encerrar ninar"
              onClick={endSession}
              className="grid size-11 place-items-center text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
