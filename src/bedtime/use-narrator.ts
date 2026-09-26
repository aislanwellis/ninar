import { useCallback, useEffect, useRef, useState } from "react";
import { IDLE_SNAPSHOT, Narrator, type NarratorSnapshot } from "./narrator";
import { presentStory, storyById, type Story } from "./stories";
import { useBedtime } from "./store";

function storyNow(id: string): Story | undefined {
  const story = storyById(id);
  if (!story) return undefined;
  return presentStory(story, useBedtime.getState().family);
}

export function useNarrator() {
  const [snap, setSnap] = useState<NarratorSnapshot>(IDLE_SNAPSHOT);
  const narratorRef = useRef<Narrator | null>(null);
  const queueRef = useRef<string[]>([]);
  const autoNextRef = useRef(true);
  const rate = useBedtime((state) => state.rate);
  const volume = useBedtime((state) => state.volume);
  const timerMinutes = useBedtime((state) => state.timerMinutes);
  const autoNext = useBedtime((state) => state.autoNext);
  const setResume = useBedtime((state) => state.setResume);
  const settingsRef = useRef({ rate, volume, timerMinutes });

  autoNextRef.current = autoNext;
  settingsRef.current = { rate, volume, timerMinutes };

  useEffect(() => {
    const narrator = new Narrator({
      onSnapshot: setSnap,
      getSettings: () => settingsRef.current,
      onStoryEnded: (id) => {
        if (!autoNextRef.current) return;
        const queue = queueRef.current;
        if (queue.length === 0) return;
        const index = queue.indexOf(id);
        const nextId = queue[(index + 1 + queue.length) % queue.length];
        const next = nextId ? storyNow(nextId) : undefined;
        if (next) narrator.start(next, 0);
      },
    });
    narratorRef.current = narrator;
    return () => {
      narrator.dispose();
      narratorRef.current = null;
    };
  }, []);

  useEffect(() => {
    narratorRef.current?.setTimerMinutes(timerMinutes);
  }, [timerMinutes]);

  useEffect(() => {
    if (!snap.storyId) return;
    if (snap.status === "playing" || snap.status === "paused") {
      setResume({ id: snap.storyId, sentence: snap.sentenceIndex });
    }
  }, [setResume, snap.sentenceIndex, snap.status, snap.storyId]);

  const play = useCallback((story: Story, queue: string[], from = 0) => {
    queueRef.current = queue;
    narratorRef.current?.start(story, from);
  }, []);

  const toggle = useCallback(() => {
    const narrator = narratorRef.current;
    if (!narrator) return;
    const status = narrator.snapshot().status;
    if (status === "playing") narrator.pause();
    else if (status === "paused") narrator.resume();
  }, []);

  const stop = useCallback(() => {
    narratorRef.current?.stop();
  }, []);

  const skip = useCallback((delta: number) => {
    const narrator = narratorRef.current;
    if (!narrator) return;
    const current = narrator.snapshot().storyId;
    const queue = queueRef.current;
    if (queue.length === 0) return;
    const index = queue.indexOf(current ?? "");
    const start = index < 0 ? 0 : index;
    const nextId = queue[(start + delta + queue.length) % queue.length];
    const story = nextId ? storyNow(nextId) : undefined;
    if (story) narrator.start(story, 0);
  }, []);

  return { snap, play, toggle, stop, skip };
}
