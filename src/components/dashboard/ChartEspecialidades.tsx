import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

interface Props {
  agendamentos: Array<{ especialidade: string }>;
}

// Paleta vibrante via tokens do design system
const CORES = [
  "hsl(var(--primary))",
  "hsl(var(--accent-violet))",
  "hsl(var(--accent-emerald))",
  "hsl(var(--accent-amber))",
  "hsl(var(--accent-rose))",
  "hsl(var(--accent-cyan))",
];

export function ChartEspecialidades({ agendamentos }: Props) {
  const contagem = agendamentos.reduce<Record<string, number>>((acc, a) => {
    const key = a.especialidade || "Sem especialidade";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(contagem)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <GlassCard spotlight className="h-full">
      <GlassCardHeader className="pb-2">
        <GlassCardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Por especialidade
        </GlassCardTitle>
        <p className="text-xs text-muted-foreground/70">Distribuição atual</p>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="h-64">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Sem dados ainda
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={88}
                  paddingAngle={3}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    color: "hsl(var(--popover-foreground))",
                    boxShadow: "var(--shadow-elevated)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
