import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, eachDayOfInterval, endOfWeek, format, isSameDay, isToday, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, GripVertical, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

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
// Duração default por agendamento (a tabela ainda não tem coluna de duração).
const DURACAO_DEFAULT_MIN = 30;
// Limite de lanes visíveis lado a lado — acima disso vira pílula "+N consultas"
// pra manter cada card legível mesmo em horários muito cheios.
const MAX_LANES = 3;

// Cor da borda lateral do card por status — mais legível em alta densidade.
function corBordaStatus(status?: string | null): string {
  switch ((status ?? "").toLowerCase()) {
    case "confirmado":
      return "border-l-[hsl(var(--accent-emerald))] bg-[hsl(var(--accent-emerald)/0.10)] text-foreground";
    case "pendente":
    case "aguardando":
      return "border-l-[hsl(var(--accent-amber))] bg-[hsl(var(--accent-amber)/0.10)] text-foreground";
    case "cancelado":
      return "border-l-destructive bg-destructive/10 text-foreground line-through opacity-70";
    case "finalizado":
      return "border-l-muted-foreground bg-muted/40 text-muted-foreground";
    case "remarcado":
      return "border-l-[hsl(var(--accent-violet))] bg-[hsl(var(--accent-violet)/0.10)] text-foreground";
    default:
      return "border-l-primary bg-primary/10 text-foreground";
  }
}

interface AgendamentoComLane extends AgendamentoLite {
  /** Início em minutos contados a partir da meia-noite. */
  iniMin: number;
  fimMin: number;
  /** Faixa vertical atribuída pelo algoritmo de lanes. */
  laneIndex: number;
  /** Total de lanes no grupo de colisão a que este card pertence. */
  totalLanes: number;
}

/** Pílula de overflow — agrupa cards excedentes em um único slot horário. */
interface OverflowSlot {
  /** Minuto inicial do slot (alinhado ao início mais antigo do grupo). */
  iniMin: number;
  /** Lista completa dos agendamentos deste slot (incluindo os já visíveis). */
  agendamentos: AgendamentoComLane[];
  /** Quantos cards ficaram escondidos (= agendamentos.length - MAX_LANES). */
  excedente: number;
}

/**
 * Algoritmo de lanes — distribui horizontalmente cards que se sobrepõem no tempo.
 * 1. Ordena por (início, -fim).
 * 2. Tenta encaixar nas primeiras MAX_LANES lanes; o que sobrar entra em overflow.
 * 3. Agrupa overflow por slot de 30min para uma pílula "+N" única.
 */
