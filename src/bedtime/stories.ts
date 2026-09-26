import { fillStory, type Family } from "./family";
import { PART_A } from "./parts/a";
import { PART_B } from "./parts/b";
import { PART_C } from "./parts/c";
import { PART_D } from "./parts/d";
import { PART_E } from "./parts/e";
import { THEMES, type Story, type ThemeId } from "./types";

export { THEMES };
export type { Story, ThemeId };

const seeds = [...PART_A, ...PART_B, ...PART_C, ...PART_D, ...PART_E];

export const STORIES: Story[] = seeds.map((seed, index) => ({
  id: `s${String(index + 1).padStart(3, "0")}`,
  n: index + 1,
  title: seed.title,
  theme: seed.theme,
  text: seed.text.replace(/\s+/g, " ").trim(),
}));

export function presentStory(story: Story, family: Family): Story {
  return {
    ...story,
    title: fillStory(story.title, family),
    text: fillStory(story.text, family),
  };
}

export function presentStories(family: Family): Story[] {
  return STORIES.map((story) => presentStory(story, family));
}

export function themeLabel(id: ThemeId): string {
  return THEMES.find((theme) => theme.id === id)?.label ?? id;
}

export function storyById(id: string): Story | undefined {
  return STORIES.find((story) => story.id === id);
}

export function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()];
}

export function spokenMinutes(text: string, rate = 1): number {
  const words = text.trim().split(/\s+/).length;
  const wpm = 135 * rate;
  return Math.max(1, Math.round(words / wpm));
}

export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function spokenScript(story: Story): string {
  return `${story.title}. ${story.text}`;
}
