import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Copy } from "lucide-react";
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

interface LinhaProps {
  id: string;
  dia_semana?: number;
  hora_inicio?: string;
  hora_fim?: string;
  duracao_consulta_min?: number;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-12 items-end gap-2 rounded-md border border-border bg-card p-3"
    >
      <button
        type="button"
        className="col-span-1 flex h-10 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="col-span-3">
        <Label className="text-xs">Dia</Label>
        <Select
          value={String(dia_semana ?? 1)}
          onValueChange={(v) => onChange("dia_semana", Number(v))}
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
          value={hora_inicio ?? ""}
          onChange={(e) => onChange("hora_inicio", e.target.value)}
        />
      </div>

      <div className="col-span-2">
        <Label className="text-xs">Fim</Label>
        <Input
          type="time"
          value={hora_fim ?? ""}
          onChange={(e) => onChange("hora_fim", e.target.value)}
        />
      </div>

      <div className="col-span-1">
        <Label className="text-xs">Min</Label>
        <Input
          type="number"
          min={5}
          step={5}
          value={duracao_consulta_min ?? 30}
          onChange={(e) => onChange("duracao_consulta_min", Number(e.target.value))}
        />
      </div>

      <div className="col-span-2 flex justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
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
          onClick={onRemove}
          aria-label="Remover linha"
          title="Remover"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
