import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";

interface Props {
  agendamentos: Array<{ data_consulta: string }>;
}

export function ChartAgendamentos({ agendamentos }: Props) {
  // Últimos 14 dias
  const hoje = new Date();
  const dias = Array.from({ length: 14 }, (_, i) => subDays(hoje, 13 - i));

  const data = dias.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const count = agendamentos.filter((a) => a.data_consulta === key).length;
    return { dia: format(d, "dd/MM"), total: count };
  });

  const total = data.reduce((s, d) => s + d.total, 0);
  const media = total > 0 ? (total / data.length).toFixed(1) : "0";

  return (
    <GlassCard spotlight className="h-full">
      <GlassCardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <GlassCardTitle className="label-eyebrow !text-muted-foreground">
              Agendamentos por dia
            </GlassCardTitle>
            <p className="subtitle mt-0.5">Últimos 14 dias</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold leading-none text-primary">{total}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              média {media}/dia
            </p>
          </div>
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="h-64">
          {data.every((d) => d.total === 0) ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-medium text-muted-foreground">Sem agendamentos no período</p>
              <p className="text-xs text-muted-foreground/70">
                Os dados aparecem assim que o bot ou a recepção criarem consultas.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAgend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 4" stroke="hsl(var(--chart-grid))" />
                <XAxis
                  dataKey="dia"
                  stroke="hsl(var(--chart-axis))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--chart-axis))" }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="hsl(var(--chart-axis))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "hsl(var(--chart-axis))", fontFamily: "IBM Plex Mono, monospace" }}
                  width={32}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--chart-1) / 0.3)",
                    borderRadius: 10,
                    color: "hsl(var(--popover-foreground))",
                    boxShadow: "var(--shadow-elevated)",
                    fontSize: 12,
                  }}
                  labelStyle={{
                    color: "hsl(var(--muted-foreground))",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 4,
                  }}
                  itemStyle={{ color: "hsl(var(--chart-1))", fontWeight: 600 }}
                  formatter={(value: number) => [value, "Agendamentos"]}
                  cursor={{
                    stroke: "hsl(var(--chart-1))",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                    opacity: 0.5,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Agendamentos"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2.5}
                  fill="url(#colorAgend)"
                  activeDot={{
                    r: 5,
                    fill: "hsl(var(--chart-1))",
                    stroke: "hsl(var(--background))",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
