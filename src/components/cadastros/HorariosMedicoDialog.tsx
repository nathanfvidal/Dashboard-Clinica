import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CalendarClock, Sparkles } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Medico } from "@/hooks/useMedicos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { PreviewSemana } from "./PreviewSemana";
import { LinhaHorarioSortable } from "./LinhaHorarioSortable";

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

const TEMPLATE_PADRAO = [
  { dia_semana: 1, hora_inicio: "08:00", hora_fim: "18:00", duracao_consulta_min: 30 },
  { dia_semana: 2, hora_inicio: "08:00", hora_fim: "18:00", duracao_consulta_min: 30 },
  { dia_semana: 3, hora_inicio: "08:00", hora_fim: "18:00", duracao_consulta_min: 30 },
  { dia_semana: 4, hora_inicio: "08:00", hora_fim: "18:00", duracao_consulta_min: 30 },
  { dia_semana: 5, hora_inicio: "08:00", hora_fim: "18:00", duracao_consulta_min: 30 },
  { dia_semana: 6, hora_inicio: "08:00", hora_fim: "12:00", duracao_consulta_min: 30 },
];

// Detecta linhas em conflito (mesmo dia, intervalos sobrepostos)
function detectarLinhasConflitantes(
  linhas: Array<{ _key: string; dia_semana?: number; hora_inicio?: string; hora_fim?: string }>,
): Set<string> {
  const conflitantes = new Set<string>();
  const toMin = (s?: string) => {
    if (!s) return 0;
    const [h, m] = s.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const porDia = new Map<number, typeof linhas>();
  for (const l of linhas) {
    const d = Number(l.dia_semana ?? -1);
    if (d < 0) continue;
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d)!.push(l);
  }
  for (const grupo of porDia.values()) {
    for (let i = 0; i < grupo.length; i++) {
      for (let j = i + 1; j < grupo.length; j++) {
        const a = grupo[i];
        const b = grupo[j];
        const aIni = toMin(a.hora_inicio);
        const aFim = toMin(a.hora_fim);
        const bIni = toMin(b.hora_inicio);
        const bFim = toMin(b.hora_fim);
        if (Math.max(aIni, bIni) < Math.min(aFim, bFim)) {
          conflitantes.add(a._key);
          conflitantes.add(b._key);
        }
      }
    }
  }
  return conflitantes;
}

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

  const conflitantes = useMemo(() => detectarLinhasConflitantes(linhas), [linhas]);

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

  const duplicar = (key: string) =>
    setLinhas((l) => {
      const idx = l.findIndex((x) => x._key === key);
      if (idx === -1) return l;
      const copia = { ...l[idx], _key: crypto.randomUUID(), id: undefined };
      return [...l.slice(0, idx + 1), copia, ...l.slice(idx + 1)];
    });

  const aplicarTemplate = () =>
    setLinhas(TEMPLATE_PADRAO.map((t) => ({ ...t, _key: crypto.randomUUID() })));

  const atualizar = (key: string, campo: keyof Horario, valor: string | number) =>
    setLinhas((l) => l.map((x) => (x._key === key ? { ...x, [campo]: valor } : x)));

  // Sensores do dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLinhas((l) => {
      const oldIndex = l.findIndex((x) => x._key === active.id);
      const newIndex = l.findIndex((x) => x._key === over.id);
      if (oldIndex === -1 || newIndex === -1) return l;
      return arrayMove(l, oldIndex, newIndex);
    });
  };

  // Inicial do médico para o avatar do header
  const inicial = medico?.nome?.trim().charAt(0).toUpperCase() ?? "?";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto border-border/40 bg-popover/80 backdrop-blur-2xl">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-lg font-bold text-primary-foreground shadow-glow ring-1 ring-inset ring-white/10">
              {inicial}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                {medico?.nome}
              </DialogTitle>
              <DialogDescription className="text-sm">
                Defina os dias e horários de atendimento. Esses horários alimentam o
                gerador de agenda e a tool de busca da Sofia.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar: ações principais com mesma altura */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-background/30 p-2 backdrop-blur-md">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={aplicarTemplate}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Template padrão (seg-sex 08-18, sáb 08-12)
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button type="button" size="sm" className="h-9" onClick={adicionar}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar linha
          </Button>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            {linhas.length} {linhas.length === 1 ? "linha" : "linhas"}
            {conflitantes.size > 0 && (
              <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-inset ring-destructive/30">
                {conflitantes.size} em conflito
              </span>
            )}
          </div>
        </div>

        {/* Grid 2 colunas em telas grandes: editor à esquerda, preview à direita */}
        <div className="grid gap-4 xl:grid-cols-[1fr_minmax(0,520px)]">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={linhas.map((l) => l._key)}
              strategy={verticalListSortingStrategy}
            >
              <div className="max-h-[60vh] space-y-2 overflow-auto pr-1">
                {linhas.length === 0 && (
                  <div className="glass-subtle flex flex-col items-center justify-center gap-2 p-10 text-center">
                    <CalendarClock className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum horário definido
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Adicione manualmente ou aplique o template padrão.
                    </p>
                  </div>
                )}
                {linhas.map((l) => (
                  <LinhaHorarioSortable
                    key={l._key}
                    id={l._key}
                    dia_semana={l.dia_semana}
                    hora_inicio={l.hora_inicio}
                    hora_fim={l.hora_fim}
                    duracao_consulta_min={l.duracao_consulta_min}
                    conflito={conflitantes.has(l._key)}
                    onChange={(campo, valor) =>
                      atualizar(l._key, campo as keyof Horario, valor)
                    }
                    onRemove={() => remover(l._key)}
                    onDuplicate={() => duplicar(l._key)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="xl:sticky xl:top-0 xl:self-start">
            <PreviewSemana linhas={linhas} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="h-10 px-6"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || conflitantes.size > 0}
          >
            {salvar.isPending ? "Salvando..." : "Salvar horários"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
