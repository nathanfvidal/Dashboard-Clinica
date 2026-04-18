import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, CheckCircle2, Pencil, Plus, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { toast } from "@/hooks/use-toast";
import { statusBadgeClass, STATUS_AGENDAMENTO } from "@/lib/status";
import { AgendamentoForm } from "@/components/agenda/AgendamentoForm";

interface Agendamento {
  id: string;
  especialidade: string;
  medico: string;
  especialidade_id: string | null;
  medico_id: string | null;
  data_consulta: string;
  horario: string;
  paciente_telefone: string;
  paciente_nome: string | null;
  status: string | null;
}

export default function Agenda() {
  const queryClient = useQueryClient();
  const [filtroData, setFiltroData] = useState("");
  const [filtroMedico, setFiltroMedico] = useState("");
  const [filtroEspecialidade, setFiltroEspecialidade] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [openNovo, setOpenNovo] = useState(false);
  const [editando, setEditando] = useState<Agendamento | null>(null);

  useRealtimeTable("agendamentos", ["agendamentos"]);

  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: ["agendamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*")
        .order("data_consulta", { ascending: true })
        .order("horario", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Agendamento[];
    },
  });

  const especialidades = useMemo(
    () => Array.from(new Set(agendamentos.map((a) => a.especialidade).filter(Boolean))).sort(),
    [agendamentos],
  );

  const filtrados = useMemo(() => {
    return agendamentos.filter((a) => {
      if (filtroData && a.data_consulta !== filtroData) return false;
      if (filtroMedico && !a.medico?.toLowerCase().includes(filtroMedico.toLowerCase())) return false;
      if (filtroEspecialidade !== "todas" && a.especialidade !== filtroEspecialidade) return false;
      if (filtroStatus !== "todos" && a.status !== filtroStatus) return false;
      return true;
    });
  }, [agendamentos, filtroData, filtroMedico, filtroEspecialidade, filtroStatus]);

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("agendamentos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast({ title: `Agendamento ${vars.status}` });
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow ring-1 ring-inset ring-white/10 sm:flex">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Agenda médica</h2>
            <p className="text-sm text-muted-foreground">
              Liste, crie, confirme ou cancele agendamentos manualmente.
            </p>
          </div>
        </div>
        <Dialog open={openNovo} onOpenChange={setOpenNovo}>
          <DialogTrigger asChild>
            <Button className="h-10">
              <Plus className="h-4 w-4" />
              Novo agendamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl border-border/40 bg-popover/80 backdrop-blur-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl tracking-tight">Novo agendamento</DialogTitle>
            </DialogHeader>
            <AgendamentoForm onDone={() => setOpenNovo(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <GlassCard>
        <GlassCardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Data
            </Label>
            <Input
              type="date"
              className="h-10 border-border/50 bg-background/40"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Médico
            </Label>
            <Input
              placeholder="Buscar por nome..."
              className="h-10 border-border/50 bg-background/40"
              value={filtroMedico}
              onChange={(e) => setFiltroMedico(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Especialidade
            </Label>
            <Select value={filtroEspecialidade} onValueChange={setFiltroEspecialidade}>
              <SelectTrigger className="h-10 border-border/50 bg-background/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {especialidades.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-10 border-border/50 bg-background/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {STATUS_AGENDAMENTO.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </GlassCardContent>
      </GlassCard>

      <GlassCard>
        <GlassCardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    Nenhum agendamento encontrado
                  </TableCell>
                </TableRow>
              )}
              {filtrados.map((a) => (
                <TableRow key={a.id} className="border-border/30 transition-colors hover:bg-accent/20">
                  <TableCell className="tabular-nums">{format(new Date(a.data_consulta + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                  <TableCell className="tabular-nums">{a.horario?.slice(0, 5)}</TableCell>
                  <TableCell className="font-medium">{a.medico}</TableCell>
                  <TableCell className="text-muted-foreground">{a.especialidade}</TableCell>
                  <TableCell>{a.paciente_nome ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{a.paciente_telefone}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadgeClass(a.status)}>
                      {a.status ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {a.status !== "confirmado" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 hover:bg-[hsl(var(--accent-emerald)/0.12)] hover:text-[hsl(var(--accent-emerald))]"
                          onClick={() => mudarStatus.mutate({ id: a.id, status: "confirmado" })}
                          title="Confirmar"
                          aria-label="Confirmar agendamento"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                      {a.status !== "cancelado" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => mudarStatus.mutate({ id: a.id, status: "cancelado" })}
                          title="Cancelar"
                          aria-label="Cancelar agendamento"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        onClick={() => setEditando(a)}
                        title="Editar"
                        aria-label="Editar agendamento"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlassCardContent>
      </GlassCard>

      <Dialog open={Boolean(editando)} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent className="max-w-xl border-border/40 bg-popover/80 backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl tracking-tight">Editar agendamento</DialogTitle>
          </DialogHeader>
          {editando && (
            <AgendamentoForm initial={editando} onDone={() => setEditando(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
