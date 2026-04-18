import {
  Stethoscope,
  Heart,
  Leaf,
  Flower2,
  Bone,
  Baby,
  Brain,
  Eye,
  Ear,
  Pill,
  Activity,
  Syringe,
  Smile,
  HeartPulse,
  type LucideIcon,
} from "lucide-react";

// Mapa de ícones disponíveis para especialidades.
// A chave é salva no banco em "especialidades.icone" (texto).
// Mantemos compatibilidade com os emojis antigos via fallback.
export const ICONES_ESPECIALIDADE: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "stethoscope", label: "Clínica Geral", Icon: Stethoscope },
  { value: "heart", label: "Cardiologia", Icon: Heart },
  { value: "heart-pulse", label: "Cardio (pulso)", Icon: HeartPulse },
  { value: "leaf", label: "Dermatologia", Icon: Leaf },
  { value: "flower", label: "Ginecologia", Icon: Flower2 },
  { value: "bone", label: "Ortopedia", Icon: Bone },
  { value: "baby", label: "Pediatria", Icon: Baby },
  { value: "brain", label: "Neurologia", Icon: Brain },
  { value: "eye", label: "Oftalmologia", Icon: Eye },
  { value: "ear", label: "Otorrino", Icon: Ear },
  { value: "pill", label: "Farmácia", Icon: Pill },
  { value: "syringe", label: "Vacinas", Icon: Syringe },
  { value: "smile", label: "Odontologia", Icon: Smile },
  { value: "activity", label: "Geral / Outros", Icon: Activity },
];

// Compatibilidade com emojis antigos salvos no banco
const EMOJI_TO_ICON: Record<string, string> = {
  "\u{1FA7A}": "stethoscope", // 🩺
  "\u2764\uFE0F": "heart", // ❤️
  "\u2764": "heart",
  "\u{1F33F}": "leaf", // 🌿
  "\u{1F9F4}": "leaf", // 🧴 (frasco — usar leaf como dermatologia)
  "\u{1F338}": "flower", // 🌸
  "\u{1F9B4}": "bone", // 🦴
  "\u{1F476}": "baby", // 👶
  "\u{1F9D2}": "baby", // 🧒
};

const ICONE_PADRAO: LucideIcon = Stethoscope;

// Resolve um valor (chave nova OU emoji antigo) para o componente de ícone
export function getIconeEspecialidade(valor?: string | null): LucideIcon {
  if (!valor) return ICONE_PADRAO;
  const chave = EMOJI_TO_ICON[valor] ?? valor;
  const item = ICONES_ESPECIALIDADE.find((i) => i.value === chave);
  return item?.Icon ?? ICONE_PADRAO;
}
