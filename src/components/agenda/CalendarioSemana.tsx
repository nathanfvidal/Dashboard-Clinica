import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, eachDayOfInterval, endOfWeek, format, isSameDay, isToday, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
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
  /**
   * Disparado quando o usuário arrasta um card para outro slot.
   * Recebe o id, a nova data (YYYY-MM-DD) e o novo horário (HH:MM:SS).
   * Quem chama deve fazer o update no backend.
   */
  onMoverAgendamento?: (id: string, novaData: string, novoHorario: string) => void;
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
// Faixa horária mostrada na grade (07h–20h cobre clínica padrão).
const HORA_INICIO = 7;
const HORA_FIM = 20;
// Granularidade do drop (30 minutos = metade do slot de 1h).
const SLOT_MIN = 30;
const PX_POR_HORA = 56; // h-14
const PX_POR_SLOT = (PX_POR_HORA * SLOT_MIN) / 60; // 28px

/**
 * Visão semanal — colunas por dia, linhas por hora cheia.
 * Cards de agendamento posicionados absolutamente conforme horário.
 * Suporta drag-and-drop com snap de 30min para remarcar.
 */
export function CalendarioSemana({
  semanaRef,
  agendamentos,
  onMudarSemana,
  onSelecionarAgendamento,
  onMoverAgendamento,
}: Props) {
  // ID sendo arrastado e indicador visual da zona alvo
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<{ data: string; slot: number } | null>(null);

  // Container scrollável da grade — usado para rolar até a hora atual
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Relógio atualizado a cada minuto para a linha "agora"
  const [agora, setAgora] = useState<Date>(() => new Date());
  useEffect(() => {
    // Sincroniza a primeira atualização com a virada do minuto e depois mantém ritmo de 60s
    const msAteProximoMinuto = 60_000 - (Date.now() % 60_000);
    let intervalo: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setAgora(new Date());
      intervalo = setInterval(() => setAgora(new Date()), 60_000);
    }, msAteProximoMinuto);
    return () => {
      clearTimeout(timeout);
      if (intervalo) clearInterval(intervalo);
    };
  }, []);

  const dias = useMemo(() => {
    const inicio = startOfWeek(semanaRef, { weekStartsOn: 0 });
    const fim = endOfWeek(semanaRef, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: inicio, end: fim });
  }, [semanaRef]);

  // Rola até a hora atual quando a semana exibida contém o dia de hoje
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const semanaTemHoje = dias.some((d) => isSameDay(d, new Date()));
    if (!semanaTemHoje) return;
    const minutosDesdeInicio =
      (new Date().getHours() - HORA_INICIO) * 60 + new Date().getMinutes();
    const totalMin = (HORA_FIM - HORA_INICIO) * 60;
    if (minutosDesdeInicio < 0 || minutosDesdeInicio > totalMin) return;
    const topAgora = (minutosDesdeInicio / 60) * PX_POR_HORA;
    // Centraliza a linha na viewport do scroll, com pequena folga superior
    const alvoScroll = Math.max(0, topAgora - container.clientHeight / 2);
    container.scrollTo({ top: alvoScroll, behavior: "smooth" });
  }, [dias]);

  const horas = useMemo(() => {
    const arr: number[] = [];
    for (let h = HORA_INICIO; h <= HORA_FIM; h++) arr.push(h);
    return arr;
  }, []);

  // Slots de 30min para drop zones — cobre a grade inteira
  const slotsDrop = useMemo(() => {
    const total = (HORA_FIM - HORA_INICIO) * (60 / SLOT_MIN);
    return Array.from({ length: total }, (_, i) => i);
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

  // Converte índice de slot em "HH:MM:SS"
  const slotParaHorario = (slot: number) => {
    const totalMin = HORA_INICIO * 60 + slot * SLOT_MIN;
    const h = Math.floor(totalMin / 60).toString().padStart(2, "0");
    const m = (totalMin % 60).toString().padStart(2, "0");
    return `${h}:${m}:00`;
  };

  const aoSoltar = (data: string, slot: number) => {
    if (!arrastando || !onMoverAgendamento) return;
    const novoHorario = slotParaHorario(slot);
    const ag = agendamentos.find((a) => a.id === arrastando);
    // Evita disparo se nada mudou
    if (ag && ag.data_consulta === data && ag.horario === novoHorario) {
      setArrastando(null);
      setAlvo(null);
      return;
    }
    onMoverAgendamento(arrastando, data, novoHorario);
    setArrastando(null);
    setAlvo(null);
  };

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

      {onMoverAgendamento && (
        <p className="px-1 text-[11px] text-muted-foreground/70">
          Dica: arraste um card pelo punho{" "}
          <GripVertical className="inline h-3 w-3 align-text-bottom" /> para
          remarcar (snap 30 min).
        </p>
      )}

      <div ref={scrollRef} className="max-h-[640px] overflow-y-auto overflow-x-hidden rounded-xl border border-border/40">
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
                style={{ height: `${horas.length * PX_POR_HORA}px` }}
              >
                {/* Linhas de hora cheia (visual) */}
                {horas.map((h) => (
                  <div key={h} className="h-14 border-b border-border/30" />
                ))}

                {/* Linha indicadora da hora atual — apenas o traço dentro da coluna do dia de hoje */}
                {(() => {
                  if (!isSameDay(d, agora)) return null;
                  const minutosDesdeInicio =
                    (agora.getHours() - HORA_INICIO) * 60 + agora.getMinutes();
                  const totalMin = (HORA_FIM - HORA_INICIO) * 60;
                  if (minutosDesdeInicio < 0 || minutosDesdeInicio > totalMin) return null;
                  const topAgora = (minutosDesdeInicio / 60) * PX_POR_HORA;
                  return (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-30 flex items-center"
                      style={{ top: `${topAgora}px` }}
                      aria-label={`Hora atual ${format(agora, "HH:mm")}`}
                    >
                      <span className="-ml-1 h-2 w-2 rounded-full bg-destructive shadow-[0_0_0_3px_hsl(var(--destructive)/0.2)]" />
                      <span className="h-px flex-1 bg-destructive" />
                    </div>
                  );
                })()}

                {/* Drop zones de 30 em 30 min — sobrepostas, invisíveis até hover durante drag */}
                {onMoverAgendamento &&
                  slotsDrop.map((slot) => {
                    const ativo =
                      arrastando &&
                      alvo?.data === chave &&
                      alvo?.slot === slot;
                    return (
                      <div
                        key={slot}
                        onDragOver={(e) => {
                          if (!arrastando) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (alvo?.data !== chave || alvo?.slot !== slot) {
                            setAlvo({ data: chave, slot });
                          }
                        }}
                        onDragLeave={() => {
                          if (alvo?.data === chave && alvo?.slot === slot) {
                            setAlvo(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          aoSoltar(chave, slot);
                        }}
                        style={{
                          top: `${slot * PX_POR_SLOT}px`,
                          height: `${PX_POR_SLOT}px`,
                        }}
                        className={cn(
                          "absolute inset-x-0 z-10 transition-colors",
                          arrastando && "hover:bg-primary/10",
                          ativo && "bg-primary/20 ring-1 ring-inset ring-primary/40",
                        )}
                      />
                    );
                  })}

                {/* Cards de agendamento */}
                {items.map((a) => {
                  const [hh, mm] = a.horario.split(":").map(Number);
                  if (hh < HORA_INICIO || hh > HORA_FIM) return null;
                  const top = (hh - HORA_INICIO) * PX_POR_HORA + (mm / 60) * PX_POR_HORA;
                  const arrastandoEste = arrastando === a.id;
                  return (
                    <div
                      key={a.id}
                      draggable={!!onMoverAgendamento}
                      onDragStart={(e) => {
                        if (!onMoverAgendamento) return;
                        setArrastando(a.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", a.id);
                      }}
                      onDragEnd={() => {
                        setArrastando(null);
                        setAlvo(null);
                      }}
                      onClick={() => onSelecionarAgendamento(a.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelecionarAgendamento(a.id);
                        }
                      }}
                      className={cn(
                        "group absolute left-1 right-1 z-20 flex items-start gap-1 truncate rounded-md border px-1.5 py-1 text-left text-[0.7rem] font-medium shadow-sm transition-all",
                        "hover:scale-[1.02] hover:shadow-md",
                        statusBadgeClass(a.status),
                        onMoverAgendamento && "cursor-grab active:cursor-grabbing",
                        arrastandoEste && "opacity-40",
                      )}
                      style={{ top: `${top}px`, minHeight: "32px" }}
                      title={`${a.horario.slice(0, 5)} ${a.medico} — ${a.paciente_nome ?? "sem nome"}`}
                    >
                      {onMoverAgendamento && (
                        <GripVertical className="mt-0.5 h-3 w-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-80" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="tabular-nums">{a.horario.slice(0, 5)}</div>
                        <div className="truncate opacity-90">
                          {a.paciente_nome ?? a.medico}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Rótulo da hora atual sobre a coluna de horas (60px à esquerda) */}
          {(() => {
            const semanaTemHoje = dias.some((d) => isSameDay(d, agora));
            if (!semanaTemHoje) return null;
            const minutosDesdeInicio =
              (agora.getHours() - HORA_INICIO) * 60 + agora.getMinutes();
            const totalMin = (HORA_FIM - HORA_INICIO) * 60;
            if (minutosDesdeInicio < 0 || minutosDesdeInicio > totalMin) return null;
            const topAgora = (minutosDesdeInicio / 60) * PX_POR_HORA;
            return (
              <div
                className="pointer-events-none absolute left-0 z-30 flex h-0 w-[60px] items-center justify-end pr-1"
                style={{ top: `${topAgora}px` }}
                aria-hidden="true"
              >
                <span className="rounded-sm bg-destructive px-1 py-0.5 text-[0.6rem] font-semibold leading-none tabular-nums text-destructive-foreground shadow-sm">
                  {format(agora, "HH:mm")}
                </span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
