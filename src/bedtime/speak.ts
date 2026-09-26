import { createServerFn } from "@tanstack/react-start";

export type SpeakResult = { ok: true; audio: string } | { ok: false; error: string };

function tell(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  return sentences
    .map((sentence, index) => {
      const last = index === sentences.length - 1;
      const sleepy = /boa noite|dormiu|fechou os olh|nanar|shhh|soninho/i.test(sentence);
      if (/^(piu+|muu+|glu+|au+|miau+|cócegas|shhh+|uuu+|ping|toc|nhac|cocó|béé+)\b/i.test(sentence) && sentence.length < 28) {
        return `<sing-song>${sentence}</sing-song>`;
      }
      if (index === 0) return `${sentence} [pause]`;
      if (last && sleepy) return `[pause] <soft>${sentence}</soft>`;
      if (sentence.endsWith("?")) return `${sentence} [pause]`;
      if (sentence.endsWith("!") && sentence.length < 48) return `<emphasis>${sentence}</emphasis>`;
      if (index % 5 === 4) return `[breath] ${sentence}`;
      return sentence;
    })
    .join(" ");
}

export const speakStory = createServerFn({ method: "POST" })
  .validator((input: { text: string }): { text: string } => {
    const text = typeof input?.text === "string" ? input.text.trim() : "";
    if (text.length < 8 || text.length > 4500) throw new Error("Texto inválido");
    if (/[<>]/.test(text)) throw new Error("Texto inválido");
    return { text };
  })
  .handler(async ({ data }): Promise<SpeakResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "A voz não está disponível agora." };

    let res: Response;
    try {
      res = await fetch("https://api.x.ai/v1/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          text: tell(data.text),
          voice_id: "eve",
          language: "pt-BR",
          speed: 1,
          output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
        }),
      });
    } catch {
      return { ok: false, error: "A voz não respondeu." };
    }

    if (!res.ok) return { ok: false, error: "A voz não respondeu." };
    const audio = Buffer.from(await res.arrayBuffer()).toString("base64");
    if (audio.length < 800) return { ok: false, error: "A voz veio vazia." };
    return { ok: true, audio };
  });
