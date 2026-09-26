export type ChildGender = "menino" | "menina";

export type Family = {
  childName: string;
  childGender: ChildGender;
  momName: string;
  dadName: string;
  siblingName: string;
  siblingGender: ChildGender;
};

export const EMPTY_FAMILY: Family = {
  childName: "",
  childGender: "menino",
  momName: "",
  dadName: "",
  siblingName: "",
  siblingGender: "menino",
};

export function cleanName(value: unknown): string {
  return String(value ?? "")
    .replace(/[<>{}[\]\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);
}

export function familyReady(family: Family | null | undefined): boolean {
  return cleanName(family?.childName).length > 0;
}

export function normalizeFamily(value: unknown): Family {
  const raw = value && typeof value === "object" ? (value as Partial<Family>) : {};
  return {
    childName: cleanName(raw.childName),
    childGender: raw.childGender === "menina" ? "menina" : "menino",
    momName: cleanName(raw.momName),
    dadName: cleanName(raw.dadName),
    siblingName: cleanName(raw.siblingName),
    siblingGender: raw.siblingGender === "menina" ? "menina" : "menino",
  };
}

export function fillStory(text: string, family: Family): string {
  const boy = family.childGender !== "menina";
  const child = cleanName(family.childName) || "neném";
  const sibling = cleanName(family.siblingName);
  const siblingBoy = family.siblingGender !== "menina";
  const mom = cleanName(family.momName);
  const dad = cleanName(family.dadName);

  let out = text.replace(/\{\{#irmao\}\}([\s\S]*?)\{\{\/irmao\}\}/g, (_match, inner: string) => {
    if (!sibling) return "";
    return inner
      .replaceAll("{{irmao}}", siblingBoy ? `o irmãozinho ${sibling}` : `a irmãzinha ${sibling}`)
      .replaceAll("{{Irmao}}", siblingBoy ? `O irmãozinho ${sibling}` : `A irmãzinha ${sibling}`);
  });

  const words: Record<string, string> = {
    nome: child,
    art: boy ? "o" : "a",
    Art: boy ? "O" : "A",
    ele: boy ? "ele" : "ela",
    Ele: boy ? "Ele" : "Ela",
    dele: boy ? "dele" : "dela",
    do: boy ? "do" : "da",
    ao: boy ? "ao" : "à",
    filho: boy ? "filhinho" : "filhinha",
    quieto: boy ? "quietinho" : "quietinha",
    mamae: mom ? `a mamãe ${mom}` : "a mamãe",
    Mamae: mom ? `A mamãe ${mom}` : "A mamãe",
    papai: dad ? `o papai ${dad}` : "o papai",
    Papai: dad ? `O papai ${dad}` : "O papai",
  };

  for (const [key, value] of Object.entries(words)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }

  return out
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/([.!?])(?:\s*[.!?])+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
