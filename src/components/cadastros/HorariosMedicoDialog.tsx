import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Medico } from "@/hooks/useMedicos";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PreviewSemana } from "./PreviewSemana";

interface Props {
  medico: Medico | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Horario {
  id: string;
  medico_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  duracao_consulta_min: number;
  ativo: boolean;
}

const DIAS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const TEMPLATE_PADRAO = [
  { dia_semana: 1, hora_inicio: "08:00", hora_fim: "18:00", duracao_consulta_min: 30 },
  { dia_semana: 2, hora_inicio: "08:00", hora_fim: "18:00", duracao_consulta_min: 30 },
  { dia_semana: 3, hora_inicio: "08:00", hora_fim: "18:00", duracao_consulta_min: 30 },
  { dia_semana: 4, hora_inicio: "08:00", hora_fim: "18:00", duracao_consulta_min: 30 },
  { dia_semana: 5, hora_inicio: "08:00", hora_fim: "18:00", duracao_consulta_min: 30 },
  { dia_semana: 6, hora_inicio: "08:00", hora_fim: "12:00", duracao_consulta_min: 30 },
];

export function HorariosMedicoDialog({ medico, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [linhas, setLinhas] = useState<
    Array<Partial<Horario> & { _key: string }>
  >([]);

  const { data: horarios } = useQuery({
    queryKey: ["horarios_medico", medico?.id],
    queryFn: async () => {
      if (!medico) return [];
      const { data, error } = await supabase
        .from("horarios_medico")
        .select("*")
        .eq("medico_id", medico.id)
        .order("dia_semana");
      if (error) throw error;
      return (data ?? []) as Horario[];
    },
    enabled: !!medico && open,
  });

  useEffect(() => {
    if (horarios) {
      setLinhas(
        horarios.map((h) => ({
          ...h,
          hora_inicio: h.hora_inicio.slice(0, 5),
          hora_fim: h.hora_fim.slice(0, 5),
          _key: h.id,
        })),
      );
    }
  }, [horarios]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!medico) return;
      // Estratégia simples: deleta tudo e reinsere
      const { error: delErr } = await supabase
        .from("horarios_medico")
        .delete()
        .eq("medico_id", medico.id);
      if (delErr) throw delErr;

      if (linhas.length > 0) {
        const payload = linhas.map((l) => ({
          medico_id: medico.id,
          dia_semana: Number(l.dia_semana ?? 1),
          hora_inicio: l.hora_inicio ?? "08:00",
          hora_fim: l.hora_fim ?? "18:00",
          duracao_consulta_min: Number(l.duracao_consulta_min ?? 30),
          ativo: true,
        }));
        const { error } = await supabase.from("horarios_medico").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Horários salvos" });
      queryClient.invalidateQueries({ queryKey: ["horarios_medico", medico?.id] });
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const adicionar = () =>
    setLinhas((l) => [
      ...l,
      {
        _key: crypto.randomUUID(),
        dia_semana: 1,
        hora_inicio: "08:00",
        hora_fim: "18:00",
        duracao_consulta_min: 30,
      },
    ]);

  const remover = (key: string) => setLinhas((l) => l.filter((x) => x._key !== key));

  const aplicarTemplate = () =>
    setLinhas(TEMPLATE_PADRAO.map((t) => ({ ...t, _key: crypto.randomUUID() })));

  const atualizar = (key: string, campo: keyof Horario, valor: string | number) =>
    setLinhas((l) => l.map((x) => (x._key === key ? { ...x, [campo]: valor } : x)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Horários — {medico?.nome}</DialogTitle>
          <DialogDescription>
            Defina os dias e horários de atendimento. Esses horários alimentam o gerador de
            agenda e a tool de busca da Sofia.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={aplicarTemplate}>
            Aplicar template padrão (seg-sex 08-18, sáb 08-12)
          </Button>
          <Button type="button" size="sm" onClick={adicionar}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar linha
          </Button>
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-auto pr-1">
          {linhas.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nenhum horário definido. Adicione manualmente ou aplique o template.
            </p>
          )}
          {linhas.map((l) => (
            <div
              key={l._key}
              className="grid grid-cols-12 items-end gap-2 rounded-md border border-border p-3"
            >
              <div className="col-span-4">
                <Label className="text-xs">Dia</Label>
                <Select
                  value={String(l.dia_semana ?? 1)}
                  onValueChange={(v) => atualizar(l._key, "dia_semana", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Início</Label>
                <Input
                  type="time"
                  value={l.hora_inicio ?? ""}
                  onChange={(e) => atualizar(l._key, "hora_inicio", e.target.value)}
                />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Fim</Label>
                <Input
                  type="time"
                  value={l.hora_fim ?? ""}
                  onChange={(e) => atualizar(l._key, "hora_fim", e.target.value)}
                />
              </div>
              <div className="col-span-1">
                <Label className="text-xs">Min</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={l.duracao_consulta_min ?? 30}
                  onChange={(e) =>
                    atualizar(l._key, "duracao_consulta_min", Number(e.target.value))
                  }
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button variant="ghost" size="icon" onClick={() => remover(l._key)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <PreviewSemana linhas={linhas} />
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar horários"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
