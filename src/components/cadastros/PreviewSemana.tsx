import { useMemo } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

interface LinhaHorario {
  dia_semana?: number;
  hora_inicio?: string;
  hora_fim?: string;
  duracao_consulta_min?: number;
}

interface Props {
  linhas: LinhaHorario[];
}

const DIAS_CURTOS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

// Janela horária da prévia (06h às 22h) — escala fixa pra visualização limpa
const HORA_INI = 6;
const HORA_FIM = 22;
const TOTAL_MIN = (HORA_FIM - HORA_INI) * 60;

// Converte "HH:MM" em minutos
const toMin = (hhmm?: string) => {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Formata minutos como "HH:MM"
const fromMin = (min: number) => {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

// Gera a lista de slots (horários) para uma linha
function gerarSlots(linha: LinhaHorario): string[] {
  const ini = toMin(linha.hora_inicio);
  const fim = toMin(linha.hora_fim);
  const dur = Number(linha.duracao_consulta_min) || 30;
  if (fim <= ini || dur <= 0) return [];
  const slots: string[] = [];
  for (let t = ini; t + dur <= fim; t += dur) {
    slots.push(fromMin(t));
  }
  return slots;
}

// Detecta se duas faixas (em minutos) se sobrepõem
function temOverlap(linhasDoDia: LinhaHorario[]): boolean {
  const intervalos = linhasDoDia
    .map((l) => ({ ini: toMin(l.hora_inicio), fim: toMin(l.hora_fim) }))
    .filter((r) => r.fim > r.ini)
    .sort((a, b) => a.ini - b.ini);
  for (let i = 1; i < intervalos.length; i++) {
    if (intervalos[i].ini < intervalos[i - 1].fim) return true;
  }
  return false;
}

interface FaixaVisual {
  topPct: number;
  heightPct: number;
  inicio: string;
  fim: string;
  slots: number;
}

function faixasDoDia(linhasDoDia: LinhaHorario[]): FaixaVisual[] {
  return linhasDoDia
    .map((l) => {
      const ini = toMin(l.hora_inicio);
      const fim = toMin(l.hora_fim);
      if (fim <= ini) return null;
      const dur = Number(l.duracao_consulta_min) || 30;
      const slots = Math.floor((fim - ini) / dur);
      const offsetIni = Math.max(0, ini - HORA_INI * 60);
      const offsetFim = Math.min(TOTAL_MIN, fim - HORA_INI * 60);
      const topPct = (offsetIni / TOTAL_MIN) * 100;
      const heightPct = ((offsetFim - offsetIni) / TOTAL_MIN) * 100;
      return {
        topPct,
        heightPct,
        inicio: l.hora_inicio ?? "",
        fim: l.hora_fim ?? "",
        slots,
      } as FaixaVisual;
    })
    .filter((x): x is FaixaVisual => x !== null && x.heightPct > 0);
}

export function PreviewSemana({ linhas }: Props) {
  // Agrupa linhas por dia
  const dadosPorDia = useMemo(() => {
    const linhasPorDia = new Map<number, LinhaHorario[]>();
    for (let i = 0; i < 7; i++) linhasPorDia.set(i, []);
    for (const linha of linhas) {
      const dia = Number(linha.dia_semana ?? -1);
      if (dia < 0 || dia > 6) continue;
      linhasPorDia.get(dia)!.push(linha);
    }
    const map = new Map<
      number,
      { faixas: FaixaVisual[]; slots: string[]; conflito: boolean; total: number }
    >();
    for (const [dia, lst] of linhasPorDia) {
      const faixas = faixasDoDia(lst);
      const todos = new Set<string>();
      for (const l of lst) for (const s of gerarSlots(l)) todos.add(s);
      const slots = Array.from(todos).sort();
      map.set(dia, {
        faixas,
        slots,
        conflito: temOverlap(lst),
        total: slots.length,
      });
    }
    return map;
  }, [linhas]);

  const totalSlots = useMemo(
    () => Array.from(dadosPorDia.values()).reduce((s, d) => s + d.total, 0),
    [dadosPorDia],
  );
  const totalConflitos = useMemo(
    () => Array.from(dadosPorDia.values()).filter((d) => d.conflito).length,
    [dadosPorDia],
  );

  // Ticks de hora pra grade lateral (a cada 4h)
  const ticks = useMemo(() => {
    const arr: { label: string; pct: number }[] = [];
    for (let h = HORA_INI; h <= HORA_FIM; h += 4) {
      arr.push({
        label: `${h.toString().padStart(2, "0")}h`,
        pct: ((h - HORA_INI) * 60) / TOTAL_MIN * 100,
      });
    }
    return arr;
  }, []);

  return (
    <div className="glass-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">Prévia da semana</p>
          <p className="truncate text-xs text-muted-foreground/70">
            Faixas horárias por dia · passe o mouse pra ver os slots
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {totalConflitos > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-inset ring-destructive/30">
              <AlertTriangle className="h-3 w-3" />
              {totalConflitos}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-inset ring-primary/25 tabular-nums">
            <Clock className="h-3 w-3" />
            {totalSlots}/sem
          </span>
        </div>
      </div>

      {/* Grid: coluna de hora + 7 dias */}
      <div className="flex gap-1.5">
        {/* Coluna lateral com escala de horas */}
        <div className="relative w-7 shrink-0">
          <div className="relative h-40">
            {ticks.map((t) => (
              <span
                key={t.label}
                style={{ top: `${t.pct}%` }}
                className="absolute right-0 -translate-y-1/2 text-[9px] font-medium tabular-nums text-muted-foreground/50"
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>

        {/* 7 colunas de dias */}
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {DIAS_CURTOS.map((nome, i) => {
            const dados = dadosPorDia.get(i)!;
            const vazio = dados.total === 0;
            return (
              <HoverCard key={i} openDelay={120} closeDelay={60}>
                <HoverCardTrigger asChild>
                  <div
                    className={cn(
                      "flex flex-col rounded-lg border transition-colors",
                      vazio
                        ? "border-dashed border-border/40 bg-background/20"
                        : dados.conflito
                          ? "border-destructive/40 bg-destructive/5"
                          : "border-border/40 bg-background/30 hover:border-primary/40",
                    )}
                  >
                    <div className="flex items-center justify-between px-1.5 pt-1.5">
                      <span
                        className={cn(
                          "text-[9px] font-bold tracking-wider",
                          vazio
                            ? "text-muted-foreground/50"
                            : dados.conflito
                              ? "text-destructive"
                              : "text-primary",
                        )}
                      >
                        {nome}
                      </span>
                      {!vazio && (
                        <span className="text-[9px] font-medium tabular-nums text-muted-foreground">
                          {dados.total}
                        </span>
                      )}
                    </div>
                    {/* Trilha das faixas */}
                    <div className="relative mx-1.5 mb-1.5 mt-1 h-40 rounded-md bg-background/40 ring-1 ring-inset ring-border/20">
                      {/* Linhas de grade horizontais */}
                      {ticks.map((t) => (
                        <span
                          key={t.label}
                          style={{ top: `${t.pct}%` }}
                          className="absolute inset-x-0 h-px bg-border/20"
                        />
                      ))}
                      {dados.faixas.map((f, idx) => (
                        <span
                          key={idx}
                          style={{
                            top: `${f.topPct}%`,
                            height: `${f.heightPct}%`,
                          }}
                          className={cn(
                            "absolute inset-x-0.5 rounded-sm ring-1 ring-inset",
                            dados.conflito
                              ? "bg-destructive/30 ring-destructive/40"
                              : "bg-primary/35 ring-primary/30",
                          )}
                          title={`${f.inicio.slice(0, 5)} – ${f.fim.slice(0, 5)} · ${f.slots} slots`}
                        />
                      ))}
                    </div>
                  </div>
                </HoverCardTrigger>
                {!vazio && (
                  <HoverCardContent
                    side="top"
                    align="center"
                    className="w-56 border-border/40 bg-popover/85 p-3 backdrop-blur-2xl"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-wider text-primary">
                        {nome}
                      </span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {dados.total} slots
                      </span>
                    </div>
                    <div className="grid max-h-44 grid-cols-3 gap-1 overflow-auto pr-0.5">
                      {dados.slots.map((s) => (
                        <span
                          key={s}
                          className="rounded bg-primary/10 px-1.5 py-0.5 text-center text-[10px] font-medium tabular-nums text-primary ring-1 ring-inset ring-primary/15"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    {dados.conflito && (
                      <p className="mt-2 flex items-center gap-1 text-[10px] text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        Sobreposição entre linhas deste dia
                      </p>
                    )}
                  </HoverCardContent>
                )}
              </HoverCard>
            );
          })}
        </div>
      </div>

      {totalConflitos > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertTriangle className="h-3 w-3" />
          Há horários sobrepostos no mesmo dia. Ajuste as linhas em conflito antes de
          salvar.
        </p>
      )}
    </div>
  );
}