function distribuirEmLanes(items: AgendamentoLite[]): {
  visiveis: AgendamentoComLane[];
  overflows: OverflowSlot[];
} {
  if (items.length === 0) return { visiveis: [], overflows: [] };

  const enriquecidos = items
    .map((a) => {
      const [h, m] = a.horario.split(":").map(Number);
      const iniMin = (h || 0) * 60 + (m || 0);
      return {
        ...a,
        iniMin,
        fimMin: iniMin + DURACAO_DEFAULT_MIN,
        laneIndex: 0,
        totalLanes: 1,
      } as AgendamentoComLane;
    })
    .sort((a, b) => a.iniMin - b.iniMin || b.fimMin - a.fimMin);

  // Atribui lanes — limitando a MAX_LANES; quem não couber vira overflow.
  const lanesFim: number[] = [];
  const visiveis: AgendamentoComLane[] = [];
  const transbordados: AgendamentoComLane[] = [];

  for (const ag of enriquecidos) {
    let alocado = false;
    for (let i = 0; i < lanesFim.length; i++) {
      if (lanesFim[i] <= ag.iniMin) {
        ag.laneIndex = i;
        lanesFim[i] = ag.fimMin;
        alocado = true;
        break;
      }
    }
    if (!alocado) {
      if (lanesFim.length < MAX_LANES) {
        ag.laneIndex = lanesFim.length;
        lanesFim.push(ag.fimMin);
      } else {
        transbordados.push(ag);
        continue;
      }
    }
    visiveis.push(ag);
  }

  // Calcula totalLanes por grupo de colisão (apenas visíveis)
  const ordenados = [...visiveis].sort((a, b) => a.iniMin - b.iniMin);
  let i = 0;
  while (i < ordenados.length) {
    let fimGrupo = ordenados[i].fimMin;
    let j = i + 1;
    while (j < ordenados.length && ordenados[j].iniMin < fimGrupo) {
      fimGrupo = Math.max(fimGrupo, ordenados[j].fimMin);
      j++;
    }
    const grupo = ordenados.slice(i, j);
    const total = Math.min(MAX_LANES, Math.max(...grupo.map((g) => g.laneIndex)) + 1);
    for (const g of grupo) g.totalLanes = total;
    i = j;
  }

  // Agrupa overflow por slot de 30min (alinhado ao início) para uma pílula única.
  const overflowPorSlot = new Map<number, AgendamentoComLane[]>();
  for (const t of transbordados) {
    const slotMin = Math.floor(t.iniMin / SLOT_MIN) * SLOT_MIN;
    const arr = overflowPorSlot.get(slotMin) ?? [];
    arr.push(t);
    overflowPorSlot.set(slotMin, arr);
  }

  // Para cada slot com overflow, montamos a lista completa (visíveis + escondidos)
  // pra exibir tudo no popover; excedente = só os escondidos.
  const overflows: OverflowSlot[] = [];
  for (const [slotMin, escondidos] of overflowPorSlot) {
    const visiveisDoSlot = visiveis.filter(
      (v) => Math.floor(v.iniMin / SLOT_MIN) * SLOT_MIN === slotMin,
    );
    overflows.push({
      iniMin: slotMin,
      agendamentos: [...visiveisDoSlot, ...escondidos].sort((a, b) =>
        (a.medico ?? "").localeCompare(b.medico ?? ""),
      ),
      excedente: escondidos.length,
    });
  }

  return { visiveis, overflows };
}

