// Mapeamento de status para variantes de badge / cores semânticas
// Usa tokens HSL do design system para combinar com o tema dark profissional.

export type StatusAgendamento =
  | "confirmado"
  | "pendente"
  | "cancelado"
  | "finalizado"
  | "remarcado"
  | "disponivel"
  | string;

export const STATUS_AGENDAMENTO: { value: string; label: string }[] = [
  { value: "confirmado", label: "Confirmado" },
  { value: "pendente", label: "Pendente" },
  { value: "cancelado", label: "Cancelado" },
  { value: "finalizado", label: "Finalizado" },
  { value: "remarcado", label: "Remarcado" },
  { value: "disponivel", label: "Disponível (slots livres)" },
];

export function statusBadgeClass(status?: string | null): string {
  switch ((status ?? "").toLowerCase()) {
    case "confirmado":
      return "bg-[hsl(var(--accent-emerald)/0.15)] text-[hsl(var(--accent-emerald))] border-[hsl(var(--accent-emerald)/0.3)]";
    case "pendente":
    case "aguardando":
      return "bg-[hsl(var(--accent-amber)/0.15)] text-[hsl(var(--accent-amber))] border-[hsl(var(--accent-amber)/0.3)]";
    case "cancelado":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "finalizado":
      return "bg-muted text-muted-foreground border-border";
    case "remarcado":
      return "bg-[hsl(var(--accent-violet)/0.15)] text-[hsl(var(--accent-violet))] border-[hsl(var(--accent-violet)/0.3)]";
    case "disponivel":
      return "bg-[hsl(var(--accent-cyan)/0.15)] text-[hsl(var(--accent-cyan))] border-[hsl(var(--accent-cyan)/0.3)]";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
