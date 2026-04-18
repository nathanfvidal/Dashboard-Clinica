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

  return (
    <GlassCard spotlight className="h-full">
      <GlassCardHeader className="pb-2">
        <GlassCardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Agendamentos por dia
        </GlassCardTitle>
        <p className="text-xs text-muted-foreground/70">Últimos 14 dias</p>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAgend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 10,
                  color: "hsl(var(--popover-foreground))",
                  boxShadow: "var(--shadow-elevated)",
                }}
                cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4", opacity: 0.5 }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill="url(#colorAgend)"
                activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
