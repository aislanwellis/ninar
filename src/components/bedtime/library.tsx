import { Heart, Play, Search } from "lucide-react";
import type { ChildGender } from "@/bedtime/family";
import { Mascot } from "./mascot";
import {
  spokenMinutes,
  STORIES,
  themeLabel,
  THEMES,
  type Story,
  type ThemeId,
} from "@/bedtime/stories";
import { TIMER_CHOICES } from "@/bedtime/store";

export type LibraryFilter = "todas" | "favoritas" | ThemeId;

type LibraryProps = {
  query: string;
  onQuery: (value: string) => void;
  filter: LibraryFilter;
  onFilter: (filter: LibraryFilter) => void;
  stories: Story[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onPlay: (story: Story) => void;
  timerMinutes: number;
  onTimer: (minutes: number) => void;
  resumeTitle: string | null;
  onResume: () => void;
  padBottom: boolean;
  childName: string;
  childGender: ChildGender;
  onEditFamily: () => void;
};

export function Library({
  query,
  onQuery,
  filter,
  onFilter,
  stories,
  favorites,
  onToggleFavorite,
  onPlay,
  timerMinutes,
  onTimer,
  resumeTitle,
  onResume,
  padBottom,
  childName,
  childGender,
  onEditFamily,
}: LibraryProps) {
  return (
    <div className={`mx-auto w-full max-w-3xl px-5 pt-8 ${padBottom ? "pb-32" : "pb-16"}`}>
      <Mascot gender={childGender} />
      <header className="mt-2">
        <div className="min-w-0">
          <p className="text-center text-sm font-medium text-faint">Ninar</p>
          <h1 className="mt-2 text-center font-display text-3xl leading-tight text-fg">Oi, {childName}!</h1>
          <p className="mx-auto mt-3 max-w-[38ch] text-center text-pretty text-sm leading-relaxed text-muted">
            Seu amiguinho está aqui. Cinquenta continhos de cinco a sete minutos, com o nome de {childName},
            voz de contadora e os sons da história. Toque em um e fique juntinho até o soninho chegar.
          </p>
          <button
            type="button"
            onClick={onEditFamily}
            className="mx-auto mt-4 block text-sm font-medium text-moon focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
          >
            Editar a ficha
          </button>
        </div>
      </header>

      <section className="mt-8" aria-label="Quando encerrar o som">
        <h2 className="text-sm font-medium text-fg">Encerrar o som em</h2>
        <div className="chips -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          {TIMER_CHOICES.map((choice) => {
            const selected = timerMinutes === choice.minutes;
            return (
              <button
                key={choice.label}
                type="button"
                aria-pressed={selected}
                onClick={() => onTimer(choice.minutes)}
                className={`h-11 shrink-0 rounded-full px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon ${
                  selected ? "bg-primary text-primary-fg" : "bg-subtle text-muted"
                }`}
              >
                {choice.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-faint">
          As histórias seguem uma após a outra. No fim do tempo, a voz baixa e para.
        </p>
      </section>

      {resumeTitle ? (
        <button
          type="button"
          onClick={onResume}
          className="mt-6 flex w-full items-center gap-4 rounded-xl bg-elevated px-4 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-fg">
            <Play className="size-5 fill-current" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-faint">Continuar</span>
            <span className="block truncate font-medium text-fg">{resumeTitle}</span>
          </span>
        </button>
      ) : null}

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Buscar história"
          aria-label="Buscar história"
          className="h-12 w-full rounded-lg border border-line bg-elevated pr-4 pl-11 text-sm text-fg outline-none placeholder:text-faint focus-visible:border-moon"
        />
      </div>

      <div className="chips -mx-5 mt-4 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Filtrar histórias">
        <FilterChip selected={filter === "todas"} onClick={() => onFilter("todas")}>
          Todas
        </FilterChip>
        <FilterChip selected={filter === "favoritas"} onClick={() => onFilter("favoritas")}>
          Favoritas
        </FilterChip>
        {THEMES.map((theme) => (
          <FilterChip key={theme.id} selected={filter === theme.id} onClick={() => onFilter(theme.id)}>
            {theme.label}
          </FilterChip>
        ))}
      </div>

      <p className="mt-5 text-xs text-faint tabular-nums">
        {stories.length === STORIES.length ? "50 continhos" : `${stories.length} continhos`}
      </p>

      {stories.length === 0 ? (
        <p className="mt-6 max-w-[36ch] text-sm leading-relaxed text-muted">
          {filter === "favoritas" && query.trim() === ""
            ? "Nenhuma favorita ainda. O coração ao lado do título guarda as que funcionam melhor nesta casa."
            : "Nenhuma história com esse nome. Tente outro jeito de buscar."}
        </p>
      ) : (
        <ul className="mt-2 border-t border-line">
          {stories.map((story) => {
            const favorite = favorites.includes(story.id);
            return (
              <li key={story.id} className="flex items-stretch border-b border-line">
                <button
                  type="button"
                  data-story={story.id}
                  onClick={() => onPlay(story)}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
                >
                  <span className="w-8 shrink-0 text-xs text-faint tabular-nums">
                    {String(story.n).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-fg">{story.title}</span>
                    <span className="mt-0.5 block text-xs text-faint">
                      {themeLabel(story.theme)} · {spokenMinutes(story.text)} min
                    </span>
                  </span>
                  <Play className="size-4 shrink-0 text-muted" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-pressed={favorite}
                  aria-label={favorite ? `Remover ${story.title} das favoritas` : `Guardar ${story.title}`}
                  onClick={() => onToggleFavorite(story.id)}
                  className="grid w-12 shrink-0 place-items-center text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
                >
                  <Heart className={`size-5 ${favorite ? "fill-current text-fg" : ""}`} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 max-w-[46ch] text-sm leading-relaxed text-faint">
        O próprio celular conta a história em voz alta, com o nome da criança, e um som leve fica por baixo. Não tem cobrança. A ficha fica salva neste aparelho.
      </p>
    </div>
  );
}

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`h-11 shrink-0 rounded-full px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon ${
        selected ? "bg-primary text-primary-fg" : "bg-elevated text-muted"
      }`}
    >
      {children}
    </button>
  );
}
