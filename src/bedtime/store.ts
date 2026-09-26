import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { EMPTY_FAMILY, normalizeFamily, type Family } from "./family";

export const TIMER_CHOICES = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 45, label: "45 min" },
  { minutes: 60, label: "60 min" },
  { minutes: 0, label: "Sem limite" },
] as const;

export const RATE_CHOICES = [
  { value: 0.94, label: "Devagar" },
  { value: 1, label: "Calmo" },
  { value: 1.05, label: "Suave" },
] as const;

type Resume = { id: string; sentence: number };

type BedtimeState = {
  favorites: string[];
  toggleFavorite: (id: string) => void;
  timerMinutes: number;
  setTimerMinutes: (minutes: number) => void;
  rate: number;
  setRate: (rate: number) => void;
  volume: number;
  setVolume: (volume: number) => void;
  autoNext: boolean;
  setAutoNext: (autoNext: boolean) => void;
  resume: Resume | null;
  setResume: (resume: Resume | null) => void;
  family: Family;
  setFamily: (family: Family) => void;
};

export const useBedtime = create<BedtimeState>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (id) => {
        const favorites = get().favorites;
        set({
          favorites: favorites.includes(id)
            ? favorites.filter((item) => item !== id)
            : [...favorites, id],
        });
      },
      timerMinutes: 30,
      setTimerMinutes: (timerMinutes) => set({ timerMinutes }),
      rate: 1,
      setRate: (rate) => set({ rate }),
      volume: 1,
      setVolume: (volume) => set({ volume }),
      autoNext: true,
      setAutoNext: (autoNext) => set({ autoNext }),
      resume: null,
      setResume: (resume) => set({ resume }),
      family: EMPTY_FAMILY,
      setFamily: (family) => set({ family, resume: null }),
    }),
    {
      name: "ninar-bedtime",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<BedtimeState>;
        return {
          ...current,
          ...saved,
          family: normalizeFamily(saved.family ?? current.family),
        };
      },
    },
  ),
);
