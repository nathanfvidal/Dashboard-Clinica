import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Agendamento atual a ser remarcado
type AgendamentoBase = {
  id: string;
  data_consulta: string;
  horario: string;
  medico: string;
  especialidade: string;
  paciente_nome: string | null;
  paciente_telefone: string;
  medico_id: string | null;
};

interface Props {
  agendamento: AgendamentoBase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Slot = {
  id: string;
  data_consulta: string;
  horario: string;
};

export function RemarcarAgendamentoDialog({ agendamento, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [slotEscolhido, setSlotEscolhido] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setSlotEscolhido(null);
  }, [open]);

  // Busca slots disponíveis do mesmo médico, a partir de hoje
  const { data: slots = [], isLoading } = useQuery({
    enabled: open && !!agendamento?.medico_id,
    queryKey: ["slots-disponiveis-remarcacao", agendamento?.medico_id, agendamento?.id],
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("agendamentos")
        .select("id, data_consulta, horario")
        .eq("medico_id", agendamento!.medico_id!)
        .eq("status", "disponivel")
        .gte("data_consulta", hoje)
        .order("data_consulta", { ascending: true })
        .order("horario", { ascending: true })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as Slot[];
    },
  });

  // Agrupa por data
  const slotsPorDia = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const arr = map.get(s.data_consulta) ?? [];
      arr.push(s);
      map.set(s.data_consulta, arr);
    }
    return Array.from(map.entries());
  }, [slots]);

  // Remarcação atômica via RPC: preserva histórico (status='remarcado') + libera slot antigo + ocupa o novo
  const remarcar = useMutation({
    mutationFn: async () => {
      if (!agendamento || !slotEscolhido) throw new Error("Dados incompletos");
      const { error } = await supabase.rpc("remarcar_agendamento", {
        p_antigo: agendamento.id,
        p_novo: slotEscolhido,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      toast({
        title: "Remarcação concluída",
        description: "O paciente foi movido para o novo horário.",
      });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({
        title: "Erro ao remarcar",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  if (!agendamento) return null;

  const semMedicoId = !agendamento.medico_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Remarcar agendamento
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">
              {agendamento.paciente_nome ?? agendamento.paciente_telefone}
            </span>{" "}
            — {agendamento.especialidade} com {agendamento.medico}
            <br />
            Atual:{" "}
            <span className="font-medium text-foreground">
              {format(parseISO(agendamento.data_consulta), "dd/MM/yyyy EEE", { locale: ptBR })} às{" "}
              {agendamento.horario.slice(0, 5)}
            </span>
          </DialogDescription>
        </DialogHeader>

        {semMedicoId ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Este agendamento não tem médico vinculado (medico_id ausente). Não dá pra remarcar
            automaticamente — é preciso cancelar e criar manualmente.
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando horários disponíveis...
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-lg border border-border/40 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Nenhum horário disponível para {agendamento.medico}.
            <br />
            Gere agenda em Cadastros → Médicos.
          </div>
        ) : (
          <ScrollArea className="h-[360px] pr-3">
            <div className="space-y-4">
              {slotsPorDia.map(([dia, slotsDoDia]) => (
                <div key={dia}>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline" className="font-medium">
                      {format(parseISO(dia), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {slotsDoDia.length} {slotsDoDia.length === 1 ? "horário" : "horários"}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {slotsDoDia.map((s) => {
                      const ativo = slotEscolhido === s.id;
                      return (
                        <Button
                          key={s.id}
                          type="button"
                          size="sm"
                          variant={ativo ? "default" : "outline"}
                          className={cn(
                            "tabular-nums",
                            ativo && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                          )}
                          onClick={() => setSlotEscolhido(s.id)}
                        >
                          {s.horario.slice(0, 5)}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={remarcar.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => remarcar.mutate()}
            disabled={!slotEscolhido || remarcar.isPending || semMedicoId}
          >
            {remarcar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar remarcação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
