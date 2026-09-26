export const THEMES = [
  { id: "lua", label: "Lua" },
  { id: "floresta", label: "Floresta" },
  { id: "mar", label: "Mar" },
  { id: "fazenda", label: "Fazenda" },
  { id: "bichos", label: "Bichinhos" },
  { id: "jardim", label: "Jardim" },
  { id: "caminho", label: "Caminho" },
  { id: "casinha", label: "Casinha" },
  { id: "nuvem", label: "Nuvem" },
  { id: "sonho", label: "Sonho" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export type Story = {
  id: string;
  n: number;
  title: string;
  theme: ThemeId;
  text: string;
};

export type StorySeed = {
  theme: ThemeId;
  title: string;
  text: string;
};
