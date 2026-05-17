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

// Paleta verde-forward com acentos quentes/frios para distinguir séries
const CORES = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-7))",
  "hsl(var(--chart-8))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
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

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <GlassCard spotlight className="h-full">
      <GlassCardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <GlassCardTitle className="label-eyebrow !text-muted-foreground">
              Por especialidade
            </GlassCardTitle>
            <p className="subtitle mt-0.5">Distribuição atual</p>
          </div>
          {total > 0 && (
            <div className="text-right">
              <p className="font-mono text-lg font-semibold leading-none text-primary">{total}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {data.length} {data.length === 1 ? "área" : "áreas"}
              </p>
            </div>
          )}
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="h-64">
          {data.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
              <p className="text-sm font-medium text-muted-foreground">Nenhuma especialidade ainda</p>
              <p className="text-xs text-muted-foreground/70">
                A distribuição vai aparecer quando houver agendamentos com especialidade definida.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
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
                    border: "1px solid hsl(var(--chart-1) / 0.3)",
                    borderRadius: 10,
                    color: "hsl(var(--popover-foreground))",
                    boxShadow: "var(--shadow-elevated)",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  formatter={(value: number, name: string) => {
                    const pct = total ? ((value / total) * 100).toFixed(1) : "0";
                    return [`${value} (${pct}%)`, name];
                  }}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: 12,
                    color: "hsl(var(--foreground))",
                    paddingTop: 8,
                  }}
                  iconType="circle"
                  iconSize={9}
                  formatter={(value) => (
                    <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
