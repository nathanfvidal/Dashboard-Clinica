import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_AGENDAMENTO, statusBadgeClass } from "@/lib/status";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Agendamento = {
  id: string;
  data_consulta: string;
  horario: string;
  medico: string;
  especialidade: string;
  paciente_nome: string | null;
  paciente_telefone: string;
  status: string | null;
};

interface Props {
  agendamentos: Agendamento[];
}

export function ListaProximosAgendamentos({ agendamentos }: Props) {
  const queryClient = useQueryClient();
  const [filtroData, setFiltroData] = useState<string>("");
  const [filtroStatus, setFiltroStatus] = useState<string>("ativos");

  const mutate = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      toast({ title: "Status atualizado", description: `Agendamento marcado como ${vars.status}.` });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
    },
  });

  const lista = useMemo(() => {
    const hojeStr = format(new Date(), "yyyy-MM-dd");
    return agendamentos
      .filter((a) => {
        if ((a.status ?? "") === "disponivel") return false;
        if (filtroStatus === "ativos") {
          if (["cancelado", "finalizado"].includes(a.status ?? "")) return false;
        } else if (filtroStatus !== "todos" && a.status !== filtroStatus) {
          return false;
        }
        if (filtroData) {
          if (a.data_consulta !== filtroData) return false;
        } else {
          // por padrão mostra de hoje em diante
          if (a.data_consulta < hojeStr) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.data_consulta !== b.data_consulta) return a.data_consulta.localeCompare(b.data_consulta);
        return a.horario.localeCompare(b.horario);
      })
      .slice(0, 20);
  }, [agendamentos, filtroData, filtroStatus]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <CalendarCheck className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">Próximos agendamentos</CardTitle>
            <p className="text-xs text-muted-foreground">
              {lista.length} {lista.length === 1 ? "agendamento" : "agendamentos"} listados
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Data</Label>
            <Input
              type="date"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
              className="h-9 w-[160px]"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativos">Ativos (padrão)</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
                {STATUS_AGENDAMENTO.filter((s) => s.value !== "disponivel").map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <CalendarCheck className="h-8 w-8 opacity-40" />
            <p className="text-sm">Nenhum agendamento para os filtros atuais.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/40">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[110px]">Data</TableHead>
                  <TableHead className="w-[80px]">Hora</TableHead>
                  <TableHead>Médico</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((a) => {
                  const dataFmt = format(parseISO(a.data_consulta), "dd/MM EEE", { locale: ptBR });
                  const horaFmt = a.horario.slice(0, 5);
                  const isFinal = ["cancelado", "finalizado"].includes(a.status ?? "");
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium tabular-nums">{dataFmt}</TableCell>
                      <TableCell className="tabular-nums">{horaFmt}</TableCell>
                      <TableCell>{a.medico}</TableCell>
                      <TableCell className="text-muted-foreground">{a.especialidade}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{a.paciente_nome ?? "—"}</span>
                          <span className="text-xs text-muted-foreground">{a.paciente_telefone}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("capitalize", statusBadgeClass(a.status))}>
                          {a.status ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-[hsl(var(--accent-emerald))] hover:bg-[hsl(var(--accent-emerald)/0.15)]"
                            disabled={isFinal || a.status === "confirmado" || mutate.isPending}
                            onClick={() => mutate.mutate({ id: a.id, status: "confirmado" })}
                            title="Confirmar"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/15"
                            disabled={isFinal || mutate.isPending}
                            onClick={() => mutate.mutate({ id: a.id, status: "cancelado" })}
                            title="Cancelar"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
