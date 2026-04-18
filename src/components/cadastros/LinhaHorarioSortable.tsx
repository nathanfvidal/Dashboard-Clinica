import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Copy, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeInput24 } from "@/components/ui/time-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Dias da semana — mantido em sincronia com HorariosMedicoDialog
const DIAS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const DIAS_CURTOS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

interface LinhaProps {
  id: string;
  dia_semana?: number;
  hora_inicio?: string;
  hora_fim?: string;
  duracao_consulta_min?: number;
  conflito?: boolean;
  onChange: (campo: string, valor: string | number) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

export function LinhaHorarioSortable({
  id,
  dia_semana,
  hora_inicio,
  hora_fim,
  duracao_consulta_min,
  conflito = false,
  onChange,
  onRemove,
  onDuplicate,
}: LinhaProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  // Calcula slots estimados pra dar feedback visual no card
  const slotsEstimados = (() => {
    if (!hora_inicio || !hora_fim) return 0;
    const [hi, mi] = hora_inicio.split(":").map(Number);
    const [hf, mf] = hora_fim.split(":").map(Number);
    const dur = duracao_consulta_min || 30;
    const total = hf * 60 + mf - (hi * 60 + mi);
    return total > 0 && dur > 0 ? Math.floor(total / dur) : 0;
  })();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group glass-subtle relative overflow-hidden p-4 transition-all",
        conflito && "border-destructive/60 bg-destructive/5",
        isDragging && "shadow-pop",
      )}
    >
      {/* Linha 1: handle + dia + ações */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-9 w-9 cursor-grab items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent/60 hover:text-foreground active:cursor-grabbing"
            aria-label="Arrastar para reordenar"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <div className="min-w-[180px]">
            <Select
              value={String(dia_semana ?? 1)}
              onValueChange={(v) => onChange("dia_semana", Number(v))}
            >
              <SelectTrigger className="h-9 border-border/50 bg-background/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIAS.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-primary">
                        {DIAS_CURTOS[i]}
                      </span>
                      {d}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {conflito && (
            <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-inset ring-destructive/30">
              <AlertTriangle className="h-3 w-3" />
              Conflito
            </span>
          )}

          {!conflito && slotsEstimados > 0 && (
            <span className="hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-inset ring-primary/20 sm:inline-flex">
              <Clock className="h-3 w-3" />
              {slotsEstimados} slots
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onDuplicate}
            aria-label="Duplicar linha"
            title="Duplicar"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
            aria-label="Remover linha"
            title="Remover"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Linha 2: inputs de hora */}
      <div className="mt-3 grid grid-cols-3 gap-3 pl-11">
        <div className="space-y-1">
          <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Início
          </Label>
          <TimeInput24
            className="h-9 border-border/50 bg-background/40"
            value={hora_inicio ?? ""}
            onChange={(e) => onChange("hora_inicio", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Fim
          </Label>
          <TimeInput24
            className="h-9 border-border/50 bg-background/40"
            value={hora_fim ?? ""}
            onChange={(e) => onChange("hora_fim", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Duração (min)
          </Label>
          <Input
            type="number"
            min={5}
            step={5}
            className="h-9 border-border/50 bg-background/40 tabular-nums"
            value={duracao_consulta_min ?? 30}
            onChange={(e) => onChange("duracao_consulta_min", Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
