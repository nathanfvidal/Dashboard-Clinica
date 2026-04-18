import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  medicoId: string;
  medicoNome: string;
}

function primeiroDiaProximoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().slice(0, 10);
}

function ultimoDiaProximoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 2, 0).toISOString().slice(0, 10);
}

export function GerarAgendaButton({ medicoId, medicoNome }: Props) {
  const [open, setOpen] = useState(false);
  const [inicio, setInicio] = useState(primeiroDiaProximoMes());
  const [fim, setFim] = useState(ultimoDiaProximoMes());
  const queryClient = useQueryClient();

  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("gerar_agenda_mes", {
        p_medico_id: medicoId,
        p_data_inicio: inicio,
        p_data_fim: fim,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      toast({
        title: "Agenda gerada",
        description: `${count} slots criados para ${medicoNome}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      setOpen(false);
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarPlus className="mr-2 h-4 w-4" /> Gerar agenda
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar agenda — {medicoNome}</DialogTitle>
          <DialogDescription>
            Cria slots disponíveis no período baseado nos horários cadastrados. Slots
            existentes não são duplicados.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ger-inicio">Data início</Label>
            <Input
              id="ger-inicio"
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ger-fim">Data fim</Label>
            <Input
              id="ger-fim"
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => gerar.mutate()} disabled={gerar.isPending}>
            {gerar.isPending ? "Gerando..." : "Gerar slots"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
