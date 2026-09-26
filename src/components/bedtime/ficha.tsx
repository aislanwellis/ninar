import { useState } from "react";
import { cleanName, type ChildGender, type Family } from "@/bedtime/family";
import { Mascot } from "./mascot";

type FichaProps = {
  initial: Family;
  onSave: (family: Family) => void;
  onCancel: (() => void) | null;
};

function GenderChips({
  value,
  onChange,
  label,
}: {
  value: ChildGender;
  onChange: (value: ChildGender) => void;
  label: string;
}) {
  return (
    <div className="mt-3 flex gap-2" role="group" aria-label={label}>
      {(
        [
          ["menino", "Menino"],
          ["menina", "Menina"],
        ] as const
      ).map(([id, text]) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(id)}
            className={`h-11 flex-1 rounded-full text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon ${
              selected ? "bg-primary text-primary-fg" : "bg-subtle text-muted"
            }`}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

export function Ficha({ initial, onSave, onCancel }: FichaProps) {
  const [childName, setChildName] = useState(initial.childName);
  const [childGender, setChildGender] = useState<ChildGender>(initial.childGender);
  const [momName, setMomName] = useState(initial.momName);
  const [dadName, setDadName] = useState(initial.dadName);
  const [siblingName, setSiblingName] = useState(initial.siblingName);
  const [siblingGender, setSiblingGender] = useState<ChildGender>(initial.siblingGender);
  const [error, setError] = useState("");

  const save = () => {
    const child = cleanName(childName);
    if (!child) {
      setError("Escreva o nome da criança.");
      return;
    }
    onSave({
      childName: child,
      childGender,
      momName: cleanName(momName),
      dadName: cleanName(dadName),
      siblingName: cleanName(siblingName),
      siblingGender,
    });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-8 pb-16">
      <header>
        <Mascot gender={childGender} />
        <p className="mt-2 text-center text-sm font-medium text-faint">Ninar</p>
        <h1 className="mt-3 font-display text-2xl leading-tight text-fg">A ficha da criança.</h1>
        <p className="mt-3 max-w-[42ch] text-pretty text-sm leading-relaxed text-muted">
          O nome entra em cada continho. A história passa a ser contada para essa criança, com a
          mamãe, o papai e o irmãozinho, se houver.
        </p>
      </header>

      <form
        className="mt-8 flex max-w-md flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label className="block">
          <span className="text-sm font-medium text-fg">Nome da criança</span>
          <input
            value={childName}
            onChange={(event) => {
              setChildName(event.target.value);
              setError("");
            }}
            placeholder="Azaf"
            autoComplete="off"
            className="mt-2 h-12 w-full rounded-lg border border-line bg-elevated px-4 text-sm text-fg outline-none placeholder:text-faint focus-visible:border-moon"
          />
          {error ? <span className="mt-2 block text-sm text-muted">{error}</span> : null}
        </label>

        <div>
          <p className="text-sm font-medium text-fg">É menino ou menina?</p>
          <GenderChips value={childGender} onChange={setChildGender} label="Menino ou menina" />
        </div>

        <label className="block">
          <span className="text-sm font-medium text-fg">Nome da mamãe</span>
          <input
            value={momName}
            onChange={(event) => setMomName(event.target.value)}
            placeholder="Pode deixar em branco"
            autoComplete="off"
            className="mt-2 h-12 w-full rounded-lg border border-line bg-elevated px-4 text-sm text-fg outline-none placeholder:text-faint focus-visible:border-moon"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-fg">Nome do papai</span>
          <input
            value={dadName}
            onChange={(event) => setDadName(event.target.value)}
            placeholder="Pode deixar em branco"
            autoComplete="off"
            className="mt-2 h-12 w-full rounded-lg border border-line bg-elevated px-4 text-sm text-fg outline-none placeholder:text-faint focus-visible:border-moon"
          />
        </label>

        <div>
          <label className="block">
            <span className="text-sm font-medium text-fg">Nome do irmãozinho</span>
            <span className="mt-1 block text-sm text-faint">Opcional. Se ficar vazio, as histórias não falam dele.</span>
            <input
              value={siblingName}
              onChange={(event) => setSiblingName(event.target.value)}
              placeholder="Nome do irmão ou da irmã"
              autoComplete="off"
              className="mt-2 h-12 w-full rounded-lg border border-line bg-elevated px-4 text-sm text-fg outline-none placeholder:text-faint focus-visible:border-moon"
            />
          </label>
          {cleanName(siblingName) ? (
            <div className="mt-4">
              <p className="text-sm font-medium text-fg">O irmãozinho é</p>
              <GenderChips value={siblingGender} onChange={setSiblingGender} label="Irmão ou irmã" />
            </div>
          ) : null}
        </div>

        <div className="flex gap-3">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="h-12 flex-1 rounded-full bg-subtle text-sm font-medium text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
            >
              Voltar
            </button>
          ) : null}
          <button
            type="submit"
            className="h-12 flex-1 rounded-full bg-primary text-sm font-medium text-primary-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moon"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
