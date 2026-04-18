import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
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
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Agendamentos por dia (últimos 14)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--popover-foreground))",
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