/**
 * Visão semanal — colunas por dia, linhas por hora cheia.
 * Cards posicionados absolutamente conforme horário, com lanes para evitar sobreposição.
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

  // Agrupa agendamentos por dia + aplica algoritmo de lanes
  const porDia = useMemo(() => {
    const bruto = new Map<string, AgendamentoLite[]>();
    for (const a of agendamentos) {
      const arr = bruto.get(a.data_consulta) ?? [];
      arr.push(a);
      bruto.set(a.data_consulta, arr);
    }
    const map = new Map<string, ReturnType<typeof distribuirEmLanes>>();
    for (const [dia, lista] of bruto) {
      map.set(dia, distribuirEmLanes(lista));
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
            const items = porDia.get(chave) ?? { visiveis: [], overflows: [] };
            return (
              <div
                key={chave}
                className="relative border-l border-border/30"
                style={{ height: `${horas.length * PX_POR_HORA}px` }}
              >
                {/* Linhas de hora cheia + meia-hora (sutis) */}
                {horas.map((h) => (
                  <div key={h} className="relative h-14 border-b border-border/30">
                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/15" />
                  </div>
                ))}

                {/* Linha indicadora da hora atual */}
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

                {/* Drop zones de 30 em 30 min */}
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

                {/* Cards visíveis (até MAX_LANES por slot) */}
                {items.visiveis.map((a) => {
                  const hh = Math.floor(a.iniMin / 60);
                  if (hh < HORA_INICIO || hh > HORA_FIM) return null;
                  const top = ((a.iniMin - HORA_INICIO * 60) / 60) * PX_POR_HORA;
                  const altura = Math.max(
                    24,
                    (DURACAO_DEFAULT_MIN / 60) * PX_POR_HORA - 2,
                  );
                  const arrastandoEste = arrastando === a.id;
                  const larguraPct = 100 / a.totalLanes;
                  const leftPct = a.laneIndex * larguraPct;
                  const muitasLanes = a.totalLanes >= 3;
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
                        "group absolute z-20 flex flex-col gap-0.5 overflow-hidden rounded-md border-l-[3px] border border-border/40 px-1.5 py-1 text-left text-[0.7rem] font-medium shadow-sm backdrop-blur-sm transition-all",
                        "hover:z-40 hover:shadow-lg hover:ring-1 hover:ring-primary/40",
                        corBordaStatus(a.status),
                        onMoverAgendamento && "cursor-grab active:cursor-grabbing",
                        arrastandoEste && "opacity-40",
                      )}
                      style={{
                        top: `${top}px`,
                        height: `${altura}px`,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${larguraPct}% - 4px)`,
                      }}
                      title={`${a.horario.slice(0, 5)} — ${a.medico} — ${a.paciente_nome ?? "sem nome"}${a.especialidade ? ` (${a.especialidade})` : ""}`}
                    >
                      <div className="flex items-center gap-1 leading-none">
                        {onMoverAgendamento && !muitasLanes && (
                          <GripVertical className="h-3 w-3 shrink-0 opacity-30 transition-opacity group-hover:opacity-70" />
                        )}
                        <span className="truncate text-[0.68rem] font-semibold tabular-nums">
                          {a.horario.slice(0, 5)}
                        </span>
                      </div>
                      {!muitasLanes && (
                        <span className="truncate text-[0.65rem] leading-tight opacity-85">
                          {a.paciente_nome ?? a.medico}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Pílulas de overflow — agrupam excedentes por slot de 30min.
                    Renderizadas como tira fina logo abaixo dos cards visíveis. */}
                {items.overflows.map((ov) => {
                  const hh = Math.floor(ov.iniMin / 60);
                  if (hh < HORA_INICIO || hh > HORA_FIM) return null;
                  const top = ((ov.iniMin - HORA_INICIO * 60) / 60) * PX_POR_HORA;
                  const altura = Math.max(
                    18,
                    (DURACAO_DEFAULT_MIN / 60) * PX_POR_HORA - 2,
                  );
                  const horaLabel = `${String(hh).padStart(2, "0")}:${String(ov.iniMin % 60).padStart(2, "0")}`;
                  return (
                    <Popover key={`ov-${ov.iniMin}`}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "absolute z-25 flex items-center justify-center gap-1 overflow-hidden rounded-md border border-dashed border-primary/40 bg-primary/15 px-1.5 text-[0.65rem] font-semibold text-primary backdrop-blur-sm transition-all",
                            "hover:z-40 hover:bg-primary/25 hover:shadow-md",
                          )}
                          style={{
                            top: `${top + altura - 14}px`,
                            height: "14px",
                            left: "2px",
                            right: "2px",
                          }}
                          title={`${ov.agendamentos.length} consultas às ${horaLabel}`}
                        >
                          <Users className="h-2.5 w-2.5" />
                          <span className="tabular-nums">+{ov.excedente} mais</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="center"
                        side="right"
                        className="w-72 border-border/40 bg-popover/90 p-0 backdrop-blur-2xl"
                      >
                        <div className="border-b border-border/30 px-3 py-2">
                          <p className="text-xs font-semibold tracking-tight">
                            {ov.agendamentos.length} consultas às{" "}
                            <span className="tabular-nums">{horaLabel}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(d, "EEEE, dd 'de' MMM", { locale: ptBR })}
                          </p>
                        </div>
                        <ScrollArea className="max-h-72">
                          <ul className="divide-y divide-border/20">
                            {ov.agendamentos.map((a) => (
                              <li key={a.id}>
                                <button
                                  type="button"
                                  onClick={() => onSelecionarAgendamento(a.id)}
                                  className={cn(
                                    "flex w-full items-start gap-2 border-l-[3px] px-3 py-2 text-left transition-colors hover:bg-accent/30",
                                    corBordaStatus(a.status),
                                  )}
                                >
                                  <span className="mt-0.5 shrink-0 font-mono text-[10px] font-semibold tabular-nums">
                                    {a.horario.slice(0, 5)}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-medium">
                                      {a.medico}
                                    </span>
                                    <span className="block truncate text-[10px] text-muted-foreground">
                                      {a.paciente_nome ?? "sem nome"}
                                      {a.especialidade ? ` · ${a.especialidade}` : ""}
                                    </span>
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
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
