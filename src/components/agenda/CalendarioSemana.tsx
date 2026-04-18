import { useMemo } from "react";
import { addDays, eachDayOfInterval, endOfWeek, format, isToday, startOfWeek } from "date-fns";
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
  especialidade: string;
  paciente_nome: string | null;
  status: string | null;
}

interface Props {
  semanaRef: Date;
  agendamentos: AgendamentoLite[];
  onMudarSemana: (novo: Date) => void;
  onSelecionarAgendamento: (id: string) => void;
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
// Faixa horária mostrada na grade (07h–20h cobre clínica padrão).
const HORA_INICIO = 7;
const HORA_FIM = 20;

/**
 * Visão semanal — colunas por dia, linhas por hora cheia.
 * Cards de agendamento posicionados absolutamente conforme horário.
 */
export function CalendarioSemana({
  semanaRef,
  agendamentos,
  onMudarSemana,
  onSelecionarAgendamento,
}: Props) {
  const dias = useMemo(() => {
    const inicio = startOfWeek(semanaRef, { weekStartsOn: 0 });
    const fim = endOfWeek(semanaRef, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: inicio, end: fim });
  }, [semanaRef]);

  const horas = useMemo(() => {
    const arr: number[] = [];
    for (let h = HORA_INICIO; h <= HORA_FIM; h++) arr.push(h);
    return arr;
  }, []);

  // Agrupa agendamentos por dia (YYYY-MM-DD) pra lookup rápido
  const porDia = useMemo(() => {
    const map = new Map<string, AgendamentoLite[]>();
    for (const a of agendamentos) {
      const arr = map.get(a.data_consulta) ?? [];
      arr.push(a);
      map.set(a.data_consulta, arr);
    }
    return map;
  }, [agendamentos]);

  const inicioSemana = dias[0];
  const fimSemana = dias[6];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-lg font-semibold tracking-tight">
          {format(inicioSemana, "d 'de' MMM", { locale: ptBR })} —{" "}
          {format(fimSemana, "d 'de' MMM yyyy", { locale: ptBR })}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => onMudarSemana(addDays(inicioSemana, -7))}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-3 text-xs"
            onClick={() => onMudarSemana(new Date())}
          >
            Hoje
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => onMudarSemana(addDays(inicioSemana, 7))}
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/40">
        {/* Cabeçalho de dias */}
        <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-border/40 bg-background/60">
          <div />
          {dias.map((d) => {
            const hoje = isToday(d);
            return (
              <div
                key={d.toISOString()}
                className="flex flex-col items-center justify-center gap-0.5 py-2"
              >
                <span className="text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">
                  {DIAS[d.getDay()]}
                </span>
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                    hoje && "bg-primary text-primary-foreground shadow-glow",
                  )}
                >
                  {format(d, "d")}
                </span>
              </div>
            );
          })}
        </div>

        {/* Grade de horários */}
        <div className="relative grid grid-cols-[60px_repeat(7,minmax(0,1fr))] bg-background/40">
          {/* Coluna de horas */}
          <div className="flex flex-col">
            {horas.map((h) => (
              <div
                key={h}
                className="h-14 border-b border-border/30 px-2 pt-1 text-right text-[0.65rem] font-medium tabular-nums text-muted-foreground"
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Colunas dos dias */}
          {dias.map((d) => {
            const chave = format(d, "yyyy-MM-dd");
            const items = porDia.get(chave) ?? [];
            return (
              <div
                key={chave}
                className="relative border-l border-border/30"
                style={{ height: `${horas.length * 56}px` }}
              >
                {horas.map((h) => (
                  <div key={h} className="h-14 border-b border-border/30" />
                ))}
                {items.map((a) => {
                  const [hh, mm] = a.horario.split(":").map(Number);
                  if (hh < HORA_INICIO || hh > HORA_FIM) return null;
                  // 56px por hora (h-14)
                  const top = (hh - HORA_INICIO) * 56 + (mm / 60) * 56;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelecionarAgendamento(a.id)}
                      className={cn(
                        "absolute left-1 right-1 truncate rounded-md border px-1.5 py-1 text-left text-[0.7rem] font-medium shadow-sm transition-transform hover:scale-[1.02]",
                        statusBadgeClass(a.status),
                      )}
                      style={{ top: `${top}px`, minHeight: "28px" }}
                      title={`${a.horario.slice(0, 5)} ${a.medico} — ${a.paciente_nome ?? "sem nome"}`}
                    >
                      <div className="tabular-nums">{a.horario.slice(0, 5)}</div>
                      <div className="truncate opacity-90">{a.paciente_nome ?? a.medico}</div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
