import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  accent?: "primary" | "emerald" | "amber" | "violet" | "rose" | "cyan";
}

// Mapeamento de acentos — usa tokens HSL semânticos do design system
const accentMap: Record<NonNullable<KpiCardProps["accent"]>, { bg: string; text: string; glow: string; ring: string }> = {
  primary: {
    bg: "bg-[hsl(var(--primary)/0.12)]",
    text: "text-primary",
    glow: "shadow-[0_0_24px_hsl(var(--primary)/0.35)]",
    ring: "ring-[hsl(var(--primary)/0.25)]",
  },
  emerald: {
    bg: "bg-[hsl(var(--accent-emerald)/0.12)]",
    text: "text-[hsl(var(--accent-emerald))]",
    glow: "shadow-[0_0_24px_hsl(var(--accent-emerald)/0.3)]",
    ring: "ring-[hsl(var(--accent-emerald)/0.25)]",
  },
  amber: {
    bg: "bg-[hsl(var(--accent-amber)/0.12)]",
    text: "text-[hsl(var(--accent-amber))]",
    glow: "shadow-[0_0_24px_hsl(var(--accent-amber)/0.3)]",
    ring: "ring-[hsl(var(--accent-amber)/0.25)]",
  },
  violet: {
    bg: "bg-[hsl(var(--accent-violet)/0.12)]",
    text: "text-[hsl(var(--accent-violet))]",
    glow: "shadow-[0_0_24px_hsl(var(--accent-violet)/0.3)]",
    ring: "ring-[hsl(var(--accent-violet)/0.25)]",
  },
  rose: {
    bg: "bg-[hsl(var(--accent-rose)/0.12)]",
    text: "text-[hsl(var(--accent-rose))]",
    glow: "shadow-[0_0_24px_hsl(var(--accent-rose)/0.3)]",
    ring: "ring-[hsl(var(--accent-rose)/0.25)]",
  },
  cyan: {
    bg: "bg-[hsl(var(--accent-cyan)/0.12)]",
    text: "text-[hsl(var(--accent-cyan))]",
    glow: "shadow-[0_0_24px_hsl(var(--accent-cyan)/0.3)]",
    ring: "ring-[hsl(var(--accent-cyan)/0.25)]",
  },
};

// Aceita os valores antigos ("blue") como sinônimos para compatibilidade
const normalizeAccent = (a?: string): NonNullable<KpiCardProps["accent"]> => {
  if (a === "blue") return "primary";
  if (a && a in accentMap) return a as NonNullable<KpiCardProps["accent"]>;
  return "primary";
};

export function KpiCard({ label, value, icon: Icon, hint, accent }: KpiCardProps) {
  const tone = accentMap[normalizeAccent(accent)];

  return (
    <GlassCard hover spotlight className="group relative h-full overflow-hidden">
      {/* Brilho sutil no topo do card ao passar o mouse */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="flex h-full items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 transition-all duration-300",
            tone.bg,
            tone.text,
            tone.ring,
            "group-hover:" + tone.glow,
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold leading-tight tracking-tight">{value}</p>
          {/* Slot do hint sempre reservado para manter altura uniforme entre KPIs */}
          <p className="min-h-[1rem] text-xs text-muted-foreground/80">{hint ?? "\u00A0"}</p>
        </div>
      </div>
    </GlassCard>
  );
}
