import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

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

// Detecta intervalos sobrepostos dentro do mesmo dia
function detectarConflitos(linhasDoDia: LinhaHorario[]): Set<string> {
  const conflitantes = new Set<string>(); // armazena slots em conflito ("HH:MM")
  const intervalos = linhasDoDia
    .map((l) => ({ ini: toMin(l.hora_inicio), fim: toMin(l.hora_fim) }))
    .filter((r) => r.fim > r.ini);

  for (let i = 0; i < intervalos.length; i++) {
    for (let j = i + 1; j < intervalos.length; j++) {
      const a = intervalos[i];
      const b = intervalos[j];
      const overlapIni = Math.max(a.ini, b.ini);
      const overlapFim = Math.min(a.fim, b.fim);
      if (overlapFim > overlapIni) {
        // Marca todos os slots gerados por ambas as linhas que caiam na faixa de overlap
        for (const linha of [linhasDoDia[i], linhasDoDia[j]]) {
          for (const slot of gerarSlots(linha)) {
            const t = toMin(slot);
            const dur = Number(linha.duracao_consulta_min) || 30;
            if (t < overlapFim && t + dur > overlapIni) conflitantes.add(slot);
          }
        }
      }
    }
  }
  return conflitantes;
}

export function PreviewSemana({ linhas }: Props) {
  // Agrupa slots e conflitos por dia da semana
  const dadosPorDia = useMemo(() => {
    const mapa = new Map<
      number,
      { slots: string[]; conflitos: Set<string> }
    >();
    for (let i = 0; i < 7; i++) mapa.set(i, { slots: [], conflitos: new Set() });

    // Agrupa linhas por dia
    const linhasPorDia = new Map<number, LinhaHorario[]>();
    for (const linha of linhas) {
      const dia = Number(linha.dia_semana ?? -1);
      if (dia < 0 || dia > 6) continue;
      if (!linhasPorDia.has(dia)) linhasPorDia.set(dia, []);
      linhasPorDia.get(dia)!.push(linha);
    }

    for (const [dia, linhasDoDia] of linhasPorDia) {
      const conflitos = detectarConflitos(linhasDoDia);
      const todosSlots = new Set<string>();
      for (const l of linhasDoDia) for (const s of gerarSlots(l)) todosSlots.add(s);
      mapa.set(dia, {
        slots: Array.from(todosSlots).sort(),
        conflitos,
      });
    }
    return mapa;
  }, [linhas]);

  const totalSlots = useMemo(
    () => Array.from(dadosPorDia.values()).reduce((s, d) => s + d.slots.length, 0),
    [dadosPorDia],
  );

  const totalConflitos = useMemo(
    () => Array.from(dadosPorDia.values()).reduce((s, d) => s + d.conflitos.size, 0),
    [dadosPorDia],
  );

  return (
    <div className="glass-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold tracking-tight">Prévia da semana</p>
          <p className="text-xs text-muted-foreground/70">
            Slots gerados a cada intervalo configurado
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalConflitos > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/30">
              <AlertTriangle className="h-3 w-3" />
              {totalConflitos} {totalConflitos === 1 ? "conflito" : "conflitos"}
            </span>
          )}
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/25">
            {totalSlots} {totalSlots === 1 ? "slot" : "slots"} / semana
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {DIAS_CURTOS.map((nome, i) => {
          const dados = dadosPorDia.get(i) ?? { slots: [], conflitos: new Set<string>() };
          const { slots, conflitos } = dados;
          const vazio = slots.length === 0;
          const temConflito = conflitos.size > 0;
          return (
            <div
              key={i}
              className={
                "flex flex-col rounded-lg border p-2.5 transition-all " +
                (vazio
                  ? "border-dashed border-border/40 bg-background/20"
                  : temConflito
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-border/40 bg-background/30")
              }
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={
                    "text-[10px] font-bold tracking-wider " +
                    (vazio
                      ? "text-muted-foreground/50"
                      : temConflito
                        ? "text-destructive"
                        : "text-primary")
                  }
                >
                  {nome}
                </span>
                {!vazio && (
                  <span className="flex items-center gap-1">
                    {temConflito && (
                      <AlertTriangle
                        className="h-3 w-3 text-destructive"
                        aria-label="Conflitos detectados"
                      />
                    )}
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {slots.length}
                    </span>
                  </span>
                )}
              </div>
              {vazio ? (
                <span className="py-2 text-center text-[10px] text-muted-foreground/40">—</span>
              ) : (
                <div className="flex max-h-48 flex-col gap-1 overflow-auto pr-0.5">
                  {slots.map((s) => {
                    const conflito = conflitos.has(s);
                    return (
                      <span
                        key={s}
                        title={conflito ? "Sobreposição com outra linha" : undefined}
                        className={
                          "rounded-md px-1.5 py-1 text-center text-[10px] font-medium tabular-nums ring-1 ring-inset " +
                          (conflito
                            ? "bg-destructive/15 text-destructive ring-destructive/40"
                            : "bg-primary/10 text-primary ring-primary/15")
                        }
                      >
                        {s}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
