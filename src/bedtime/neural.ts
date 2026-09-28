type NeuralVoice = {
  falar: (
    texto: string,
    opcoes?: { velocidade?: number; ruido?: number; ruidoW?: number },
  ) => Promise<{ paraBlob: () => Blob }>;
};

type Progress = { status: string; progresso: number };

let pending: Promise<NeuralVoice> | null = null;
let storyId = "";
const clips = new Map<string, Promise<Blob>>();

export function loadVoice(onProgress?: (label: string) => void): Promise<NeuralVoice> {
  if (!pending) {
    pending = import("@pedrobef/vozz/piper")
      .then(({ Piper }) =>
        Piper.carregar({
          dispositivo: "wasm",
          threads: 1,
          aoProgredir: (progress: Progress) => {
            if (!onProgress) return;
            if (progress.status === "baixando") {
              const percent = Math.max(1, Math.round((progress.progresso || 0) * 100));
              onProgress(`Baixando a voz ${percent}%`);
              return;
            }
            if (progress.status === "cache") onProgress("Abrindo a voz");
            else onProgress("Preparando a voz");
          },
        }),
      )
      .catch((error: unknown) => {
        pending = null;
        throw error;
      });
  } else if (onProgress) onProgress("Preparando a voz");
  return pending;
}

export function clipFor(id: string, text: string, speed: number): Promise<Blob> {
  if (storyId !== id) {
    clips.clear();
    storyId = id;
  }
  const key = `${speed}\n${text}`;
  const cached = clips.get(key);
  if (cached) return cached;
  const job = loadVoice()
    .then((voice) => voice.falar(text, { velocidade: speed, ruido: 0.5, ruidoW: 0.65 }))
    .then((audio) => audio.paraBlob());
  clips.set(key, job);
  job.catch(() => {
    if (clips.get(key) === job) clips.delete(key);
  });
  return job;
}
