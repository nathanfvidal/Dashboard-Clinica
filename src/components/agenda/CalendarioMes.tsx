import { useMemo } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { statusBadgeClass } from "@/lib/status";

interface AgendamentoLite {
  id: string;
  data_consulta: string;
  horario: string;
  medico: string;
  paciente_nome: string | null;
  status: string | null;
}

interface Props {
  /** Mês ancorado (qualquer dia desse mês) */
  mesRef: Date;
  agendamentos: AgendamentoLite[];
  onMudarMes: (novo: Date) => void;
  onSelecionarDia: (data: string) => void;
  onSelecionarAgendamento: (id: string) => void;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Visão mensal estilo macOS Calendar — grid 7 colunas com células translúcidas.
 * Mostra até 3 agendamentos por dia + contador de excedentes.
 */
export function CalendarioMes({
  mesRef,
  agendamentos,
  onMudarMes,
  onSelecionarDia,
  onSelecionarAgendamento,
}: Props) {
  const dias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesRef), { weekStartsOn: 0 });
    const fim = endOfWeek(endOfMonth(mesRef), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: inicio, end: fim });
  }, [mesRef]);

  // Agrupa por data (YYYY-MM-DD) pra lookup O(1)
  const porDia = useMemo(() => {
    const map = new Map<string, AgendamentoLite[]>();
    for (const a of agendamentos) {
      const arr = map.get(a.data_consulta) ?? [];
      arr.push(a);
      map.set(a.data_consulta, arr);
    }
    // ordena por horário dentro de cada dia
    map.forEach((arr) => arr.sort((x, y) => x.horario.localeCompare(y.horario)));
    return map;
  }, [agendamentos]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-lg font-semibold capitalize tracking-tight">
          {format(mesRef, "MMMM 'de' yyyy", { locale: ptBR })}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => onMudarMes(addDays(startOfMonth(mesRef), -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs"
            onClick={() => onMudarMes(new Date())}
          >
            Hoje
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => onMudarMes(addDays(endOfMonth(mesRef), 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border/40 bg-border/40">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="bg-background/60 px-2 py-2 text-center text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {dias.map((dia) => {
          const chave = format(dia, "yyyy-MM-dd");
          const items = porDia.get(chave) ?? [];
          const noMes = isSameMonth(dia, mesRef);
          const hoje = isToday(dia);
          const visiveis = items.slice(0, 3);
          const restantes = items.length - visiveis.length;

          return (
            <button
              key={chave}
              type="button"
              onClick={() => onSelecionarDia(chave)}
              className={cn(
                "group relative flex min-h-[110px] flex-col items-stretch gap-1 bg-background/40 p-1.5 text-left transition-colors",
                "hover:bg-accent/20",
                !noMes && "bg-background/20 text-muted-foreground/50",
              )}
            >
              <div className="flex items-center justify-between px-1">
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums",
                    hoje && "bg-primary text-primary-foreground shadow-glow",
                    !hoje && noMes && "text-foreground",
                  )}
                >
                  {format(dia, "d")}
                </span>
                {items.length > 0 && (
                  <span className="text-[0.65rem] font-medium text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {visiveis.map((a) => (
                  <span
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelecionarAgendamento(a.id);
                    }}
                    className={cn(
                      "truncate rounded-md border px-1.5 py-0.5 text-[0.7rem] font-medium",
                      statusBadgeClass(a.status),
                    )}
                    title={`${a.horario.slice(0, 5)} — ${a.medico} — ${a.paciente_nome ?? "sem nome"}`}
                  >
                    <span className="tabular-nums">{a.horario.slice(0, 5)}</span>{" "}
                    {a.paciente_nome ?? a.medico}
                  </span>
                ))}
                {restantes > 0 && (
                  <span className="px-1.5 text-[0.65rem] text-muted-foreground">
                    +{restantes} mais
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
