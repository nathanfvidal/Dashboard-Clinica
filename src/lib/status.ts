// Mapeamento de status para variantes de badge / cores semânticas

export type StatusAgendamento =
  | "confirmado"
  | "pendente"
  | "cancelado"
  | "finalizado"
  | "remarcado"
  | string;

export const STATUS_AGENDAMENTO: { value: string; label: string }[] = [
  { value: "confirmado", label: "Confirmado" },
  { value: "pendente", label: "Pendente" },
  { value: "cancelado", label: "Cancelado" },
  { value: "finalizado", label: "Finalizado" },
  { value: "remarcado", label: "Remarcado" },
];

export function statusBadgeClass(status?: string | null): string {
  switch ((status ?? "").toLowerCase()) {
    case "confirmado":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "pendente":
    case "aguardando":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "cancelado":
      return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
    case "finalizado":
      return "bg-muted text-muted-foreground border-border";
    case "remarcado":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
